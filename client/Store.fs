namespace Skrepka

open System
open System.IO
open LiteDB
open Microsoft.Maui.Storage

module Store =

    [<CLIMutable>]
    type Contact =
        { [<BsonId>] Pubkey: string
          Nickname: string }

    type ChatMessage =
        { Id: string
          Body: string
          Timestamp: DateTimeOffset
          IsOutgoing: bool }

    type Data =
        { Contacts: Contact list
          Messages: Map<string, ChatMessage list>
          ServerUrl: string
          PollCursor: uint64 }

    [<CLIMutable>]
    type private MessageDoc =
        { [<BsonId>] Id: string
          ConversationId: string
          Body: string
          TimestampUnix: int64
          IsOutgoing: bool }

    [<CLIMutable>]
    type private SettingsDoc =
        { [<BsonId>] Id: string
          ServerUrl: string
          PollCursor: int64 }

    let private openDb () =
        new LiteDatabase(Path.Combine(FileSystem.AppDataDirectory, "skrepka.db"))

    let loadIdentity () =
        async {
            let! privKeyB64 =
                SecureStorage.Default.GetAsync("identity_privkey")
                |> Async.AwaitTask

            let! pubKeyHex =
                SecureStorage.Default.GetAsync("identity_pubkey")
                |> Async.AwaitTask

            if isNull privKeyB64 || isNull pubKeyHex then
                return None
            else
                return
                    Some
                        { Crypto.Identity.PrivKey = Convert.FromBase64String privKeyB64
                          Crypto.Identity.PubKeyHex = pubKeyHex }
        }

    let saveIdentity (identity: Crypto.Identity) =
        task {
            do! SecureStorage.Default.SetAsync("identity_privkey", Convert.ToBase64String identity.PrivKey)
            do! SecureStorage.Default.SetAsync("identity_pubkey", identity.PubKeyHex)
        }

    let loadData () : Data option =
        try
            use db = openDb ()
            let settings = db.GetCollection<SettingsDoc>("settings").FindById(BsonValue "settings")

            if box settings |> isNull then
                None
            else
                let contacts = db.GetCollection<Contact>("contacts").FindAll() |> Seq.toList

                let messages =
                    db.GetCollection<MessageDoc>("messages").FindAll()
                    |> Seq.groupBy _.ConversationId
                    |> Seq.map (fun (convId, docs) ->
                        convId,
                        docs
                        |> Seq.map (fun d ->
                            { ChatMessage.Id = d.Id
                              Body = d.Body
                              Timestamp = DateTimeOffset.FromUnixTimeSeconds d.TimestampUnix
                              IsOutgoing = d.IsOutgoing })
                        |> Seq.sortBy _.Timestamp
                        |> Seq.toList)
                    |> Map.ofSeq

                Some
                    { Contacts = contacts
                      Messages = messages
                      ServerUrl = settings.ServerUrl
                      PollCursor = uint64 settings.PollCursor }
        with _ ->
            None

    let saveData (data: Data) =
        try
            use db = openDb ()
            let contacts = db.GetCollection<Contact>("contacts")
            let messages = db.GetCollection<MessageDoc>("messages")
            let settings = db.GetCollection<SettingsDoc>("settings")

            for c in data.Contacts do
                contacts.Upsert c |> ignore

            data.Messages
            |> Map.iter (fun convId msgs ->
                for m in msgs do
                    messages.Upsert
                        { Id = m.Id
                          ConversationId = convId
                          Body = m.Body
                          TimestampUnix = m.Timestamp.ToUnixTimeSeconds()
                          IsOutgoing = m.IsOutgoing }
                    |> ignore)

            settings.Upsert
                { Id = "settings"
                  ServerUrl = data.ServerUrl
                  PollCursor = int64 data.PollCursor }
            |> ignore
        with _ ->
            ()
