namespace Skrepka

open System
open System.Text.Json
open Fabulous
open Fabulous.Maui
open Microsoft.Maui.Graphics

open type Fabulous.Maui.View

module App =

    // ── Domain Types ──

    type Contact = { Pubkey: string; Nickname: string }

    type ChatMessage =
        { Id: string
          Body: string
          Timestamp: DateTimeOffset
          IsOutgoing: bool }

    type IncomingMessage =
        { FromPubkey: string
          Body: string
          Timestamp: int64
          MessageId: string }

    type Page =
        | Setup
        | Conversations
        | Chat of pubkey: string
        | AddContact
        | Settings

    type ConnState =
        | Offline
        | Connecting
        | Online of token: string

    type Identity = { PrivKey: byte[]; PubKeyHex: string }

    type Session = { Url: string; Token: string; Identity: Identity }

    // ── Model ──

    type Model =
        { Page: Page
          Identity: Identity option
          ServerUrl: string
          Conn: ConnState
          Contacts: Contact list
          PollStatus: string
          Messages: Map<string, ChatMessage list>
          ComposeText: string
          NewPubkey: string
          NewNickname: string
          Error: string option
          PollCursor: uint64
          LastSendStatus: string }

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
        | Sent of recipient: string * status: string
        | SetNewPubkey of string
        | SetNewNickname of string
        | DoSaveContact
        | DoDeleteContact of string
        | PollResult of messages: IncomingMessage list * status: string * cursor: uint64
        | DoPoll
        | CopyPubKey
        | DismissError

    // ── CmdMsg ──

    type CmdMsg =
        | CmdGenIdentity
        | CmdConnect of url: string * identity: Identity
        | CmdSend of session: Session * recipientHex: string * text: string
        | CmdPoll of session: Session * cursor: uint64
        | CmdCopyToClipboard of string

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
        match model.Identity, model.Conn with
        | Some id, Online token -> Some { Url = model.ServerUrl; Token = token; Identity = id }
        | _ -> None

    // ── Init ──

    let init () =
        { Page = Setup
          Identity = None
          ServerUrl = "http://localhost:8080"
          Conn = Offline
          PollStatus = ""
          Contacts = []
          Messages = Map.empty
          ComposeText = ""
          NewPubkey = ""
          NewNickname = ""
          Error = None
          PollCursor = 0UL
          LastSendStatus = "" },
        []

    // ── Update ──

    let update msg model =
        match msg with
        | Nav page -> { model with Page = page }, []

        | GenIdentity -> model, [ CmdGenIdentity ]

        | IdentityReady identity ->
            { model with Identity = Some identity; Page = Settings }, []

        | SetServerUrl url -> { model with ServerUrl = url }, []

        | DoConnect ->
            match model.Identity with
            | Some id ->
                { model with Conn = Connecting }, [ CmdConnect(model.ServerUrl, id) ]
            | None -> { model with Error = Some "No identity generated" }, []

        | AuthOk token ->
            match model.Identity with
            | Some id ->
                let session = { Url = model.ServerUrl; Token = token; Identity = id }
                { model with Conn = Online token; Page = Conversations; Error = None },
                [ CmdPoll(session, model.PollCursor) ]
            | None ->
                { model with Error = Some "No identity generated" }, []

        | AuthErr err -> { model with Conn = Offline; Error = Some err }, []

        | DoDisconnect -> { model with Conn = Offline }, []

        | SetCompose text -> { model with ComposeText = text }, []

        | DoSend ->
            match model.Page, trySession model with
            | Chat pk, Some session when model.ComposeText <> "" ->
                let text = model.ComposeText
                let outMsg =
                    { Id = Guid.NewGuid().ToString()
                      Body = text
                      Timestamp = DateTimeOffset.UtcNow
                      IsOutgoing = true }
                let msgs = messagesFor pk model.Messages

                { model with
                    ComposeText = ""
                    Messages = model.Messages |> Map.add pk (msgs @ [ outMsg ]) },
                [ CmdSend(session, pk, text) ]
            | _ -> model, []

        | Sent(_, status) -> { model with LastSendStatus = status }, []

        | PollResult(incoming, status, newCursor) ->
            let model' =
                incoming
                |> List.fold
                    (fun m msg ->
                        let msgs = messagesFor msg.FromPubkey m.Messages

                        if msgs |> List.exists (fun x -> x.Id = msg.MessageId) then
                            m
                        else
                            let chatMsg =
                                { Id = msg.MessageId
                                  Body = msg.Body
                                  Timestamp = DateTimeOffset.FromUnixTimeSeconds(msg.Timestamp)
                                  IsOutgoing = false }

                            { m with
                                Contacts = m.Contacts |> addContactIfNew { Pubkey = msg.FromPubkey; Nickname = truncKey msg.FromPubkey }
                                Messages = m.Messages |> Map.add msg.FromPubkey (msgs @ [ chatMsg ]) })
                    { model with PollStatus = status; PollCursor = newCursor }

            match trySession model' with
            | Some session -> model', [ CmdPoll(session, model'.PollCursor) ]
            | None -> model', []

        | DoPoll ->
            match trySession model with
            | Some session -> model, [ CmdPoll(session, model.PollCursor) ]
            | None -> model, []

        | SetNewPubkey pk -> { model with NewPubkey = pk }, []
        | SetNewNickname nn -> { model with NewNickname = nn }, []

        | DoSaveContact ->
            if model.NewPubkey <> "" && model.NewNickname <> "" then
                let contact =
                    { Pubkey = model.NewPubkey
                      Nickname = model.NewNickname }

                { model with
                    Contacts = model.Contacts |> upsertContact contact
                    NewPubkey = ""
                    NewNickname = ""
                    Page = Conversations },
                []
            else
                model, []

        | DoDeleteContact pk ->
            { model with
                Contacts = model.Contacts |> List.filter (fun c -> c.Pubkey <> pk) },
            []

        | CopyPubKey ->
            match model.Identity with
            | Some id -> model, [ CmdCopyToClipboard id.PubKeyHex ]
            | None -> model, []

        | DismissError -> { model with Error = None }, []

    // ── mapCmd ──

    let private asyncCmd (op: Async<Msg>) : Cmd<Msg> =
        Cmd.ofEffect (fun dispatch ->
            System.Threading.Tasks.Task.Run(Func<System.Threading.Tasks.Task>(fun () ->
                task {
                    let! msg = Async.StartAsTask op
                    dispatch msg
                }))
            |> ignore)

    let private decryptEvent (privKey: byte[]) (payload: JsonElement) =
        try
            let blobHex = payload.GetProperty("encryptedBlob").GetString()
            let tsEl = payload.GetProperty("timestamp")
            let ts =
                if tsEl.ValueKind = JsonValueKind.String then Int64.Parse(tsEl.GetString())
                else tsEl.GetInt64()
            let blob = Crypto.fromHex blobHex

            match Crypto.decrypt privKey blob with
            | Some(plaintext, senderHex) ->
                let ptDoc = JsonDocument.Parse(plaintext)
                let ptRoot = ptDoc.RootElement

                if ptRoot.GetProperty("type").GetString() = "text" then
                    let msgId = ptRoot.GetProperty("id").GetString()
                    let body = ptRoot.GetProperty("body").GetString()
                    Ok { FromPubkey = senderHex; Body = body; Timestamp = ts; MessageId = msgId }
                else
                    Error "unknown type"
            | None -> Error "decrypt failed"
        with ex ->
            Error $"parse: {ex.Message}"

    let mapCmd cmdMsg =
        match cmdMsg with
        | CmdGenIdentity ->
            asyncCmd (async {
                let priv, pub = Crypto.generateIdentity ()
                return IdentityReady { PrivKey = priv; PubKeyHex = Crypto.toHex pub }
            })

        | CmdConnect(url, identity) ->
            asyncCmd (async {
                try
                    let! challenge = ApiClient.requestChallenge url identity.PubKeyHex
                    let sigHex = Crypto.signChallenge identity.PrivKey challenge
                    let! (token, _) = ApiClient.verify url identity.PubKeyHex challenge sigHex

                    if String.IsNullOrEmpty(token) then
                        return AuthErr "Authentication rejected by server"
                    else
                        return AuthOk token
                with ex ->
                    return AuthErr ex.Message
            })

        | CmdSend(session, recipientHex, text) ->
            asyncCmd (async {
                try
                    let pubKey = session.Identity.PrivKey.[32..63]
                    let recipPub = Crypto.fromHex recipientHex
                    let id = Guid.NewGuid().ToString()
                    let ts = DateTimeOffset.UtcNow.ToUnixTimeSeconds()

                    let payload =
                        $"""{{ "type": "text", "id": "{id}", "timestamp": {ts}, "body": {JsonSerializer.Serialize(text)} }}"""

                    let blob = Crypto.encrypt session.Identity.PrivKey pubKey recipPub payload
                    let blobHex = Crypto.toHex blob
                    let! (status, msgId) = ApiClient.sendMessage session.Url session.Token recipientHex blobHex ts
                    return Sent(recipientHex, $"{status}:{msgId}")
                with ex ->
                    return DismissError  // TODO: show send errors properly
            })

        | CmdPoll(session, cursor) ->
            asyncCmd (async {
                try
                    let! (events, newCursor) = ApiClient.poll session.Url session.Token cursor
                    let messages = ResizeArray()
                    let ackIds = ResizeArray()
                    let errors = ResizeArray()

                    for (evtId, evtType, payload) in events do
                        if evtType = "message" then
                            match decryptEvent session.Identity.PrivKey payload with
                            | Ok msg ->
                                messages.Add(msg)
                                ackIds.Add(evtId)
                            | Error err ->
                                errors.Add(err)

                    if ackIds.Count > 0 then
                        do! ApiClient.ackMessages session.Url session.Token (Seq.toList ackIds)

                    let now = DateTimeOffset.UtcNow.ToString("HH:mm:ss")

                    let status =
                        $"[{now}] evts:{events.Length} msgs:{messages.Count} errs:{errors.Count}"
                        + (if errors.Count > 0 then $" [{errors.[0]}]" else "")

                    return PollResult(Seq.toList messages, status, newCursor)
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

                    if model.Error.IsSome then
                        Label(model.Error.Value)
                            .textColor(Colors.Red)
                            .font(size = 12.)

                        Button("Dismiss", DismissError)

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

                        Button("+", Nav AddContact)
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

                        Button($"{c.Nickname}\n{preview}", Nav(Chat c.Pubkey))
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
                    Button("< Back", Nav Conversations)

                    Label(name)
                        .font(size = 20.)
                        .centerTextHorizontal()
                }

                if model.Error.IsSome then
                    Label(model.Error.Value)
                        .textColor(Colors.Red)
                        .font(size = 11.)

                Label($"[{msgs.Length} message(s), compose: \"{model.ComposeText}\", send: \"{model.LastSendStatus}\"]")
                    .textColor(Colors.Gray)
                    .font(size = 10.)

                let allMessages =
                    msgs
                    |> List.map (fun m ->
                        if m.IsOutgoing then $"You: {m.Body}" else m.Body)
                    |> String.concat "\n"

                Label(if allMessages = "" then "No messages yet" else allMessages)
                    .padding(8.)
                    .font(size = 14.)

                HStack(spacing = 8.) {
                    Entry(model.ComposeText, SetCompose)
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
                    Button("< Back", Nav Conversations)

                    Label("Add Contact")
                        .font(size = 20.)
                }

                Label("Public Key (hex):")
                Entry(model.NewPubkey, SetNewPubkey)

                Label("Nickname:")
                Entry(model.NewNickname, SetNewNickname)

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
