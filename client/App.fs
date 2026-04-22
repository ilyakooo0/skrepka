namespace Skrepka

open System
open System.IO
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
    open Protocol

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
          DisplayName = truncKey pubkey
          Bio = ""
          Photo = None
          AddedDate = System.DateTimeOffset.UtcNow }

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
                Contacts =
                    m.Contacts
                    |> Map.change evt.Sender (fun c ->
                        let contact = c |> Option.defaultWith (fun () -> newContact evt.Sender "")
                        Some(withProfile profile contact)) }

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
        CmdSaveData(
            { Contacts = model.Contacts
              Messages = model.Messages
              ServerUrl = model.ServerUrl
              PollCursor = model.PollCursor }
            : Data
        )

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
          FlushingOutbox = false
          PollRetries = 0
          KeyboardHeight = 0.
          SafeAreaTop = 0.
          SafeAreaBottom = 0. },
        [ CmdLoadState; CmdSubscribeKeyboard; CmdSubscribeSafeArea ]

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
                    Page =
                        match model.Page with
                        | Setup -> Conversations
                        | p -> p
                    Error = None
                    PollStatus = "polling..."
                    FlushingOutbox = true },
                [ CmdPoll(session, model.PollCursor, 0); CmdFlushOutbox session ]
            | _ -> model, []

        | AuthErr err ->
            { setConn Offline model with
                Error = Some err
                FlushingOutbox = false
                PollRetries = 0 },
            []

        | TokenExpired ->
            match model.Auth with
            | Identified(id, Online _) ->
                let m = setConn Connecting model

                { m with
                    FlushingOutbox = false
                    PollRetries = 0 },
                [ CmdConnect(model.ServerUrl, id) ]
            | _ -> model, []

        | DoDisconnect ->
            { setConn Offline model with
                PollStatus = ""
                FlushingOutbox = false
                PollRetries = 0 },
            []

        | DoSend ->
            match model.Page with
            | Chat(pk, compose) when compose.Trim() <> "" ->
                let body = compose.Trim()
                let id = Guid.NewGuid().ToString()

                let outMsg =
                    { Id = id
                      Body = body
                      Timestamp = DateTimeOffset.UtcNow
                      Direction = Outgoing DeliveryStatus.Sent }

                let neverSentTo =
                    model.Messages
                    |> messagesFor pk
                    |> List.exists (fun m -> match m.Direction with Outgoing _ -> true | _ -> false)
                    |> not

                let model' =
                    { model with
                        Page = Chat(pk, "")
                        Messages = model.Messages |> appendMessage pk outMsg }

                model',
                [ CmdEnqueue(pk, Envelope.TextMessage(id, body))
                  match model.Profile with
                  | Some profile when neverSentTo -> CmdEnqueue(pk, Envelope.ProfileMessage profile)
                  | _ -> ()
                  saveCmdMsg model' ]
            | _ -> model, []

        | StartFlush ->
            if model.FlushingOutbox then
                eprintfn "[skrepka] StartFlush: already flushing, skipping"
                model, []
            else
                match trySession model with
                | Some session ->
                    eprintfn "[skrepka] StartFlush: dispatching flush"
                    { model with FlushingOutbox = true }, [ CmdFlushOutbox session ]
                | None ->
                    eprintfn "[skrepka] StartFlush: no session"
                    model, []

        | FlushResult sent ->
            if sent then
                match trySession model with
                | Some session -> model, [ CmdFlushOutbox session ]
                | None -> { model with FlushingOutbox = false }, []
            else
                { model with FlushingOutbox = false }, []

        | PollResult(events, status, newCursor) ->
            let retries =
                if events.IsEmpty && status.StartsWith("poll error") then
                    model.PollRetries + 1
                else
                    0

            let model' =
                events
                |> List.fold
                    applyEvent
                    { model with
                        PollStatus = status
                        PollCursor = newCursor
                        PollRetries = retries }

            model',
            [ match trySession model' with
              | Some session -> CmdPoll(session, model'.PollCursor, model'.PollRetries)
              | None -> ()
              if not events.IsEmpty then
                  saveCmdMsg model' ]

        | DoSaveContact ->
            match model.Page with
            | AddContact(cpk) when cpk <> "" ->
                match tryParsePubkey cpk with
                | Some bytes ->
                    let hex = Crypto.toHex bytes

                    match Map.tryFind hex model.Contacts with
                    | Some e -> model, []
                    | None ->
                        let contact = newContact hex cpk

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

        | Search _ -> model, []

        | KeyboardHeightChanged h -> { model with KeyboardHeight = h }, []
        | SafeAreaChanged(top, bottom) -> { model with SafeAreaTop = top; SafeAreaBottom = bottom }, []

        | DoScanQR -> model, [ CmdScanQR ]

        | QRScanned(Some text) ->
            match model.Page with
            | AddContact _ -> { model with Page = AddContact(text) }, []
            | _ -> model, []

        | QRScanned None -> model, []

    // ── mapCmd ──

    let private log msg = eprintfn $"[skrepka] {msg}"

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
    let private scanQRCmd =
        Cmd.ofEffect (fun dispatch ->
            task {
                try
                    let! result = Skrepka.iOS.QRScanner.scan ()
                    dispatch (QRScanned result)
                with ex ->
                    log $"QR scan error: {ex.Message}"
                    dispatch (QRScanned None)
            }
            |> ignore)

    let private pickPhotoCmd =
        Cmd.ofEffect (fun dispatch ->
            task {
                try
                    let! bytes = Skrepka.iOS.PhotoPicker.pick ()

                    match bytes with
                    | Some b -> dispatch (PhotoPicked(Some(cropToSquarePng b)))
                    | None -> dispatch (PhotoPicked None)
                with ex ->
                    log $"photo pick error: {ex.Message}"
                    dispatch (PhotoPicked None)
            }
            |> ignore)
#else
    let private scanQRCmd =
        Cmd.ofEffect (fun dispatch ->
            Avalonia.Threading.Dispatcher.UIThread.InvokeAsync(fun () ->
                task {
                    try
                        match getStorageProvider () with
                        | Some sp ->
                            let opts =
                                Avalonia.Platform.Storage.FilePickerOpenOptions(
                                    AllowMultiple = false,
                                    Title = "Select QR Code Image",
                                    FileTypeFilter =
                                        [ Avalonia.Platform.Storage.FilePickerFileType(
                                              "Images",
                                              Patterns = [ "*.png"; "*.jpg"; "*.jpeg"; "*.gif"; "*.bmp" ]
                                          ) ]
                                )

                            let! files = sp.OpenFilePickerAsync(opts)

                            match files |> Seq.tryHead with
                            | None -> dispatch (QRScanned None)
                            | Some file ->
                                use! stream = file.OpenReadAsync()
                                use ms = new MemoryStream()
                                do! stream.CopyToAsync(ms)

                                use bitmap = SkiaSharp.SKBitmap.Decode(ms.ToArray())
                                let reader = ZXing.SkiaSharp.BarcodeReader()
                                let result = reader.Decode(bitmap)

                                if isNull result then
                                    dispatch (QRScanned None)
                                else
                                    dispatch (QRScanned(Some result.Text))
                        | None -> dispatch (QRScanned None)
                    with ex ->
                        log $"QR scan error: {ex.Message}"
                        dispatch (QRScanned None)
                }
                :> System.Threading.Tasks.Task)
            |> ignore)

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
                    with ex ->
                        log $"photo pick error: {ex.Message}"
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
                async {
                    let json = serializeEnvelope envelope
                    do! Store.enqueueOutbox recipientHex json
                    dispatch StartFlush
                }
                |> Async.Start)

        | CmdFlushOutbox session ->
            Cmd.ofEffect (fun dispatch ->
                async {
                    match! Store.peekOutbox () with
                    | Some item ->
                        log $"flush: sending to {item.RecipientHex.[..7]}..."
                        try
                            let blobOpt =
                                Crypto.encrypt
                                    session.Identity.PrivKey
                                    (Crypto.fromHex item.RecipientHex)
                                    item.EnvelopeJson

                            match blobOpt with
                            | Some blob ->
                                let ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                                log $"flush: encrypted, posting to {session.Url}/messages"
                                do! sendMessage session.Url session.Token item.RecipientHex (Crypto.toHex blob) ts
                                log "flush: sent OK"
                                do! Store.dequeueOutbox item.Id
                                dispatch (FlushResult true)
                            | None ->
                                log $"outbox encrypt failed, dropping message to {item.RecipientHex}"
                                do! Store.dequeueOutbox item.Id
                                dispatch (FlushResult true)
                        with
                        | Unauthorized ->
                            log "outbox unauthorized, reauthenticating"
                            dispatch TokenExpired
                        | ServerRejected msg ->
                            log $"outbox rejected, dropping: {msg}"
                            do! Store.dequeueOutbox item.Id
                            dispatch (FlushResult true)
                        | ex ->
                            log $"outbox send error: {ex.Message}"
                            do! Async.Sleep Constants.outboxRetryDelayMs
                            dispatch (FlushResult true)
                    | None -> dispatch (FlushResult false)
                }
                |> Async.Start)

        | CmdPoll(session, cursor, retries) ->
            Cmd.ofEffect (fun dispatch ->
                async {
                    log $"poll start cursor={cursor}"

                    try
                        let! response = poll session.Url session.Token cursor
                        log $"poll response: {response.Events.Length} events, cursor={response.Cursor}"

                        if not response.Authorized then
                            log "poll unauthorized, reauthenticating"
                            dispatch TokenExpired
                        else

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

                            if not events.IsEmpty then
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
                                    with ex ->
                                        log $"delivery ack error: {ex.Message}"

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
                        let delay = min (Constants.pollRetryBaseMs * (pown 2 retries)) 30000
                        do! Async.Sleep delay
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
                        | Some id ->
                            let! data = Store.loadData ()
                            let! profile = Store.loadProfile ()
                            return (Some id, data, profile)
                        | None -> return (None, None, None)
                    })
                ()
                StateLoaded

        | CmdSaveIdentity identity -> Cmd.ofEffect (fun _ -> Store.saveIdentity identity |> Async.Start)

        | CmdSaveData data -> Cmd.ofEffect (fun _ -> Store.saveData data |> Async.Start)

        | CmdPickPhoto -> pickPhotoCmd

        | CmdScanQR -> scanQRCmd

        | CmdSaveProfile profile -> Cmd.ofEffect (fun _ -> Store.saveProfile profile |> Async.Start)

        | CmdSubscribeKeyboard ->
            Cmd.ofEffect (fun dispatch -> Keyboard.heightChanged.Add(fun h -> dispatch (KeyboardHeightChanged h)))

        | CmdSubscribeSafeArea ->
            Cmd.ofEffect (fun dispatch -> SafeArea.insetsChanged.Add(fun (t, b) -> dispatch (SafeAreaChanged(t, b))))

    // ── View ──

    let private pageContent model =
        let page =
            match model.Page with
            | Setup -> AnyView(viewSetup ())
            | Settings -> AnyView(viewSettings model)
            | Conversations -> AnyView(viewConversations model)
            | Chat(pk, compose) -> AnyView(viewChat model pk compose)
            | AddContact(pk) -> AnyView(viewAddContact model pk)
            | EditProfile(displayName, bio, photo) -> AnyView(viewEditProfile model displayName bio photo)

        Border(page)
            .background(SolidColorBrush(Colors.White))
            .padding (Avalonia.Thickness(0., model.SafeAreaTop, 0., model.KeyboardHeight))

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
