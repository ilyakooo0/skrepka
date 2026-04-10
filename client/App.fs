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

    // ── Domain Types ──

    [<CLIMutable>]
    type private TextEnvelope =
        { [<JsonPropertyName("type")>] Type: string
          [<JsonPropertyName("id")>] Id: string
          [<JsonPropertyName("timestamp")>] Timestamp: int64
          [<JsonPropertyName("body")>] Body: string }

    type Page =
        | Setup
        | Conversations
        | Chat of pubkey: string * compose: string
        | AddContact of pubkey: string * nickname: string
        | Settings

    type Session = { Url: string; Token: string; Identity: Identity }

    type ConnState =
        | Offline
        | Connecting
        | Online of Session

    // ── Model ──

    type Model =
        { Page: Page
          Identity: Identity option
          ServerUrl: string
          Conn: ConnState
          Contacts: Contact list
          PollStatus: string
          Messages: Map<string, ChatMessage list>
          Error: string option
          PollCursor: int64 }

    // ── Msg ──

    type Msg =
        | Nav of Page
        | GenIdentity
        | IdentityReady of Identity
        | SetServerUrl of string
        | DoConnect
        | AuthOk of string
        | AuthErr of string
        | DoDisconnect
        | SetCompose of string
        | DoSend
        | Sent of Result<ApiClient.SendResult, string>
        | SetNewPubkey of string
        | SetNewNickname of string
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

    let private truncKey (hex: string) =
        if hex.Length > 16 then hex.[..15] + "..." else hex

    let private contactName (contacts: Contact list) (pk: string) =
        contacts
        |> List.tryFind (fun c -> c.Pubkey = pk)
        |> Option.map _.Nickname
        |> Option.defaultValue (truncKey pk)

    let private messagesFor (pk: string) (messages: Map<string, ChatMessage list>) =
        messages |> Map.tryFind pk |> Option.defaultValue []

    let private appendMessage (pk: string) (msg: ChatMessage) (messages: Map<string, ChatMessage list>) =
        messages |> Map.add pk (messagesFor pk messages @ [ msg ])

    let private addContactIfNew (contact: Contact) (contacts: Contact list) =
        if contacts |> List.exists (fun c -> c.Pubkey = contact.Pubkey) then contacts
        else contacts @ [ contact ]

    let private upsertContact (contact: Contact) (contacts: Contact list) =
        if contacts |> List.exists (fun c -> c.Pubkey = contact.Pubkey) then
            contacts |> List.map (fun c -> if c.Pubkey = contact.Pubkey then contact else c)
        else
            contacts @ [ contact ]

    let private pubKeyHex model =
        model.Identity |> Option.map _.PubKeyHex |> Option.defaultValue ""

    let private trySession model =
        match model.Conn with
        | Online session -> Some session
        | _ -> None

    let private saveCmd model =
        [ CmdSaveData { Contacts = model.Contacts; Messages = model.Messages; ServerUrl = model.ServerUrl; PollCursor = model.PollCursor } ]

    // ── Init ──

    let init () =
        { Page = Setup
          Identity = None
          ServerUrl = "http://localhost:8080"
          Conn = Offline
          PollStatus = ""
          Contacts = []
          Messages = Map.empty
          Error = None
          PollCursor = 0L },
        [ CmdLoadState ]

    // ── Update ──

    let update msg model =
        match msg with
        | Nav page -> { model with Page = page }, []

        | GenIdentity -> model, [ CmdGenIdentity ]

        | IdentityReady identity ->
            { model with Identity = Some identity; Page = Settings },
            [ CmdSaveIdentity identity ]

        | SetServerUrl url -> { model with ServerUrl = url }, []

        | DoConnect ->
            match model.Identity with
            | Some id ->
                { model with Conn = Connecting }, [ CmdConnect(model.ServerUrl, id) ]
            | None -> { model with Error = Some "No identity generated" }, []

        | AuthOk token ->
            match model.Identity, model.Conn with
            | Some id, Connecting ->
                let session = { Url = model.ServerUrl; Token = token; Identity = id }
                { model with Conn = Online session; Page = Conversations; Error = None },
                [ CmdPoll(session, model.PollCursor) ]
            | _ -> model, []

        | AuthErr err -> { model with Conn = Offline; Error = Some err }, []

        | DoDisconnect -> { model with Conn = Offline }, []

        | SetCompose text ->
            match model.Page with
            | Chat(pk, _) -> { model with Page = Chat(pk, text) }, []
            | _ -> model, []

        | DoSend ->
            match model.Page, trySession model with
            | Chat(pk, compose), Some session when compose <> "" ->
                let id = Guid.NewGuid().ToString()
                let outMsg =
                    { Id = id
                      Body = compose
                      Timestamp = DateTimeOffset.UtcNow
                      IsOutgoing = true }

                let model' =
                    { model with
                        Page = Chat(pk, "")
                        Messages = model.Messages |> appendMessage pk outMsg }

                model', CmdSend(session, pk, compose, id) :: saveCmd model'
            | _ -> model, []

        | Sent(Ok _) -> model, []
        | Sent(Error err) -> { model with Error = Some $"Send failed: {err}" }, []

        | PollResult(incoming, status, newCursor) ->
            let model' =
                incoming
                |> List.fold
                    (fun m (fromPubkey, chatMsg) ->
                        if messagesFor fromPubkey m.Messages |> List.exists (fun x -> x.Id = chatMsg.Id) then
                            m
                        else
                            { m with
                                Contacts = m.Contacts |> addContactIfNew { Pubkey = fromPubkey; Nickname = truncKey fromPubkey }
                                Messages = m.Messages |> appendMessage fromPubkey chatMsg })
                    { model with PollStatus = status; PollCursor = newCursor }

            let cmds =
                match trySession model' with
                | Some session -> [ CmdPoll(session, model'.PollCursor) ]
                | None -> []

            model', cmds @ (if not incoming.IsEmpty then saveCmd model' else [])

        | SetNewPubkey pk ->
            match model.Page with
            | AddContact(_, nn) -> { model with Page = AddContact(pk, nn) }, []
            | _ -> model, []

        | SetNewNickname nn ->
            match model.Page with
            | AddContact(pk, _) -> { model with Page = AddContact(pk, nn) }, []
            | _ -> model, []

        | DoSaveContact ->
            match model.Page with
            | AddContact(pk, nn) when pk <> "" && nn <> "" ->
                let contact: Contact = { Pubkey = pk; Nickname = nn }

                let model' =
                    { model with
                        Contacts = model.Contacts |> upsertContact contact
                        Page = Conversations }

                model', saveCmd model'
            | _ -> model, []

        | CopyPubKey ->
            match model.Identity with
            | Some id -> model, [ CmdCopyToClipboard id.PubKeyHex ]
            | None -> model, []

        | DismissError -> { model with Error = None }, []

        | StateLoaded(identity, dataOpt) ->
            let model' = { model with Identity = Some identity; Conn = Connecting }

            let model' =
                match dataOpt with
                | Some data ->
                    { model' with
                        Contacts = data.Contacts
                        Messages = data.Messages
                        ServerUrl = if data.ServerUrl <> "" then data.ServerUrl else model.ServerUrl
                        PollCursor = data.PollCursor
                        Page = Conversations }

                | None -> { model' with Page = Settings }

            model', [ CmdConnect(model'.ServerUrl, identity) ]

    // ── mapCmd ──

    let private asyncCmd (op: Async<Msg>) : Cmd<Msg> =
        Cmd.ofEffect (fun dispatch ->
            async {
                let! msg = op
                dispatch msg
            }
            |> Async.Start)

    let private decryptEvent (privKey: byte[]) (payload: ApiClient.EventPayload) =
        try
            let blob = Crypto.fromHex payload.EncryptedBlob

            match Crypto.decrypt privKey blob with
            | Some(plaintext, senderHex) ->
                let envelope = JsonSerializer.Deserialize<TextEnvelope>(plaintext)

                if envelope.Type = "text" then
                    Ok(senderHex,
                       { Id = envelope.Id
                         Body = envelope.Body
                         Timestamp = DateTimeOffset.FromUnixTimeSeconds(payload.Timestamp)
                         IsOutgoing = false })
                else
                    Error "unknown type"
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
                    let! token = ApiClient.authenticate url identity
                    return AuthOk token
                with ex ->
                    return AuthErr ex.Message
            })

        | CmdSend(session, recipientHex, text, messageId) ->
            asyncCmd (async {
                try
                    let recipPub = Crypto.fromHex recipientHex
                    let ts = DateTimeOffset.UtcNow.ToUnixTimeSeconds()

                    let payload =
                        JsonSerializer.Serialize({ Type = "text"; Id = messageId; Timestamp = ts; Body = text }: TextEnvelope)

                    let blob = Crypto.encrypt session.Identity.PrivKey recipPub payload
                    let blobHex = Crypto.toHex blob
                    let! result = ApiClient.sendMessage session.Url session.Token recipientHex blobHex ts
                    return Sent(Ok result)
                with ex ->
                    return Sent(Error ex.Message)
            })

        | CmdPoll(session, cursor) ->
            asyncCmd (async {
                try
                    let! response = ApiClient.poll session.Url session.Token cursor
                    let messages, ackIds, errors =
                        response.Events
                        |> Array.fold (fun (msgs, acks, errs) evt ->
                            match decryptEvent session.Identity.PrivKey evt.Payload with
                            | Ok msg -> (msg :: msgs, evt.Id :: acks, errs)
                            | Error err -> (msgs, acks, err :: errs))
                            ([], [], [])

                    if not ackIds.IsEmpty then
                        do! ApiClient.ackMessages session.Url session.Token ackIds

                    let now = DateTimeOffset.UtcNow.ToString("HH:mm:ss")

                    let status =
                        $"[{now}] evts:{response.Events.Length} msgs:{messages.Length} errs:{errors.Length}"
                        + (match errors with err :: _ -> $" [{err}]" | [] -> "")

                    return PollResult(List.rev messages, status, response.Cursor)
                with
                | :? TimeoutException ->
                    return PollResult([], "polling...", cursor)
                | ex ->
                    let now = DateTimeOffset.UtcNow.ToString("HH:mm:ss")
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
                    let! identity = Store.loadIdentity ()
                    match identity with
                    | Some id ->
                        let data = Store.loadData ()
                        dispatch (StateLoaded(id, data))
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

                    Label(pubKeyHex model)
                        .font(size = 9.)

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

                    match model.Conn with
                    | Offline -> Button("Connect", DoConnect)
                    | Connecting -> Label("Connecting...").centerTextHorizontal()
                    | Online _ ->
                        Button("Disconnect", DoDisconnect)
                        Button("Go to Conversations", Nav Conversations)
                })
                    .padding(20.)
            )
        )

    let private viewConversations model =
        let connStr =
            match model.Conn with
            | Offline -> "OFFLINE"
            | Connecting -> "CONNECTING"
            | Online _ -> "ONLINE"

        let contactNames =
            model.Contacts
            |> List.map _.Nickname
            |> String.concat ", "

        let totalMsgs =
            model.Messages |> Map.fold (fun acc _ msgs -> acc + List.length msgs) 0

        ContentPage(
            ScrollView(
                (VStack(spacing = 8.) {
                    HStack(spacing = 8.) {
                        Label("Conversations")
                            .font(size = 24.)

                        Button("+", Nav(AddContact("", "")))
                        Button("Settings", Nav Settings)
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
                        let lastMsg =
                            model.Messages
                            |> Map.tryFind c.Pubkey
                            |> Option.bind List.tryLast
                            |> Option.map _.Body
                            |> Option.defaultValue ""

                        let preview =
                            if lastMsg.Length > 40 then lastMsg.[..39] + "..." else lastMsg

                        Button($"{c.Nickname}\n{preview}", Nav(Chat(c.Pubkey, "")))
                })
                    .padding(20.)
            )
        )

    let private viewChat model pk compose =
        let name = contactName model.Contacts pk
        let msgs = messagesFor pk model.Messages

        ContentPage(
            (VStack(spacing = 8.) {
                HStack(spacing = 8.) {
                    Button("< Back", Nav Conversations)

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
                    Entry(compose, SetCompose)
                        .placeholder("Message...")

                    Button("Send", DoSend)
                }
            })
                .padding(12.)
        )

    let private viewAddContact pk nn =
        ContentPage(
            (VStack(spacing = 16.) {
                HStack(spacing = 8.) {
                    Button("< Back", Nav Conversations)

                    Label("Add Contact")
                        .font(size = 20.)
                }

                Label("Public Key (hex):")
                Entry(pk, SetNewPubkey)

                Label("Nickname:")
                Entry(nn, SetNewNickname)

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
            | Chat(pk, compose) -> viewChat model pk compose
            | AddContact(pk, nn) -> viewAddContact pk nn

        Application() { Window(page) }

    let program =
        Program.statefulWithCmdMsg init update mapCmd
        |> Program.withView view
