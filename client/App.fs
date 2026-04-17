namespace Skrepka

open System
open System.IO
open System.Text.Json
open Avalonia.Media
open Avalonia.Themes.Fluent
open Fabulous
open Fabulous.Avalonia

open type Fabulous.Avalonia.View

module App =

    open Store
    open Crypto
    open ApiClient
    open AppTypes
    open ViewSetup
    open ViewSettings
    open ViewConversations
    open ViewChat
    open ViewAddContact
    open ViewEditProfile

    // ── Helpers ──

    let private tryParsePubkey (input: string) =
        let input = input.Trim()

        Phonemic.fromOb input
        |> Option.orElseWith (fun () -> Crypto.tryFromHex input)
        |> Option.filter (fun bytes -> bytes.Length = 32)

    let private appendMessage (pk: string) (msg: ChatMessage) (messages: Map<string, ChatMessage list>) =
        let existing = messagesFor pk messages

        if existing |> List.exists (fun m -> m.Id = msg.Id) then
            messages
        else
            Map.add pk (existing @ [ msg ]) messages

    let private markDelivered (pk: string) (ackIds: string list) (messages: Map<string, ChatMessage list>) =
        let ackSet = Set.ofList ackIds

        messages
        |> Map.change
            pk
            (Option.map (
                List.map (fun m ->
                    match m.Direction with
                    | Outgoing DeliveryStatus.Sent when Set.contains m.Id ackSet ->
                        { m with
                            Direction = Outgoing DeliveryStatus.Delivered }
                    | _ -> m)
            ))

    let private newContact pubkey nickname : Contact =
        { Pubkey = pubkey
          Nickname = nickname
          DisplayName = ""
          Bio = ""
          Photo = None }

    let private withProfile (p: Profile) (c: Contact) =
        { c with
            DisplayName = p.DisplayName
            Bio = p.Bio
            Photo = p.Photo }

    let private applyEvent (m: Model) (evt: IncomingEvent) =
        match evt.Envelope with
        | Envelope.TextMessage(id, body) ->
            let message =
                { Id = id
                  Body = body
                  Timestamp = evt.Timestamp
                  Direction = Incoming }

            { m with
                Contacts =
                    if Map.containsKey evt.Sender m.Contacts then
                        m.Contacts
                    else
                        Map.add evt.Sender (newContact evt.Sender "") m.Contacts
                Messages = m.Messages |> appendMessage evt.Sender message }
        | Envelope.DeliveryAck ackIds ->
            { m with
                Messages = m.Messages |> markDelivered evt.Sender ackIds }
        | Envelope.ProfileMessage profile ->
            { m with
                Contacts = m.Contacts |> Map.change evt.Sender (Option.map (withProfile profile)) }

    let private trySession model =
        match model.Auth with
        | Identified(id, Online token) ->
            Some
                { Url = model.ServerUrl
                  Token = token
                  Identity = id }
        | _ -> None

    let private setConn status model =
        match model.Auth with
        | Identified(id, _) ->
            { model with
                Auth = Identified(id, status) }
        | NoIdentity -> model

    let private saveCmdMsg model : CmdMsg =
        CmdSaveData
            ({ Contacts = model.Contacts
               Messages = model.Messages
               ServerUrl = model.ServerUrl
               PollCursor = model.PollCursor } : Data)

    // ── Init ──

    let init () =
        { Page = Setup
          Auth = NoIdentity
          ServerUrl = "http://localhost:8080"
          PollStatus = ""
          Contacts = Map.empty
          Messages = Map.empty
          Error = None
          PollCursor = 0L
          Profile = None
          FlushingOutbox = false },
        [ CmdLoadState ]

    // ── Update ──

    let update msg model =
        match msg with
        | SetPage page -> { model with Page = page }, []

        | GenIdentity ->
            let identity = Crypto.generateIdentity ()

            { model with
                Auth = Identified(identity, Offline)
                Page = EditProfile("", "", None) },
            [ CmdSaveIdentity identity ]

        | SetServerUrl url -> { model with ServerUrl = url }, []

        | DoConnect ->
            match model.Auth with
            | Identified(id, _) -> model |> setConn Connecting, [ CmdConnect(model.ServerUrl, id) ]
            | NoIdentity ->
                { model with
                    Error = Some "No identity generated" },
                []

        | AuthOk token ->
            match model.Auth with
            | Identified(id, Connecting) ->
                let session =
                    { Url = model.ServerUrl
                      Token = token
                      Identity = id }

                { model with
                    Auth = Identified(id, Online token)
                    Page = Conversations
                    Error = None
                    PollStatus = "polling..."
                    FlushingOutbox = true },
                [ CmdPoll(session, model.PollCursor); CmdFlushOutbox session ]
            | _ -> model, []

        | AuthErr err ->
            { setConn Offline model with
                Error = Some err
                FlushingOutbox = false },
            []

        | DoDisconnect ->
            { setConn Offline model with
                PollStatus = ""
                FlushingOutbox = false },
            []

        | DoSend ->
            match model.Page with
            | Chat(pk, compose) when compose <> "" ->
                let id = Guid.NewGuid().ToString()

                let outMsg =
                    { Id = id
                      Body = compose
                      Timestamp = DateTimeOffset.UtcNow
                      Direction = Outgoing DeliveryStatus.Sent }

                let isFirstInteraction = model.Messages |> messagesFor pk |> List.isEmpty

                let model' =
                    { model with
                        Page = Chat(pk, "")
                        Messages = model.Messages |> appendMessage pk outMsg }

                model',
                [ CmdEnqueue(pk, Envelope.TextMessage(id, compose))
                  match model.Profile with
                  | Some profile when isFirstInteraction -> CmdEnqueue(pk, Envelope.ProfileMessage profile)
                  | _ -> ()
                  saveCmdMsg model' ]
            | _ -> model, []

        | StartFlush ->
            if model.FlushingOutbox then
                model, []
            else
                match trySession model with
                | Some session -> { model with FlushingOutbox = true }, [ CmdFlushOutbox session ]
                | None -> model, []

        | FlushResult sent ->
            if sent then
                match trySession model with
                | Some session -> model, [ CmdFlushOutbox session ]
                | None -> { model with FlushingOutbox = false }, []
            else
                { model with FlushingOutbox = false }, []

        | PollResult(events, status, newCursor) ->
            let model' =
                events
                |> List.fold
                    applyEvent
                    { model with
                        PollStatus = status
                        PollCursor = newCursor }

            model',
            [ match trySession model' with
              | Some session -> CmdPoll(session, model'.PollCursor)
              | None -> ()
              if not events.IsEmpty then
                  saveCmdMsg model' ]

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
                | None ->
                    { model with
                        Error = Some "Invalid public key" },
                    []
            | _ -> model, []

        | CopyPubKey ->
            match model.Auth with
            | Identified(id, _) -> model, [ CmdCopyToClipboard(hexToOb id.PubKeyHex) ]
            | NoIdentity -> model, []

        | DismissError -> { model with Error = None }, []

        | DoPickPhoto -> model, [ CmdPickPhoto ]

        | PhotoPicked(Some _ as photo) ->
            match model.Page with
            | EditProfile(name, bio, _) ->
                { model with
                    Page = EditProfile(name, bio, photo) },
                []
            | _ -> model, []
        | PhotoPicked None -> model, []

        | DoSaveProfile ->
            match model.Page with
            | EditProfile(name, bio, photo) ->
                let profile: Profile =
                    { DisplayName = name
                      Bio = bio
                      Photo = photo }

                { model with
                    Profile = Some profile
                    Page = Settings },
                [ CmdSaveProfile profile
                  for pk in model.Contacts.Keys do
                      CmdEnqueue(pk, Envelope.ProfileMessage profile) ]
            | _ -> model, []

        | StateLoaded(Some identity, Some data, profile) ->
            let model' =
                { model with
                    Auth = Identified(identity, Connecting)
                    Contacts = data.Contacts
                    Messages = data.Messages
                    ServerUrl =
                        if data.ServerUrl <> "" then
                            data.ServerUrl
                        else
                            model.ServerUrl
                    PollCursor = data.PollCursor
                    Profile = profile
                    Page = Conversations }

            model', [ CmdConnect(model'.ServerUrl, identity) ]
        | StateLoaded(Some identity, None, profile) ->
            { model with
                Auth = Identified(identity, Offline)
                Profile = profile
                Page = Settings },
            []
        | StateLoaded(None, _, _) -> model, []

    // ── mapCmd ──

    let private log msg = eprintfn $"[skrepka] {msg}"

    let private serializeEnvelope =
        function
        | Envelope.TextMessage(id, body) ->
            JsonSerializer.Serialize(
                {| ``type`` = "text"
                   id = id
                   body = body |}
            )
        | Envelope.DeliveryAck ackIds ->
            JsonSerializer.Serialize(
                {| ``type`` = "delivery.ack"
                   ack_ids = ackIds |}
            )
        | Envelope.ProfileMessage profile ->
            JsonSerializer.Serialize(
                {| ``type`` = "profile"
                   display_name = profile.DisplayName
                   bio = profile.Bio
                   photo = profile.Photo |}
            )

    let private sendEnvelope (session: Session) (recipientHex: string) (envelope: Envelope) =
        async {
            let payload = serializeEnvelope envelope

            let blob =
                Crypto.encrypt session.Identity.PrivKey (Crypto.fromHex recipientHex) payload

            let ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            do! sendMessage session.Url session.Token recipientHex (Crypto.toHex blob) ts
        }

    let private tryGetJsonString (el: JsonElement) (name: string) =
        match el.TryGetProperty(name) with
        | true, v when v.ValueKind <> JsonValueKind.Null -> Some(v.GetString())
        | _ -> None

    let private tryGetJsonBytes (el: JsonElement) (name: string) =
        match el.TryGetProperty(name) with
        | true, v when v.ValueKind <> JsonValueKind.Null -> Some(v.GetBytesFromBase64())
        | _ -> None

    let private parseEnvelope (json: string) =
        use doc = JsonDocument.Parse(json)
        let root = doc.RootElement

        match root.GetProperty("type").GetString() with
        | "text" -> Some(Envelope.TextMessage(root.GetProperty("id").GetString(), root.GetProperty("body").GetString()))
        | "delivery.ack" ->
            let ackIds =
                root.GetProperty("ack_ids").EnumerateArray()
                |> Seq.map _.GetString()
                |> Seq.toList

            Some(Envelope.DeliveryAck ackIds)
        | "profile" ->
            let displayName = root.GetProperty("display_name").GetString()
            let bio = tryGetJsonString root "bio" |> Option.defaultValue ""
            let photo = tryGetJsonBytes root "photo"

            Some(
                Envelope.ProfileMessage
                    { DisplayName = displayName
                      Bio = bio
                      Photo = photo }
            )
        | _ -> None

    let private decryptEvent (privKey: byte[]) (payload: EventPayload) =
        try
            let blob = Crypto.fromHex payload.EncryptedBlob

            match Crypto.decrypt privKey blob with
            | Some(plaintext, senderHex) ->
                match parseEnvelope plaintext with
                | Some envelope ->
                    Ok
                        { Sender = senderHex
                          Timestamp = DateTimeOffset.FromUnixTimeMilliseconds(payload.Timestamp)
                          Envelope = envelope }
                | None -> Error "unknown envelope type"
            | None -> Error "decrypt failed"
        with ex ->
            Error $"parse: {ex.Message}"

    let private getClipboard () =
        match Avalonia.Application.Current with
        | null -> None
        | app ->
            match app.ApplicationLifetime with
            | :? Avalonia.Controls.ApplicationLifetimes.IClassicDesktopStyleApplicationLifetime as desktop ->
                desktop.MainWindow
                |> Option.ofObj
                |> Option.bind (fun w -> w.Clipboard |> Option.ofObj)
            | :? Avalonia.Controls.ApplicationLifetimes.ISingleViewApplicationLifetime as singleView ->
                singleView.MainView
                |> Option.ofObj
                |> Option.bind (fun v -> Avalonia.Controls.TopLevel.GetTopLevel(v) |> Option.ofObj)
                |> Option.bind (fun tl -> tl.Clipboard |> Option.ofObj)
            | _ -> None

    let private getStorageProvider () =
        match Avalonia.Application.Current with
        | null -> None
        | app ->
            match app.ApplicationLifetime with
            | :? Avalonia.Controls.ApplicationLifetimes.IClassicDesktopStyleApplicationLifetime as desktop ->
                desktop.MainWindow |> Option.ofObj |> Option.map (fun w -> w.StorageProvider)
            | :? Avalonia.Controls.ApplicationLifetimes.ISingleViewApplicationLifetime as singleView ->
                singleView.MainView
                |> Option.ofObj
                |> Option.bind (fun v -> Avalonia.Controls.TopLevel.GetTopLevel(v) |> Option.ofObj)
                |> Option.map (fun tl -> tl.StorageProvider)
            | _ -> None

    let private cropToSquarePng (imageBytes: byte[]) =
        use skBmp = SkiaSharp.SKBitmap.Decode(imageBytes)
        let size = min skBmp.Width skBmp.Height
        let x = (skBmp.Width - size) / 2
        let y = (skBmp.Height - size) / 2
        use cropped = new SkiaSharp.SKBitmap(size, size)

        skBmp.ExtractSubset(cropped, SkiaSharp.SKRectI(x, y, x + size, y + size))
        |> ignore

        use img = SkiaSharp.SKImage.FromBitmap(cropped)
        use data = img.Encode(SkiaSharp.SKEncodedImageFormat.Png, 90)
        data.ToArray()

#if MOBILE
    let private pickPhotoCmd =
        Cmd.ofEffect (fun dispatch ->
            task {
                try
                    let! bytes = Skrepka.iOS.PhotoPicker.pick ()

                    match bytes with
                    | Some b -> dispatch (PhotoPicked(Some(cropToSquarePng b)))
                    | None -> dispatch (PhotoPicked None)
                with _ ->
                    dispatch (PhotoPicked None)
            }
            |> ignore)
#else
    let private pickPhotoCmd =
        Cmd.ofEffect (fun dispatch ->
            Avalonia.Threading.Dispatcher.UIThread.InvokeAsync(fun () ->
                task {
                    try
                        match getStorageProvider () with
                        | Some sp ->
                            let opts =
                                Avalonia.Platform.Storage.FilePickerOpenOptions(
                                    AllowMultiple = false,
                                    Title = "Pick Photo",
                                    FileTypeFilter =
                                        [ Avalonia.Platform.Storage.FilePickerFileType(
                                              "Images",
                                              Patterns = [ "*.png"; "*.jpg"; "*.jpeg"; "*.gif"; "*.bmp" ]
                                          ) ]
                                )

                            let! files = sp.OpenFilePickerAsync(opts)

                            match files |> Seq.tryHead with
                            | None -> dispatch (PhotoPicked None)
                            | Some file ->
                                use! stream = file.OpenReadAsync()
                                use ms = new MemoryStream()
                                do! stream.CopyToAsync(ms)
                                dispatch (PhotoPicked(Some(cropToSquarePng (ms.ToArray()))))
                        | None -> dispatch (PhotoPicked None)
                    with _ ->
                        dispatch (PhotoPicked None)
                }
                :> System.Threading.Tasks.Task)
            |> ignore)
#endif

    let mapCmd cmdMsg =
        match cmdMsg with
        | CmdConnect(url, identity) ->
            Cmd.OfAsync.either (fun (url, id) -> authenticate url id) (url, identity) AuthOk (fun ex ->
                AuthErr ex.Message)

        | CmdEnqueue(recipientHex, envelope) ->
            Cmd.ofEffect (fun dispatch ->
                let json = serializeEnvelope envelope
                Store.enqueueOutbox recipientHex json
                dispatch StartFlush)

        | CmdFlushOutbox session ->
            Cmd.ofEffect (fun dispatch ->
                async {
                    match Store.peekOutbox () with
                    | Some item ->
                        try
                            let blob =
                                Crypto.encrypt
                                    session.Identity.PrivKey
                                    (Crypto.fromHex item.RecipientHex)
                                    item.EnvelopeJson

                            let ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                            do! sendMessage session.Url session.Token item.RecipientHex (Crypto.toHex blob) ts
                            Store.dequeueOutbox item.Id
                            dispatch (FlushResult true)
                        with ex ->
                            log $"outbox send error: {ex.Message}"
                            do! Async.Sleep 3000
                            dispatch (FlushResult true)
                    | None -> dispatch (FlushResult false)
                }
                |> Async.Start)

        | CmdPoll(session, cursor) ->
            Cmd.ofEffect (fun dispatch ->
                async {
                    log $"poll start cursor={cursor}"

                    try
                        let! response = poll session.Url session.Token cursor
                        log $"poll response: {response.Events.Length} events, cursor={response.Cursor}"

                        let ackIds = response.Events |> Array.map _.Id |> Array.toList

                        let results =
                            response.Events
                            |> Array.choose (fun evt ->
                                match evt.EventType with
                                | Message -> Some(decryptEvent session.Identity.PrivKey evt.Payload)
                                | UnknownEvent s ->
                                    log $"unknown event type: {s}"
                                    None)

                        let events = results |> Array.choose Result.toOption |> Array.toList

                        let errors =
                            results
                            |> Array.choose (function
                                | Error e -> Some e
                                | _ -> None)
                            |> Array.toList

                        for e in errors do
                            log $"decrypt error: {e}"

                        if not ackIds.IsEmpty || not events.IsEmpty then
                            async {
                                if not ackIds.IsEmpty then
                                    try
                                        do! ackMessages session.Url session.Token ackIds
                                    with _ ->
                                        ()

                                let acksBySender =
                                    events
                                    |> List.choose (fun evt ->
                                        match evt.Envelope with
                                        | Envelope.TextMessage(id, _) -> Some(evt.Sender, id)
                                        | _ -> None)
                                    |> List.groupBy fst
                                    |> List.map (fun (sender, pairs) -> sender, List.map snd pairs)

                                for sender, msgIds in acksBySender do
                                    try
                                        do! sendEnvelope session sender (Envelope.DeliveryAck msgIds)
                                    with _ ->
                                        ()
                            }
                            |> Async.Start

                        if response.Events.Length = 0 then
                            do! Async.Sleep 5000

                        let chatCount =
                            events
                            |> List.sumBy (fun e ->
                                match e.Envelope with
                                | Envelope.TextMessage _ -> 1
                                | _ -> 0)

                        let status =
                            $"evts:{response.Events.Length} msgs:{chatCount} errs:{errors.Length}"
                            + (match List.tryHead errors with
                               | Some e -> $" [{e}]"
                               | None -> "")

                        dispatch (PollResult(events, status, response.Cursor))
                    with
                    | :? TimeoutException ->
                        log "poll timeout"
                        dispatch (PollResult([], "polling...", cursor))
                    | ex ->
                        log $"poll error: {ex.Message}"
                        do! Async.Sleep 3000
                        dispatch (PollResult([], $"poll error: {ex.Message}", cursor))
                }
                |> Async.Start)

        | CmdCopyToClipboard text ->
            Cmd.ofEffect (fun _ ->
                match getClipboard () with
                | Some clipboard -> clipboard.SetTextAsync(text) |> ignore
                | None -> ())

        | CmdLoadState ->
            Cmd.OfAsync.perform
                (fun () ->
                    async {
                        match! Store.loadIdentity () with
                        | Some id -> return (Some id, Store.loadData (), Store.loadProfile ())
                        | None -> return (None, None, None)
                    })
                ()
                StateLoaded

        | CmdSaveIdentity identity -> Cmd.ofEffect (fun _ -> Store.saveIdentity identity |> Async.Start)

        | CmdSaveData data -> Cmd.ofEffect (fun _ -> Store.saveData data)

        | CmdPickPhoto -> pickPhotoCmd

        | CmdSaveProfile profile -> Cmd.ofEffect (fun _ -> Store.saveProfile profile)

    // ── View ──

    let private pageContent model =
        let page =
            match model.Page with
            | Setup -> AnyView(viewSetup ())
            | Settings -> AnyView(viewSettings model)
            | Conversations -> AnyView(viewConversations model)
            | Chat(pk, compose) -> AnyView(viewChat model pk compose)
            | AddContact(pk, nn) -> AnyView(viewAddContact model pk nn)
            | EditProfile(displayName, bio, photo) -> AnyView(viewEditProfile model displayName bio photo)

        Border(page).background (SolidColorBrush(Colors.White))

    let view model =
#if MOBILE
        SingleViewApplication(pageContent model)
#else
        DesktopApplication() {
            Window(pageContent model)
                .title("Skrepka")
                .icon("avares://Skrepka/Assets/Images/logo.png")
                .width(450.)
                .height (750.)
        }
#endif

    let program = Program.statefulWithCmdMsg init update mapCmd |> Program.withView view

    let create () =
        FabulousAppBuilder.Configure(FluentTheme, program)
