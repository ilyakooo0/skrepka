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

    type Page =
        | Setup
        | Conversations
        | Chat of pubkey: string * compose: string
        | AddContact of pubkey: string * nickname: string
        | Settings

    type Session = { Url: string; Token: string; Identity: Identity }

    type ConnStatus =
        | Offline
        | Connecting
        | Online of token: string

    type AuthState =
        | NoIdentity
        | Identified of identity: Identity * conn: ConnStatus

    type IncomingMessage = { SenderPubkey: string; Message: ChatMessage }

    type DecryptedEvent =
        | IncomingChat of IncomingMessage
        | IncomingDeliveryAck of senderPubkey: string * ackIds: string list

    type PollReceived = { Events: int; Messages: int; Errors: int; FirstError: string option }

    type PollStatus =
        | Idle
        | Polling
        | Received of PollReceived
        | PollError of string

    // ── Model ──

    type Model =
        { Page: Page
          Auth: AuthState
          ServerUrl: string
          Contacts: Contact list
          PollStatus: PollStatus
          Messages: Map<string, ChatMessage list>
          Error: string option
          PollCursor: int64 }

    // ── Msg ──

    type StateLoadResult =
        | IdentityAndData of Identity * Data
        | IdentityOnly of Identity
        | NothingSaved

    type Msg =
        | SetPage of Page
        | SetCompose of string
        | SetContactPubkey of string
        | SetContactNickname of string
        | GenIdentity
        | SetServerUrl of string
        | DoConnect
        | AuthOk of string
        | AuthErr of string
        | DoDisconnect
        | DoSend
        | SendFailed of string
        | SendOk
        | DoSaveContact
        | PollResult of events: DecryptedEvent list * status: PollStatus * cursor: int64
        | CopyPubKey
        | DismissError
        | StateLoaded of StateLoadResult

    // ── CmdMsg ──

    type CmdMsg =
        | CmdConnect of url: string * identity: Identity
        | CmdSend of session: Session * recipientHex: string * text: string * messageId: string
        | CmdPoll of session: Session * cursor: int64
        | CmdCopyToClipboard of string
        | CmdLoadState
        | CmdSaveIdentity of Identity
        | CmdSaveData of Data

    // ── Helpers ──

    let private hexToOb (hex: string) =
        Crypto.fromHex hex |> Phonemic.toOb

    let private truncOb (ob: string) =
        let parts = ob.Split('-')

        if parts.Length <= 4 then
            ob
        else
            $"{parts.[0]}-{parts.[1]}..{parts.[parts.Length - 2]}-{parts.[parts.Length - 1]}"

    let private truncKey (hex: string) = hexToOb hex |> truncOb

    let private tryParsePubkey (input: string) =
        let input = input.Trim()
        Phonemic.fromOb input
        |> Option.orElseWith (fun () -> Crypto.tryFromHex input)
        |> Option.filter (fun bytes -> bytes.Length = 32)

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

    let private markDelivered (pk: string) (ackIds: string list) (messages: Map<string, ChatMessage list>) =
        match Map.tryFind pk messages with
        | Some msgs ->
            msgs
            |> List.map (fun m -> if m.IsOutgoing && List.contains m.Id ackIds then { m with Status = DeliveryStatus.Delivered } else m)
            |> fun updated -> Map.add pk updated messages
        | None -> messages

    let private addContactIfNew (contact: Contact) (contacts: Contact list) =
        if contacts |> List.exists (fun c -> c.Pubkey = contact.Pubkey) then contacts
        else contacts @ [ contact ]

    let private upsertContact (contact: Contact) (contacts: Contact list) =
        match contacts |> List.tryFindIndex (fun c -> c.Pubkey = contact.Pubkey) with
        | Some i -> contacts |> List.updateAt i contact
        | None -> contacts @ [ contact ]

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

    let private connStatusLabel = function
        | NoIdentity | Identified(_, Offline) -> "OFFLINE"
        | Identified(_, Connecting) -> "CONNECTING"
        | Identified(_, Online _) -> "ONLINE"

    // ── Init ──

    let init () =
        { Page = Setup
          Auth = NoIdentity
          ServerUrl = "http://localhost:8080"
          PollStatus = Idle
          Contacts = []
          Messages = Map.empty
          Error = None
          PollCursor = 0L },
        [ CmdLoadState ]

    // ── Update ──

    let update msg model =
        match msg with
        | SetPage page -> { model with Page = page }, []

        | SetCompose text ->
            match model.Page with
            | Chat(pk, _) -> { model with Page = Chat(pk, text) }, []
            | _ -> model, []
        | SetContactPubkey pk ->
            match model.Page with
            | AddContact(_, nn) -> { model with Page = AddContact(pk, nn) }, []
            | _ -> model, []
        | SetContactNickname nn ->
            match model.Page with
            | AddContact(pk, _) -> { model with Page = AddContact(pk, nn) }, []
            | _ -> model, []

        | GenIdentity ->
            let identity = Crypto.generateIdentity ()
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
            | Chat(pk, compose), Some session when compose <> "" ->
                let id = Guid.NewGuid().ToString()
                let outMsg =
                    { Id = id
                      Body = compose
                      Timestamp = DateTimeOffset.UtcNow
                      IsOutgoing = true
                      Status = DeliveryStatus.Sent }

                let model' =
                    { model with
                        Page = Chat(pk, "")
                        Messages = model.Messages |> appendMessage pk outMsg }

                model', [ CmdSend(session, pk, compose, id); saveCmdMsg model' ]
            | _ -> model, []

        | SendFailed err -> { model with Error = Some err }, []
        | SendOk -> model, []

        | PollResult(events, status, newCursor) ->
            let model' =
                events
                |> List.fold
                    (fun (m: Model) evt ->
                        match evt with
                        | IncomingChat msg ->
                            { m with
                                Contacts = m.Contacts |> addContactIfNew { Pubkey = msg.SenderPubkey; Nickname = truncKey msg.SenderPubkey }
                                Messages = m.Messages |> appendMessage msg.SenderPubkey msg.Message }
                        | IncomingDeliveryAck(senderPubkey, ackIds) ->
                            { m with Messages = m.Messages |> markDelivered senderPubkey ackIds })
                    { model with PollStatus = status; PollCursor = newCursor }

            model',
            [ match trySession model' with
              | Some session -> CmdPoll(session, model'.PollCursor)
              | None -> ()
              if not events.IsEmpty then saveCmdMsg model' ]

        | DoSaveContact ->
            match model.Page with
            | AddContact(cpk, cnn) when cpk <> "" && cnn <> "" ->
                match tryParsePubkey cpk with
                | Some bytes ->
                    let contact: Contact = { Pubkey = Crypto.toHex bytes; Nickname = cnn }

                    let model' =
                        { model with
                            Contacts = model.Contacts |> upsertContact contact
                            Page = Conversations }

                    model', [ saveCmdMsg model' ]
                | None -> { model with Error = Some "Invalid public key" }, []
            | _ -> model, []

        | CopyPubKey ->
            match model.Auth with
            | Identified(id, _) -> model, [ CmdCopyToClipboard(hexToOb id.PubKeyHex) ]
            | NoIdentity -> model, []

        | DismissError -> { model with Error = None }, []

        | StateLoaded(IdentityAndData(identity, data)) ->
            let model' =
                { model with
                    Auth = Identified(identity, Connecting)
                    Contacts = data.Contacts
                    Messages = data.Messages
                    ServerUrl = data.ServerUrl |> Option.defaultValue model.ServerUrl
                    PollCursor = data.PollCursor
                    Page = Conversations }
            model', [ CmdConnect(model'.ServerUrl, identity) ]
        | StateLoaded(IdentityOnly identity) ->
            { model with Auth = Identified(identity, Offline); Page = Settings }, []
        | StateLoaded NothingSaved -> model, []

    // ── mapCmd ──

    let private asyncCmd (op: Async<Msg>) : Cmd<Msg> =
        Cmd.ofEffect (fun dispatch ->
            async {
                let! msg = op
                dispatch msg
            }
            |> Async.Start)

    type private Envelope =
        | TextMessage of id: string * body: string
        | DeliveryAck of id: string * ackIds: string list

    let private serializeEnvelope = function
        | TextMessage(id, body) ->
            JsonSerializer.Serialize({| ``type`` = "text"; id = id; body = body |})
        | DeliveryAck(id, ackIds) ->
            JsonSerializer.Serialize({| ``type`` = "delivery.ack"; id = id; ack_ids = ackIds |})

    let private parseEnvelope (json: string) =
        use doc = JsonDocument.Parse(json)
        let root = doc.RootElement
        match root.GetProperty("type").GetString() with
        | "text" ->
            Some(TextMessage(root.GetProperty("id").GetString(), root.GetProperty("body").GetString()))
        | "delivery.ack" ->
            let ackIds = root.GetProperty("ack_ids").EnumerateArray() |> Seq.map _.GetString() |> Seq.toList
            Some(DeliveryAck(root.GetProperty("id").GetString(), ackIds))
        | _ -> None

    let private decryptEvent (privKey: byte[]) (payload: EventPayload) =
        try
            let blob = Crypto.fromHex payload.EncryptedBlob

            match Crypto.decrypt privKey blob with
            | Some(plaintext, senderHex) ->
                match parseEnvelope plaintext with
                | Some(TextMessage(id, body)) ->
                    Ok(IncomingChat
                        { SenderPubkey = senderHex
                          Message =
                            { Id = id; Body = body
                              Timestamp = DateTimeOffset.FromUnixTimeSeconds(payload.Timestamp)
                              IsOutgoing = false
                              Status = DeliveryStatus.Delivered } })
                | Some(DeliveryAck(_, ackIds)) ->
                    Ok(IncomingDeliveryAck(senderHex, ackIds))
                | None -> Error "unknown envelope type"
            | None -> Error "decrypt failed"
        with ex ->
            Error $"parse: {ex.Message}"

    let private sendDeliveryAcks (session: Session) (events: DecryptedEvent list) =
        async {
            let chatsBySender =
                events
                |> List.choose (function IncomingChat msg -> Some(msg.SenderPubkey, msg.Message.Id) | _ -> None)
                |> List.groupBy fst
                |> List.map (fun (sender, pairs) -> sender, List.map snd pairs)

            for sender, msgIds in chatsBySender do
                try
                    let ackPayload = serializeEnvelope (DeliveryAck(Guid.NewGuid().ToString(), msgIds))
                    let blob = Crypto.encrypt session.Identity.PrivKey (Crypto.fromHex sender) ackPayload
                    do! sendMessage session.Url session.Token sender (Crypto.toHex blob) (DateTimeOffset.UtcNow.ToUnixTimeSeconds()) |> Async.Ignore
                with _ -> ()
        }

    let mapCmd cmdMsg =
        match cmdMsg with
        | CmdConnect(url, identity) ->
            asyncCmd (async {
                try
                    let! token = authenticate url identity
                    return AuthOk token
                with ex ->
                    return AuthErr ex.Message
            })

        | CmdSend(session, recipientHex, text, messageId) ->
            asyncCmd (async {
                try
                    let recipPub = Crypto.fromHex recipientHex
                    let ts = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
                    let payload = serializeEnvelope (TextMessage(messageId, text))
                    let blob = Crypto.encrypt session.Identity.PrivKey recipPub payload
                    let! status = sendMessage session.Url session.Token recipientHex (Crypto.toHex blob) ts

                    match messageStatusToError status with
                    | Some err -> return SendFailed err
                    | None -> return SendOk
                with ex ->
                    return SendFailed $"Send failed: {ex.Message}"
            })

        | CmdPoll(session, cursor) ->
            asyncCmd (async {
                try
                    let! response = poll session.Url session.Token cursor
                    let ackIds = response.Events |> Array.map _.Id |> Array.toList

                    let events, errors =
                        Array.foldBack
                            (fun (evt: PollEvent) (evts, errs) ->
                                match evt.EventType with
                                | Message ->
                                    match decryptEvent session.Identity.PrivKey evt.Payload with
                                    | Ok event -> (event :: evts, errs)
                                    | Error err -> (evts, err :: errs)
                                | UnknownEvent _ -> (evts, errs))
                            response.Events
                            ([], [])

                    if not ackIds.IsEmpty then
                        try do! ackMessages session.Url session.Token ackIds
                        with _ -> ()

                    do! sendDeliveryAcks session events

                    let chatCount = events |> List.sumBy (function IncomingChat _ -> 1 | _ -> 0)
                    let status = Received { Events = response.Events.Length; Messages = chatCount; Errors = errors.Length; FirstError = List.tryHead errors }
                    return PollResult(events, status, response.Cursor)
                with
                | :? TimeoutException ->
                    return PollResult([], Polling, cursor)
                | ex ->
                    do! Async.Sleep 3000
                    return PollResult([], PollError ex.Message, cursor)
            })

        | CmdCopyToClipboard text ->
            Cmd.ofEffect (fun _ ->
                Microsoft.Maui.ApplicationModel.DataTransfer.Clipboard.Default.SetTextAsync(text)
                |> ignore)

        | CmdLoadState ->
            asyncCmd (async {
                match! Store.loadIdentity () with
                | Some id ->
                    return StateLoaded(
                        match Store.loadData () with
                        | Some data -> IdentityAndData(id, data)
                        | None -> IdentityOnly id)
                | None -> return StateLoaded NothingSaved
            })

        | CmdSaveIdentity identity ->
            Cmd.ofEffect (fun _ -> Store.saveIdentity identity |> Async.Start)

        | CmdSaveData data ->
            Cmd.ofEffect (fun _ -> Store.saveData data)

    // ── View ──

    let private formatPollStatus = function
        | Idle -> ""
        | Polling -> "polling..."
        | Received r ->
            $"evts:{r.Events} msgs:{r.Messages} errs:{r.Errors}"
            + (match r.FirstError with Some e -> $" [{e}]" | None -> "")
        | PollError msg -> $"poll error: {msg}"

    let private viewErrorBanner (error: string option) =
        VStack(spacing = 4.) {
            match error with
            | Some err ->
                Label(err).textColor(Colors.Red).font(size = 12.)
                Button("Dismiss", DismissError)
            | None -> ()
        }

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

                    match model.Auth with
                    | Identified(id, conn) ->
                        Label("Your Public Key:")

                        Label(truncOb (hexToOb id.PubKeyHex))
                            .font(size = 14.)

                        Button("Copy Public Key", CopyPubKey)

                        Label("Server:")

                        match conn with
                        | Online _ -> Label(model.ServerUrl).font(size = 14.)
                        | _ -> Entry(model.ServerUrl, SetServerUrl)

                        viewErrorBanner model.Error

                        match conn with
                        | Offline -> Button("Connect", DoConnect)
                        | Connecting -> Label("Connecting...").centerTextHorizontal()
                        | Online _ ->
                            Button("Disconnect", DoDisconnect)
                            Button("Go to Conversations", SetPage Conversations)
                    | NoIdentity -> ()
                })
                    .padding(20.)
            )
        )

    let private viewConversations model =
        ContentPage(
            ScrollView(
                (VStack(spacing = 8.) {
                    HStack(spacing = 8.) {
                        Label("Conversations")
                            .font(size = 24.)

                        Button("+", SetPage(AddContact("", "")))
                        Button("Settings", SetPage Settings)
                    }

                    Label($"{connStatusLabel model.Auth} | {formatPollStatus model.PollStatus}")
                        .font(size = 10.)
                        .textColor(Colors.DimGray)

                    viewErrorBanner model.Error

                    if model.Contacts.IsEmpty then
                        Label("No contacts yet. Tap + to add one.")
                            .centerTextHorizontal()
                            .textColor(Colors.Gray)

                    for c in model.Contacts do
                        let preview =
                            messagesFor c.Pubkey model.Messages
                            |> List.tryLast
                            |> Option.map (fun m -> if m.Body.Length > 40 then m.Body.[..39] + "..." else m.Body)
                            |> Option.defaultValue ""

                        Button($"{c.Nickname}\n{preview}", SetPage(Chat(c.Pubkey, "")))
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
                    Button("< Back", SetPage Conversations)

                    Label(name)
                        .font(size = 20.)
                        .centerTextHorizontal()
                }

                viewErrorBanner model.Error

                if msgs.IsEmpty then
                    Label("No messages yet")
                        .padding(8.)
                        .font(size = 14.)
                else
                    for m in msgs do
                        let tick = if m.IsOutgoing && m.Status = DeliveryStatus.Delivered then " \u2713" else ""
                        Label((if m.IsOutgoing then $"You: {m.Body}" else m.Body) + tick)
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

    let private viewAddContact model cpk cnn =
        ContentPage(
            (VStack(spacing = 16.) {
                HStack(spacing = 8.) {
                    Button("< Back", SetPage Conversations)

                    Label("Add Contact")
                        .font(size = 20.)
                }

                viewErrorBanner model.Error

                Label("Public Key:")
                Entry(cpk, SetContactPubkey)
                    .placeholder("sampel-palnet-...")

                Label("Nickname:")
                Entry(cnn, SetContactNickname)

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
            | AddContact(pk, nn) -> viewAddContact model pk nn

        Application() { Window(page) }

    let program =
        Program.statefulWithCmdMsg init update mapCmd
        |> Program.withView view
