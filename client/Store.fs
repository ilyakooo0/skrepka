namespace Skrepka

open System
open System.IO
open LiteDB
open Microsoft.Maui.Storage

module Store =

    [<CLIMutable>]
    type Contact =
        { [<BsonId>] Pubkey: string
          Nickname: string
          DisplayName: string
          Bio: string
          PhotoBase64: string }

    type Profile =
        { DisplayName: string
          Bio: string
          PhotoBase64: string }

    [<RequireQualifiedAccess>]
    type DeliveryStatus = Sent | Delivered

    type ChatMessage =
        { Id: string
          Body: string
          Timestamp: DateTimeOffset
          IsOutgoing: bool
          Status: DeliveryStatus }

    type Data =
        { Contacts: Map<string, Contact>
          Messages: Map<string, ChatMessage list>
          ServerUrl: string option
          PollCursor: int64 }

    [<CLIMutable>]
    type private MessageDoc =
        { [<BsonId>] Id: string
          ConversationId: string
          Body: string
          TimestampUnix: int64
          IsOutgoing: bool
          Status: int }

    [<CLIMutable>]
    type private SettingsDoc =
        { [<BsonId>] Id: string
          ServerUrl: string
          PollCursor: int64 }

    [<CLIMutable>]
    type private ProfileDoc =
        { [<BsonId>] Id: string
          DisplayName: string
          Bio: string
          PhotoBase64: string }

    let private orEmpty s = s |> Option.ofObj |> Option.defaultValue ""

    let private toChatMessage (d: MessageDoc) : ChatMessage =
        { Id = d.Id; Body = d.Body; Timestamp = DateTimeOffset.FromUnixTimeSeconds d.TimestampUnix; IsOutgoing = d.IsOutgoing
          Status = match d.Status with 1 -> DeliveryStatus.Delivered | _ -> DeliveryStatus.Sent }

    let private toMessageDoc convId (m: ChatMessage) : MessageDoc =
        { Id = m.Id; ConversationId = convId; Body = m.Body; TimestampUnix = m.Timestamp.ToUnixTimeSeconds(); IsOutgoing = m.IsOutgoing
          Status = match m.Status with DeliveryStatus.Delivered -> 1 | DeliveryStatus.Sent -> 0 }

    let private openDb () =
        new LiteDatabase(Path.Combine(FileSystem.AppDataDirectory, "skrepka.db"))

    let loadIdentity () =
        async {
            let! privKeyB64 =
                SecureStorage.Default.GetAsync("identity_privkey")
                |> Async.AwaitTask

            return
                privKeyB64
                |> Option.ofObj
                |> Option.map (Convert.FromBase64String >> Crypto.identityFromPrivKey)
        }

    let saveIdentity (identity: Crypto.Identity) =
        SecureStorage.Default.SetAsync("identity_privkey", Convert.ToBase64String identity.PrivKey)
        |> Async.AwaitTask

    let loadProfile () : Profile option =
        try
            use db = openDb ()
            db.GetCollection<ProfileDoc>("profile").FindById(BsonValue "me")
            |> Option.ofObj
            |> Option.map (fun p ->
                { DisplayName = orEmpty p.DisplayName
                  Bio = orEmpty p.Bio
                  PhotoBase64 = orEmpty p.PhotoBase64 })
        with _ -> None

    let saveProfile (profile: Profile) =
        try
            use db = openDb ()
            db.GetCollection<ProfileDoc>("profile").Upsert
                { Id = "me"
                  DisplayName = profile.DisplayName
                  Bio = profile.Bio
                  PhotoBase64 = profile.PhotoBase64 }
            |> ignore
        with _ -> ()

    let loadData () : Data option =
        try
            use db = openDb ()
            let settings = db.GetCollection<SettingsDoc>("settings").FindById(BsonValue "settings")

            settings
            |> Option.ofObj
            |> Option.map (fun settings ->
                let contacts =
                    db.GetCollection<Contact>("contacts").FindAll()
                    |> Seq.map (fun c ->
                        c.Pubkey,
                        { c with
                            DisplayName = orEmpty c.DisplayName
                            Bio = orEmpty c.Bio
                            PhotoBase64 = orEmpty c.PhotoBase64 })
                    |> Map.ofSeq

                let messages =
                    db.GetCollection<MessageDoc>("messages").FindAll()
                    |> Seq.groupBy _.ConversationId
                    |> Seq.map (fun (convId, docs) ->
                        convId, docs |> Seq.map toChatMessage |> Seq.sortBy _.Timestamp |> Seq.toList)
                    |> Map.ofSeq

                { Contacts = contacts
                  Messages = messages
                  ServerUrl = settings.ServerUrl |> Option.ofObj
                  PollCursor = settings.PollCursor })
        with _ ->
            None

    let saveData (data: Data) =
        try
            use db = openDb ()
            let contacts = db.GetCollection<Contact>("contacts")
            let messages = db.GetCollection<MessageDoc>("messages")
            let settings = db.GetCollection<SettingsDoc>("settings")

            for c in data.Contacts.Values do
                contacts.Upsert c |> ignore

            data.Messages
            |> Map.iter (fun convId msgs ->
                for m in msgs do
                    messages.Upsert(toMessageDoc convId m) |> ignore)

            settings.Upsert
                { Id = "settings"
                  ServerUrl = data.ServerUrl |> Option.defaultValue ""
                  PollCursor = data.PollCursor }
            |> ignore
        with _ ->
            ()
