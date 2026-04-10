namespace Skrepka

open System
open System.Text.Json
open System.Text.Json.Serialization
open Fabulous
open Fabulous.Maui
open Microsoft.Maui.Graphics

open type Fabulous.Maui.View

module App =

    open Store
    open Crypto
    open ApiClient

    // ── Domain Types ──

    type private EnvelopeType = Text | UnknownEnvelope of string

    type private EnvelopeTypeConverter() =
        inherit JsonConverter<EnvelopeType>()
        override _.Read(reader, _, _) =
            match reader.GetString() with
            | "text" -> Text
            | s -> UnknownEnvelope s
        override _.Write(writer, value, _) =
            writer.WriteStringValue(
                match value with
                | Text -> "text"
                | UnknownEnvelope s -> s)

    [<CLIMutable>]
    type private TextEnvelope =
        { [<JsonPropertyName("type")>] Type: EnvelopeType
          [<JsonPropertyName("id")>] Id: string
          [<JsonPropertyName("body")>] Body: string }

    let private envelopeJsonOpts =
        let opts = JsonSerializerOptions()
        opts.Converters.Add(EnvelopeTypeConverter())
        opts

    type Page =
        | Setup
        | Conversations
        | Chat of pubkey: string
        | AddContact
        | Settings

    type Session = { Url: string; Token: string; Identity: Identity }

    type ConnStatus =
        | Offline
        | Connecting
        | Online of token: string

    type AuthState =
        | NoIdentity
        | Identified of identity: Identity * conn: ConnStatus

    // ── Model ──

    type Model =
        { Page: Page
          Auth: AuthState
          ServerUrl: string
          Contacts: Contact list
          PollStatus: string
          Messages: Map<string, ChatMessage list>
          Error: string option
          PollCursor: int64
          Compose: string
          ContactPubkey: string
          ContactNickname: string }

    // ── Msg ──

    type Msg =
        | SetPage of Page
        | SetCompose of string
        | SetContactPubkey of string
        | SetContactNickname of string
        | GenIdentity
        | IdentityReady of Identity
        | SetServerUrl of string
        | DoConnect
        | AuthOk of string
        | AuthErr of string
        | DoDisconnect
        | DoSend
        | SendFailed of string
        | DoSaveContact
        | PollResult of messages: (string * ChatMessage) list * status: string * cursor: int64
        | CopyPubKey
        | DismissError
        | StateLoaded of Identity * Data option

    // ── CmdMsg ──

    type CmdMsg =
        | CmdGenIdentity
        | CmdConnect of url: string * identity: Identity
        | CmdSend of session: Session * recipientHex: string * text: string * messageId: string
        | CmdPoll of session: Session * cursor: int64
        | CmdCopyToClipboard of string
        | CmdLoadState
        | CmdSaveIdentity of Identity
        | CmdSaveData of Data

    // ── Helpers ──

    let private nowStr () =
        DateTimeOffset.UtcNow.ToString("HH:mm:ss")

    let private truncate maxLen (s: string) =
        if s.Length > maxLen then s.[..maxLen - 1] + "..." else s

    let private hexToOb (hex: string) =
        Crypto.fromHex hex |> Phonemic.toOb

    let private truncOb (ob: string) =
        let parts = ob.Split('-')

        if parts.Length <= 4 then
            ob
        else
            $"{parts.[0]}-{parts.[1]}..{parts.[parts.Length - 2]}-{parts.[parts.Length - 1]}"

    let private truncKey (hex: string) = hexToOb hex |> truncOb

    let private contactName (contacts: Contact list) (pk: string) =
        contacts
        |> List.tryFind (fun c -> c.Pubkey = pk)
        |> Option.map _.Nickname
        |> Option.defaultValue (truncKey pk)

    let private messagesFor (pk: string) (messages: Map<string, ChatMessage list>) =
        messages |> Map.tryFind pk |> Option.defaultValue []

    let private appendMessage (pk: string) (msg: ChatMessage) (messages: Map<string, ChatMessage list>) =
        let existing = messagesFor pk messages
        if existing |> List.exists (fun m -> m.Id = msg.Id) then messages
        else Map.add pk (existing @ [ msg ]) messages

    let private addContactIfNew (contact: Contact) (contacts: Contact list) =
        if contacts |> List.exists (fun c -> c.Pubkey = contact.Pubkey) then contacts
        else contacts @ [ contact ]

    let private upsertContact (contact: Contact) (contacts: Contact list) =
        match contacts |> List.tryFindIndex (fun c -> c.Pubkey = contact.Pubkey) with
        | Some i -> contacts |> List.updateAt i contact
        | None -> contacts @ [ contact ]

    let private pubKeyHex model =
        match model.Auth with
        | Identified(id, _) -> id.PubKeyHex
        | NoIdentity -> ""

    let private trySession model =
        match model.Auth with
        | Identified(id, Online token) -> Some { Url = model.ServerUrl; Token = token; Identity = id }
        | _ -> None

    let private setConn status model =
        match model.Auth with
        | Identified(id, _) -> { model with Auth = Identified(id, status) }
        | NoIdentity -> model

    let private saveCmdMsg model =
        CmdSaveData { Contacts = model.Contacts; Messages = model.Messages; ServerUrl = Some model.ServerUrl; PollCursor = model.PollCursor }

    // ── Init ──

    let init () =
        { Page = Setup
          Auth = NoIdentity
          ServerUrl = "http://localhost:8080"
          PollStatus = ""
          Contacts = []
          Messages = Map.empty
          Error = None
          PollCursor = 0L
          Compose = ""
          ContactPubkey = ""
          ContactNickname = "" },
        [ CmdLoadState ]

    // ── Update ──

    let update msg model =
        match msg with
        | SetPage(Chat pk) ->
            { model with Page = Chat pk; Compose = "" }, []
        | SetPage AddContact ->
            { model with Page = AddContact; ContactPubkey = ""; ContactNickname = "" }, []
        | SetPage page -> { model with Page = page }, []

        | SetCompose text -> { model with Compose = text }, []
        | SetContactPubkey pk -> { model with ContactPubkey = pk }, []
        | SetContactNickname nn -> { model with ContactNickname = nn }, []

        | GenIdentity -> model, [ CmdGenIdentity ]

        | IdentityReady identity ->
            { model with Auth = Identified(identity, Offline); Page = Settings },
            [ CmdSaveIdentity identity ]

        | SetServerUrl url -> { model with ServerUrl = url }, []

        | DoConnect ->
            match model.Auth with
            | Identified(id, _) ->
                model |> setConn Connecting, [ CmdConnect(model.ServerUrl, id) ]
            | NoIdentity -> { model with Error = Some "No identity generated" }, []

        | AuthOk token ->
            match model.Auth with
            | Identified(id, Connecting) ->
                let session = { Url = model.ServerUrl; Token = token; Identity = id }
                { model with Auth = Identified(id, Online token); Page = Conversations; Error = None },
                [ CmdPoll(session, model.PollCursor) ]
            | _ -> model, []

        | AuthErr err -> { setConn Offline model with Error = Some err }, []

        | DoDisconnect -> model |> setConn Offline, []

        | DoSend ->
            match model.Page, trySession model with
            | Chat pk, Some session when model.Compose <> "" ->
                let text = model.Compose
                let id = Guid.NewGuid().ToString()
                let outMsg =
                    { Id = id
                      Body = text
                      Timestamp = DateTimeOffset.UtcNow
                      IsOutgoing = true }

                let model' =
                    { model with
                        Compose = ""
                        Messages = model.Messages |> appendMessage pk outMsg }

                model', [ CmdSend(session, pk, text, id); saveCmdMsg model' ]
            | _ -> model, []

        | SendFailed err -> { model with Error = Some err }, []

        | PollResult(incoming, status, newCursor) ->
            let model' =
                incoming
                |> List.fold
                    (fun (m: Model) (fromPubkey, chatMsg) ->
                        { m with
                            Contacts = m.Contacts |> addContactIfNew { Pubkey = fromPubkey; Nickname = truncKey fromPubkey }
                            Messages = m.Messages |> appendMessage fromPubkey chatMsg })
                    { model with PollStatus = status; PollCursor = newCursor }

            model',
            [ match trySession model' with
              | Some session -> CmdPoll(session, model'.PollCursor)
              | None -> ()
              if not incoming.IsEmpty then saveCmdMsg model' ]

        | DoSaveContact ->
            let pk, nn = model.ContactPubkey, model.ContactNickname
            match model.Page with
            | AddContact when pk <> "" && nn <> "" ->
                match Phonemic.fromOb pk |> Option.orElseWith (fun () -> Crypto.tryFromHex pk) with
                | Some bytes when bytes.Length = 32 ->
                    let contact: Contact = { Pubkey = Crypto.toHex bytes; Nickname = nn }

                    let model' =
                        { model with
                            Contacts = model.Contacts |> upsertContact contact
                            Page = Conversations }

                    model', [ saveCmdMsg model' ]
                | _ -> { model with Error = Some "Invalid public key" }, []
            | _ -> model, []

        | CopyPubKey ->
            model,
            [ match model.Auth with
              | Identified(id, _) -> CmdCopyToClipboard(hexToOb id.PubKeyHex)
              | NoIdentity -> () ]

        | DismissError -> { model with Error = None }, []

        | StateLoaded(identity, dataOpt) ->
            match dataOpt with
            | Some data ->
                let model' =
                    { model with
                        Auth = Identified(identity, Connecting)
                        Contacts = data.Contacts
                        Messages = data.Messages
                        ServerUrl = data.ServerUrl |> Option.defaultValue model.ServerUrl
                        PollCursor = data.PollCursor
                        Page = Conversations }
                model', [ CmdConnect(model'.ServerUrl, identity) ]
            | None ->
                { model with Auth = Identified(identity, Offline); Page = Settings }, []

    // ── mapCmd ──

    let private asyncCmd (op: Async<Msg>) : Cmd<Msg> =
        Cmd.ofEffect (fun dispatch ->
            async {
                let! msg = op
                dispatch msg
            }
            |> Async.Start)

    let private decryptEvent (privKey: byte[]) (payload: EventPayload) =
        try
            let blob = Crypto.fromHex payload.EncryptedBlob

            match Crypto.decrypt privKey blob with
            | Some(plaintext, senderHex) ->
                let envelope = JsonSerializer.Deserialize<TextEnvelope>(plaintext, envelopeJsonOpts)

                match envelope.Type with
                | Text ->
                    Ok(senderHex,
                       { Id = envelope.Id
                         Body = envelope.Body
                         Timestamp = DateTimeOffset.FromUnixTimeSeconds(payload.Timestamp)
                         IsOutgoing = false })
                | UnknownEnvelope t -> Error $"unknown envelope type: {t}"
            | None -> Error "decrypt failed"
        with ex ->
            Error $"parse: {ex.Message}"

    let mapCmd cmdMsg =
        match cmdMsg with
        | CmdGenIdentity ->
            asyncCmd (async { return IdentityReady(Crypto.generateIdentity ()) })

        | CmdConnect(url, identity) ->
            asyncCmd (async {
                try
                    let! token = authenticate url identity
                    return AuthOk token
                with ex ->
                    return AuthErr ex.Message
            })

        | CmdSend(session, recipientHex, text, messageId) ->
            Cmd.ofEffect (fun dispatch ->
                async {
                    try
                        let recipPub = Crypto.fromHex recipientHex
                        let ts = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
                        let payload = JsonSerializer.Serialize<TextEnvelope>({ Type = Text; Id = messageId; Body = text }, envelopeJsonOpts)
                        let blob = Crypto.encrypt session.Identity.PrivKey recipPub payload
                        let! status = sendMessage session.Url session.Token recipientHex (Crypto.toHex blob) ts

                        match status with
                        | Delivered | Federated | Queued -> ()
                        | Rejected -> dispatch (SendFailed "Message rejected by server")
                        | Unauthorized -> dispatch (SendFailed "Not authorized to deliver message")
                    with ex ->
                        dispatch (SendFailed $"Send failed: {ex.Message}")
                }
                |> Async.Start)

        | CmdPoll(session, cursor) ->
            asyncCmd (async {
                try
                    let! response = poll session.Url session.Token cursor
                    let messages, ackIds, errors =
                        Array.foldBack
                            (fun (evt: PollEvent) (msgs, acks, errs) ->
                                match decryptEvent session.Identity.PrivKey evt.Payload with
                                | Ok msg -> (msg :: msgs, evt.Id :: acks, errs)
                                | Error err -> (msgs, acks, err :: errs))
                            response.Events
                            ([], [], [])

                    if not ackIds.IsEmpty then
                        do! ackMessages session.Url session.Token ackIds

                    let now = nowStr ()

                    let status =
                        $"[{now}] evts:{response.Events.Length} msgs:{messages.Length} errs:{errors.Length}"
                        + (match errors with err :: _ -> $" [{err}]" | [] -> "")

                    return PollResult(messages, status, response.Cursor)
                with
                | :? TimeoutException ->
                    return PollResult([], "polling...", cursor)
                | ex ->
                    let now = nowStr ()
                    do! Async.Sleep 3000
                    return PollResult([], $"[{now}] poll error: {ex.Message}", cursor)
            })

        | CmdCopyToClipboard text ->
            Cmd.ofEffect (fun _ ->
                Microsoft.Maui.ApplicationModel.DataTransfer.Clipboard.Default.SetTextAsync(text)
                |> ignore)

        | CmdLoadState ->
            Cmd.ofEffect (fun dispatch ->
                async {
                    match! Store.loadIdentity () with
                    | Some id -> dispatch (StateLoaded(id, Store.loadData ()))
                    | None -> ()
                }
                |> Async.Start)

        | CmdSaveIdentity identity ->
            Cmd.ofEffect (fun _ -> Store.saveIdentity identity |> Async.Start)

        | CmdSaveData data ->
            Cmd.ofEffect (fun _ -> Store.saveData data)

    // ── View ──

    let private viewSetup () =
        ContentPage(
            (VStack(spacing = 24.) {
                Label("Skrepka")
                    .font(size = 32.)
                    .centerTextHorizontal()

                Label("End-to-end encrypted messaging")
                    .font(size = 16.)
                    .centerTextHorizontal()

                Button("Generate Identity", GenIdentity)
                    .centerHorizontal()
            })
                .padding(30.)
                .centerVertical()
        )

    let private viewSettings model =
        ContentPage(
            ScrollView(
                (VStack(spacing = 16.) {
                    Label("Settings")
                        .font(size = 24.)
                        .centerTextHorizontal()

                    Label("Your Public Key:")

                    Label(truncOb (hexToOb (pubKeyHex model)))
                        .font(size = 14.)

                    Button("Copy Public Key", CopyPubKey)

                    Label("Server:")

                    Entry(model.ServerUrl, SetServerUrl)

                    match model.Error with
                    | Some err ->
                        Label(err)
                            .textColor(Colors.Red)
                            .font(size = 12.)

                        Button("Dismiss", DismissError)
                    | None -> ()

                    match model.Auth with
                    | Identified(_, Offline) -> Button("Connect", DoConnect)
                    | Identified(_, Connecting) -> Label("Connecting...").centerTextHorizontal()
                    | Identified(_, Online _) ->
                        Button("Disconnect", DoDisconnect)
                        Button("Go to Conversations", SetPage Conversations)
                    | NoIdentity -> ()
                })
                    .padding(20.)
            )
        )

    let private viewConversations model =
        let connStr =
            match model.Auth with
            | NoIdentity | Identified(_, Offline) -> "OFFLINE"
            | Identified(_, Connecting) -> "CONNECTING"
            | Identified(_, Online _) -> "ONLINE"

        let contactNames =
            model.Contacts
            |> List.map _.Nickname
            |> String.concat ", "

        let totalMsgs =
            model.Messages |> Map.values |> Seq.sumBy List.length

        ContentPage(
            ScrollView(
                (VStack(spacing = 8.) {
                    HStack(spacing = 8.) {
                        Label("Conversations")
                            .font(size = 24.)

                        Button("+", SetPage AddContact)
                        Button("Settings", SetPage Settings)
                    }

                    Label($"conn:{connStr} contacts:{model.Contacts.Length} msgs:{totalMsgs}")
                        .font(size = 10.)
                        .textColor(Colors.DimGray)

                    Label($"poll: {model.PollStatus}")
                        .font(size = 10.)
                        .textColor(Colors.DimGray)

                    if contactNames <> "" then
                        Label($"names: {contactNames}")
                            .font(size = 10.)
                            .textColor(Colors.DimGray)

                    if model.Contacts.IsEmpty then
                        Label("No contacts yet. Tap + to add one.")
                            .centerTextHorizontal()
                            .textColor(Colors.Gray)

                    for c in model.Contacts do
                        let preview =
                            messagesFor c.Pubkey model.Messages
                            |> List.tryLast
                            |> Option.map (fun m -> truncate 40 m.Body)
                            |> Option.defaultValue ""

                        Button($"{c.Nickname}\n{preview}", SetPage(Chat c.Pubkey))
                })
                    .padding(20.)
            )
        )

    let private viewChat model pk =
        let name = contactName model.Contacts pk
        let msgs = messagesFor pk model.Messages

        ContentPage(
            (VStack(spacing = 8.) {
                HStack(spacing = 8.) {
                    Button("< Back", SetPage Conversations)

                    Label(name)
                        .font(size = 20.)
                        .centerTextHorizontal()
                }

                match model.Error with
                | Some err ->
                    Label(err)
                        .textColor(Colors.Red)
                        .font(size = 11.)
                | None -> ()

                let allMessages =
                    msgs
                    |> List.map (fun m ->
                        if m.IsOutgoing then $"You: {m.Body}" else m.Body)
                    |> String.concat "\n"

                Label(if allMessages = "" then "No messages yet" else allMessages)
                    .padding(8.)
                    .font(size = 14.)

                HStack(spacing = 8.) {
                    Entry(model.Compose, SetCompose)
                        .placeholder("Message...")

                    Button("Send", DoSend)
                }
            })
                .padding(12.)
        )

    let private viewAddContact model =
        ContentPage(
            (VStack(spacing = 16.) {
                HStack(spacing = 8.) {
                    Button("< Back", SetPage Conversations)

                    Label("Add Contact")
                        .font(size = 20.)
                }

                Label("Public Key:")
                Entry(model.ContactPubkey, SetContactPubkey)
                    .placeholder("sampel-palnet-...")

                Label("Nickname:")
                Entry(model.ContactNickname, SetContactNickname)

                Button("Save Contact", DoSaveContact)
                    .centerHorizontal()
            })
                .padding(20.)
        )

    let view model =
        let page =
            match model.Page with
            | Setup -> viewSetup ()
            | Settings -> viewSettings model
            | Conversations -> viewConversations model
            | Chat pk -> viewChat model pk
            | AddContact -> viewAddContact model

        Application() { Window(page) }

    let program =
        Program.statefulWithCmdMsg init update mapCmd
        |> Program.withView view
