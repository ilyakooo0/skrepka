namespace Skrepka

open System
open System.Text.Json
open Fabulous
open Fabulous.Maui
open System.Collections.Generic
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

    type Identity = { PrivKey: byte[]; PubKeyHex: string }

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
        | Sent of status: string
        | SetNewPubkey of string
        | SetNewNickname of string
        | DoSaveContact
        | DoDeleteContact of string
        | PollResult of messages: IncomingMessage list * status: string * cursor: uint64
        | DoPoll
        | CopyPubKey
        | DismissError
        | StateLoaded of identity: (byte[] * string) option * data: Store.DataDto option

    // ── CmdMsg ──

    type CmdMsg =
        | CmdGenIdentity
        | CmdConnect of url: string * identity: Identity
        | CmdSend of session: Session * recipientHex: string * text: string * messageId: string
        | CmdPoll of session: Session * cursor: uint64
        | CmdCopyToClipboard of string
        | CmdLoadState
        | CmdSaveIdentity of privKey: byte[] * pubKeyHex: string
        | CmdSaveData of contacts: Contact list * messages: Map<string, ChatMessage list> * serverUrl: string * cursor: uint64

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
        match model.Conn with
        | Online session -> Some session
        | _ -> None

    let private saveCmd model =
        [ CmdSaveData(model.Contacts, model.Messages, model.ServerUrl, model.PollCursor) ]

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
        [ CmdLoadState ]

    // ── Update ──

    let update msg model =
        match msg with
        | Nav page -> { model with Page = page }, []

        | GenIdentity -> model, [ CmdGenIdentity ]

        | IdentityReady identity ->
            { model with Identity = Some identity; Page = Settings },
            [ CmdSaveIdentity(identity.PrivKey, identity.PubKeyHex) ]

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
                { model with Conn = Online session; Page = Conversations; Error = None },
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
                let id = Guid.NewGuid().ToString()
                let outMsg =
                    { Id = id
                      Body = text
                      Timestamp = DateTimeOffset.UtcNow
                      IsOutgoing = true }
                let msgs = messagesFor pk model.Messages

                let model' =
                    { model with
                        ComposeText = ""
                        Messages = model.Messages |> Map.add pk (msgs @ [ outMsg ]) }

                model', CmdSend(session, pk, text, id) :: saveCmd model'
            | _ -> model, []

        | Sent status -> { model with LastSendStatus = status }, []

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

            let cmds =
                match trySession model' with
                | Some session -> [ CmdPoll(session, model'.PollCursor) ]
                | None -> []

            model', cmds @ (if not incoming.IsEmpty then saveCmd model' else [])

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

                let model' =
                    { model with
                        Contacts = model.Contacts |> upsertContact contact
                        NewPubkey = ""
                        NewNickname = ""
                        Page = Conversations }

                model', saveCmd model'
            else
                model, []

        | DoDeleteContact pk ->
            let model' =
                { model with
                    Contacts = model.Contacts |> List.filter (fun c -> c.Pubkey <> pk) }

            model', saveCmd model'

        | CopyPubKey ->
            match model.Identity with
            | Some id -> model, [ CmdCopyToClipboard id.PubKeyHex ]
            | None -> model, []

        | DismissError -> { model with Error = None }, []

        | StateLoaded(identityOpt, dataOpt) ->
            match identityOpt with
            | None -> model, []
            | Some(privKey, pubKeyHex) ->
                let identity = { PrivKey = privKey; PubKeyHex = pubKeyHex }

                let model' =
                    match dataOpt with
                    | Some data ->
                        let contacts =
                            data.Contacts
                            |> Array.toList
                            |> List.map (fun c ->
                                { Pubkey = c.Pubkey; Nickname = c.Nickname }: Contact)

                        let messages =
                            data.Messages
                            |> Seq.fold
                                (fun acc (KeyValue(pk, dtos)) ->
                                    let msgs =
                                        dtos
                                        |> Array.toList
                                        |> List.map (fun m ->
                                            { Id = m.Id
                                              Body = m.Body
                                              Timestamp = DateTimeOffset.FromUnixTimeSeconds m.TimestampUnix
                                              IsOutgoing = m.IsOutgoing })

                                    acc |> Map.add pk msgs)
                                Map.empty

                        { model with
                            Identity = Some identity
                            Contacts = contacts
                            Messages = messages
                            ServerUrl =
                                if data.ServerUrl <> "" then data.ServerUrl
                                else model.ServerUrl
                            PollCursor = data.PollCursor
                            Page = Conversations
                            Conn = Connecting }

                    | None ->
                        { model with
                            Identity = Some identity
                            Page = Settings
                            Conn = Connecting }

                model', [ CmdConnect(model'.ServerUrl, identity) ]

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

        | CmdSend(session, recipientHex, text, messageId) ->
            asyncCmd (async {
                try
                    let pubKey = session.Identity.PrivKey.[32..63]
                    let recipPub = Crypto.fromHex recipientHex
                    let ts = DateTimeOffset.UtcNow.ToUnixTimeSeconds()

                    let payload =
                        $"""{{ "type": "text", "id": "{messageId}", "timestamp": {ts}, "body": {JsonSerializer.Serialize(text)} }}"""

                    let blob = Crypto.encrypt session.Identity.PrivKey pubKey recipPub payload
                    let blobHex = Crypto.toHex blob
                    let! (status, msgId) = ApiClient.sendMessage session.Url session.Token recipientHex blobHex ts
                    return Sent $"{status}:{msgId}"
                with ex ->
                    return DismissError  // TODO: show send errors properly
            })

        | CmdPoll(session, cursor) ->
            asyncCmd (async {
                try
                    let! (events, newCursor) = ApiClient.poll session.Url session.Token cursor
                    let messages, ackIds, errors =
                        events
                        |> List.fold (fun (msgs, acks, errs) (evtId, evtType, payload) ->
                            if evtType <> "message" then (msgs, acks, errs)
                            else
                                match decryptEvent session.Identity.PrivKey payload with
                                | Ok msg -> (msg :: msgs, evtId :: acks, errs)
                                | Error err -> (msgs, acks, err :: errs))
                            ([], [], [])

                    if not ackIds.IsEmpty then
                        do! ApiClient.ackMessages session.Url session.Token ackIds

                    let now = DateTimeOffset.UtcNow.ToString("HH:mm:ss")

                    let status =
                        $"[{now}] evts:{events.Length} msgs:{messages.Length} errs:{errors.Length}"
                        + (match errors with err :: _ -> $" [{err}]" | [] -> "")

                    return PollResult(List.rev messages, status, newCursor)
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
            asyncCmd (async {
                let! identity = Store.loadIdentity ()
                let data = Store.loadData ()
                return StateLoaded(identity, data)
            })

        | CmdSaveIdentity(privKey, pubKeyHex) ->
            Cmd.ofEffect (fun _ -> Store.saveIdentity privKey pubKeyHex |> ignore)

        | CmdSaveData(contacts, messages, serverUrl, cursor) ->
            Cmd.ofEffect (fun _ ->
                let contactDtos =
                    contacts
                    |> List.map (fun c ->
                        { Store.ContactDto.Pubkey = c.Pubkey
                          Store.ContactDto.Nickname = c.Nickname })
                    |> Array.ofList

                let messageDtos = Dictionary<string, Store.MessageDto array>()

                messages
                |> Map.iter (fun pk msgs ->
                    messageDtos[pk] <-
                        msgs
                        |> List.map (fun m ->
                            { Store.MessageDto.Id = m.Id
                              Store.MessageDto.Body = m.Body
                              Store.MessageDto.TimestampUnix = m.Timestamp.ToUnixTimeSeconds()
                              Store.MessageDto.IsOutgoing = m.IsOutgoing })
                        |> Array.ofList)

                Store.saveData
                    { Contacts = contactDtos
                      Messages = messageDtos
                      ServerUrl = serverUrl
                      PollCursor = cursor })

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

                match model.Error with
                | Some err ->
                    Label(err)
                        .textColor(Colors.Red)
                        .font(size = 11.)
                | None -> ()

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
