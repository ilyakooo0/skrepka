namespace Skrepka

open System
open System.IO
open System.Text.Json
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
        | EditProfile of displayName: string * bio: string * photo: string

    type Session = { Url: string; Token: string; Identity: Identity }

    type ConnStatus =
        | Offline
        | Connecting
        | Online of token: string

    type AuthState =
        | NoIdentity
        | Identified of identity: Identity * conn: ConnStatus

    type DecryptedEvent =
        | IncomingChat of senderPubkey: string * message: ChatMessage
        | IncomingDeliveryAck of senderPubkey: string * ackIds: string list
        | IncomingProfile of senderPubkey: string * profile: Profile

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
          Contacts: Map<string, Contact>
          PollStatus: PollStatus
          Messages: Map<string, ChatMessage list>
          Error: string option
          PollCursor: int64
          Profile: Profile option }

    // ── Msg ──

    type StateLoadResult =
        | Loaded of Identity * Data option * Profile option
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
        | SetProfileDisplayName of string
        | SetProfileBio of string
        | DoPickPhoto
        | PhotoPicked of string
        | DoSaveProfile

    // ── CmdMsg ──

    type CmdMsg =
        | CmdConnect of url: string * identity: Identity
        | CmdSend of session: Session * recipientHex: string * text: string * messageId: string
        | CmdPoll of session: Session * cursor: int64
        | CmdCopyToClipboard of string
        | CmdLoadState
        | CmdSaveIdentity of Identity
        | CmdSaveData of Data
        | CmdPickPhoto
        | CmdSaveProfile of Profile
        | CmdSendProfileToAll of session: Session * Profile * recipientHexes: string list

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

    let private contactName (contacts: Map<string, Contact>) (pk: string) =
        let fallback = truncKey pk
        contacts
        |> Map.tryFind pk
        |> Option.map (fun c ->
            if c.Nickname <> fallback then c.Nickname
            elif c.DisplayName <> "" then c.DisplayName
            else fallback)
        |> Option.defaultValue fallback

    let private messagesFor (pk: string) (messages: Map<string, ChatMessage list>) =
        messages |> Map.tryFind pk |> Option.defaultValue []

    let private appendMessage (pk: string) (msg: ChatMessage) (messages: Map<string, ChatMessage list>) =
        let existing = messagesFor pk messages
        if existing |> List.exists (fun m -> m.Id = msg.Id) then messages
        else Map.add pk (existing @ [ msg ]) messages

    let private markDelivered (pk: string) (ackIds: string list) (messages: Map<string, ChatMessage list>) =
        let ackSet = Set.ofList ackIds
        messages |> Map.change pk (Option.map (List.map (fun m ->
            if m.IsOutgoing && Set.contains m.Id ackSet then { m with Status = DeliveryStatus.Delivered } else m)))

    let private newContact pubkey nickname : Contact =
        { Pubkey = pubkey; Nickname = nickname; DisplayName = ""; Bio = ""; PhotoBase64 = "" }

    let private withProfile (p: Profile) (c: Contact) =
        { c with DisplayName = p.DisplayName; Bio = p.Bio; PhotoBase64 = p.PhotoBase64 }

    let private applyEvent (m: Model) = function
        | IncomingChat(senderPubkey, message) ->
            { m with
                Contacts =
                    if Map.containsKey senderPubkey m.Contacts then m.Contacts
                    else Map.add senderPubkey (newContact senderPubkey (truncKey senderPubkey)) m.Contacts
                Messages = m.Messages |> appendMessage senderPubkey message }
        | IncomingDeliveryAck(senderPubkey, ackIds) ->
            { m with Messages = m.Messages |> markDelivered senderPubkey ackIds }
        | IncomingProfile(senderPubkey, profile) ->
            { m with Contacts = m.Contacts |> Map.change senderPubkey (Option.map (withProfile profile)) }

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
          Contacts = Map.empty
          Messages = Map.empty
          Error = None
          PollCursor = 0L
          Profile = None },
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

                let isFirstInteraction = model.Messages |> messagesFor pk |> List.isEmpty

                let model' =
                    { model with
                        Page = Chat(pk, "")
                        Messages = model.Messages |> appendMessage pk outMsg }

                model',
                [ CmdSend(session, pk, compose, id)
                  saveCmdMsg model'
                  match model.Profile, isFirstInteraction with
                  | Some profile, true -> CmdSendProfileToAll(session, profile, [ pk ])
                  | _ -> () ]
            | _ -> model, []

        | SendFailed err -> { model with Error = Some err }, []
        | SendOk -> model, []

        | PollResult(events, status, newCursor) ->
            let model' = events |> List.fold applyEvent { model with PollStatus = status; PollCursor = newCursor }

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
                    let hex = Crypto.toHex bytes
                    let contact =
                        match Map.tryFind hex model.Contacts with
                        | Some e -> { e with Nickname = cnn }
                        | None -> newContact hex cnn

                    let model' =
                        { model with
                            Contacts = Map.add hex contact model.Contacts
                            Page = Conversations }

                    model', [ saveCmdMsg model' ]
                | None -> { model with Error = Some "Invalid public key" }, []
            | _ -> model, []

        | CopyPubKey ->
            match model.Auth with
            | Identified(id, _) -> model, [ CmdCopyToClipboard(hexToOb id.PubKeyHex) ]
            | NoIdentity -> model, []

        | DismissError -> { model with Error = None }, []

        | SetProfileDisplayName name ->
            match model.Page with
            | EditProfile(_, bio, photo) -> { model with Page = EditProfile(name, bio, photo) }, []
            | _ -> model, []

        | SetProfileBio bio ->
            match model.Page with
            | EditProfile(name, _, photo) -> { model with Page = EditProfile(name, bio, photo) }, []
            | _ -> model, []

        | DoPickPhoto -> model, [ CmdPickPhoto ]

        | PhotoPicked photo ->
            match model.Page with
            | EditProfile(name, bio, _) -> { model with Page = EditProfile(name, bio, photo) }, []
            | _ -> model, []

        | DoSaveProfile ->
            match model.Page with
            | EditProfile(name, bio, photo) ->
                let profile: Profile = { DisplayName = name; Bio = bio; PhotoBase64 = photo }
                { model with Profile = Some profile; Page = Settings },
                [ CmdSaveProfile profile
                  match trySession model with
                  | Some session -> CmdSendProfileToAll(session, profile, model.Contacts.Keys |> Seq.toList)
                  | None -> () ]
            | _ -> model, []

        | StateLoaded(Loaded(identity, Some data, profile)) ->
            let model' =
                { model with
                    Auth = Identified(identity, Connecting)
                    Contacts = data.Contacts
                    Messages = data.Messages
                    ServerUrl = data.ServerUrl |> Option.defaultValue model.ServerUrl
                    PollCursor = data.PollCursor
                    Profile = profile
                    Page = Conversations }
            model', [ CmdConnect(model'.ServerUrl, identity) ]
        | StateLoaded(Loaded(identity, None, profile)) ->
            { model with Auth = Identified(identity, Offline); Profile = profile; Page = Settings }, []
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
        | DeliveryAck of ackIds: string list
        | ProfileMessage of profile: Profile

    let private serializeEnvelope = function
        | TextMessage(id, body) ->
            JsonSerializer.Serialize({| ``type`` = "text"; id = id; body = body |})
        | DeliveryAck ackIds ->
            JsonSerializer.Serialize({| ``type`` = "delivery.ack"; id = Guid.NewGuid().ToString(); ack_ids = ackIds |})
        | ProfileMessage profile ->
            JsonSerializer.Serialize({| ``type`` = "profile"; id = Guid.NewGuid().ToString(); timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(); display_name = profile.DisplayName; bio = profile.Bio; photo = profile.PhotoBase64 |})

    let private sendEnvelope (session: Session) (recipientHex: string) (envelope: Envelope) =
        async {
            let payload = serializeEnvelope envelope
            let blob = Crypto.encrypt session.Identity.PrivKey (Crypto.fromHex recipientHex) payload
            let ts = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
            return! sendMessage session.Url session.Token recipientHex (Crypto.toHex blob) ts
        }

    let private tryGetJsonString (el: JsonElement) (name: string) =
        match el.TryGetProperty(name) with
        | true, v when v.ValueKind <> JsonValueKind.Null -> Some(v.GetString())
        | _ -> None

    let private parseEnvelope (json: string) =
        use doc = JsonDocument.Parse(json)
        let root = doc.RootElement
        match root.GetProperty("type").GetString() with
        | "text" ->
            Some(TextMessage(root.GetProperty("id").GetString(), root.GetProperty("body").GetString()))
        | "delivery.ack" ->
            let ackIds = root.GetProperty("ack_ids").EnumerateArray() |> Seq.map _.GetString() |> Seq.toList
            Some(DeliveryAck ackIds)
        | "profile" ->
            let displayName = root.GetProperty("display_name").GetString()
            let bio = tryGetJsonString root "bio" |> Option.defaultValue ""
            let photo = tryGetJsonString root "photo" |> Option.defaultValue ""
            Some(ProfileMessage { DisplayName = displayName; Bio = bio; PhotoBase64 = photo })
        | _ -> None

    let private decryptEvent (privKey: byte[]) (payload: EventPayload) =
        try
            let blob = Crypto.fromHex payload.EncryptedBlob

            match Crypto.decrypt privKey blob with
            | Some(plaintext, senderHex) ->
                match parseEnvelope plaintext with
                | Some(TextMessage(id, body)) ->
                    Ok(IncomingChat(senderHex,
                        { Id = id; Body = body
                          Timestamp = DateTimeOffset.FromUnixTimeSeconds(payload.Timestamp)
                          IsOutgoing = false
                          Status = DeliveryStatus.Delivered }))
                | Some(DeliveryAck ackIds) ->
                    Ok(IncomingDeliveryAck(senderHex, ackIds))
                | Some(ProfileMessage profile) ->
                    Ok(IncomingProfile(senderHex, profile))
                | None -> Error "unknown envelope type"
            | None -> Error "decrypt failed"
        with ex ->
            Error $"parse: {ex.Message}"

    let private sendDeliveryAcks (session: Session) (events: DecryptedEvent list) =
        async {
            let chatsBySender =
                events
                |> List.choose (function IncomingChat(senderPubkey, msg) -> Some(senderPubkey, msg.Id) | _ -> None)
                |> List.groupBy fst
                |> List.map (fun (sender, pairs) -> sender, List.map snd pairs)

            for sender, msgIds in chatsBySender do
                try do! sendEnvelope session sender (DeliveryAck msgIds) |> Async.Ignore
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
                    let! status = sendEnvelope session recipientHex (TextMessage(messageId, text))
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

                    let results =
                        response.Events
                        |> Array.choose (fun evt ->
                            match evt.EventType with
                            | Message -> Some(decryptEvent session.Identity.PrivKey evt.Payload)
                            | UnknownEvent _ -> None)

                    let events = results |> Array.choose (function Ok e -> Some e | _ -> None) |> Array.toList
                    let errors = results |> Array.choose (function Error e -> Some e | _ -> None) |> Array.toList

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
                    return StateLoaded(Loaded(id, Store.loadData (), Store.loadProfile ()))
                | None -> return StateLoaded NothingSaved
            })

        | CmdSaveIdentity identity ->
            Cmd.ofEffect (fun _ -> Store.saveIdentity identity |> Async.Start)

        | CmdSaveData data ->
            Cmd.ofEffect (fun _ -> Store.saveData data)

        | CmdPickPhoto ->
            asyncCmd (async {
                try
                    let! results = Microsoft.Maui.Media.MediaPicker.Default.PickPhotosAsync() |> Async.AwaitTask
                    match results |> Seq.tryHead with
                    | None -> return PhotoPicked ""
                    | Some file ->
                        use! stream = file.OpenReadAsync() |> Async.AwaitTask
                        use ms = new MemoryStream()
                        do! stream.CopyToAsync(ms) |> Async.AwaitTask
                        return PhotoPicked(Convert.ToBase64String(ms.ToArray()))
                with _ ->
                    return PhotoPicked ""
            })

        | CmdSaveProfile profile ->
            Cmd.ofEffect (fun _ -> Store.saveProfile profile)

        | CmdSendProfileToAll(session, profile, recipientHexes) ->
            Cmd.ofEffect (fun _ ->
                async {
                    for recipientHex in recipientHexes do
                        try do! sendEnvelope session recipientHex (ProfileMessage profile) |> Async.Ignore
                        with _ -> ()
                } |> Async.Start)

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

                        Label("Profile:").font(size = 18.)
                        let displayName, bio, photo =
                            match model.Profile with
                            | Some p -> p.DisplayName, p.Bio, p.PhotoBase64
                            | None -> "", "", ""
                        if displayName <> "" then
                            Label($"Name: {displayName}").font(size = 14.)
                        if bio <> "" then
                            Label($"Bio: {bio}").font(size = 14.).textColor(Colors.DimGray)
                        Button("Edit Profile", SetPage(EditProfile(displayName, bio, photo)))

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

                    for c in model.Contacts.Values do
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

    let private viewEditProfile model displayName bio photo =
        ContentPage(
            ScrollView(
                (VStack(spacing = 16.) {
                    HStack(spacing = 8.) {
                        Button("< Back", SetPage Settings)
                        Label("Edit Profile").font(size = 20.)
                    }

                    viewErrorBanner model.Error

                    if photo <> "" then
                        Image(new MemoryStream(Convert.FromBase64String(photo)) :> Stream)
                            .width(120.)
                            .height(120.)
                            .centerHorizontal()
                    else
                        Label("No Photo")
                            .font(size = 16.)
                            .centerTextHorizontal()
                            .textColor(Colors.Gray)

                    Button("Change Photo", DoPickPhoto).centerHorizontal()

                    Label("Display Name:")
                    Entry(displayName, SetProfileDisplayName)
                        .placeholder("Your name")

                    Label("Bio:")
                    Entry(bio, SetProfileBio)
                        .placeholder("Tell something about yourself")

                    Button("Save Profile", DoSaveProfile).centerHorizontal()
                })
                    .padding(20.)
            )
        )

    let view model =
        let page =
            match model.Page with
            | Setup -> viewSetup ()
            | Settings -> viewSettings model
            | Conversations -> viewConversations model
            | Chat(pk, compose) -> viewChat model pk compose
            | AddContact(pk, nn) -> viewAddContact model pk nn
            | EditProfile(displayName, bio, photo) -> viewEditProfile model displayName bio photo

        Application() { Window(page) }

    let program =
        Program.statefulWithCmdMsg init update mapCmd
        |> Program.withView view
