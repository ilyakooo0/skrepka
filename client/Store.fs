namespace Skrepka

open System
open System.IO
open Dapper
open Microsoft.Data.Sqlite
open Dapper.FSharp.SQLite

module Store =

    type Contact =
        { Pubkey: string
          Nickname: string
          DisplayName: string
          Bio: string
          Photo: byte[] option }

    type Profile =
        { DisplayName: string
          Bio: string
          Photo: byte[] option }

    [<RequireQualifiedAccess>]
    type DeliveryStatus =
        | Sent
        | Delivered

    type MessageDirection =
        | Incoming
        | Outgoing of DeliveryStatus

    type ChatMessage =
        { Id: string
          Body: string
          Timestamp: DateTimeOffset
          Direction: MessageDirection }

    type Data =
        { Contacts: Map<string, Contact>
          Messages: Map<string, ChatMessage list>
          ServerUrl: string
          PollCursor: int64 }

    // DB row types matching table columns
    [<CLIMutable>]
    type ProfileRow =
        { Id: string
          DisplayName: string
          Bio: string
          Photo: byte[] option }

    [<CLIMutable>]
    type ContactRow =
        { Pubkey: string
          Nickname: string
          DisplayName: string
          Bio: string
          Photo: byte[] option }

    [<CLIMutable>]
    type MessageRow =
        { Id: string
          ConversationId: string
          Body: string
          TimestampUnix: int64
          IsOutgoing: bool
          Status: int }

    [<CLIMutable>]
    type SettingsRow =
        { Id: string
          ServerUrl: string
          PollCursor: int64 }

    [<CLIMutable>]
    type OutboxRow =
        { Id: int64
          RecipientHex: string
          EnvelopeJson: string
          CreatedAt: int64 }

    let private profileTable = table'<ProfileRow> "profile"
    let private contactTable = table'<ContactRow> "contacts"
    let private messageTable = table'<MessageRow> "messages"
    let private settingsTable = table'<SettingsRow> "settings"
    let private outboxTable = table'<OutboxRow> "outbox"

    let private appDataDir =
        let baseDir =
            let appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData)

            if String.IsNullOrEmpty(appData) then
                let personal = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments)

                if String.IsNullOrEmpty(personal) then
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Skrepka")
                else
                    Path.Combine(personal, "Skrepka")
            else
                Path.Combine(appData, "Skrepka")

        Directory.CreateDirectory(baseDir) |> ignore
        baseDir

    let private dbPath = Path.Combine(appDataDir, "skrepka.db")

    let private openConn () =
        let conn = new SqliteConnection($"Data Source={dbPath}")
        conn.Open()
        conn

    type private ByteArrayOptionHandler() =
        inherit SqlMapper.TypeHandler<byte[] option>()

        override _.SetValue(p, value) =
            p.Value <-
                match value with
                | Some v -> box v
                | None -> box DBNull.Value

        override _.Parse(value) =
            if value = null || value :? DBNull then
                None
            else
                Some(value :?> byte[])

    do
        OptionTypes.register ()
        SqlMapper.AddTypeHandler(ByteArrayOptionHandler())
        use conn = openConn ()

        conn.Execute(
            "CREATE TABLE IF NOT EXISTS profile (Id TEXT PRIMARY KEY, DisplayName TEXT NOT NULL DEFAULT '', Bio TEXT NOT NULL DEFAULT '', Photo BLOB)"
        )
        |> ignore

        conn.Execute(
            "CREATE TABLE IF NOT EXISTS contacts (Pubkey TEXT PRIMARY KEY, Nickname TEXT NOT NULL DEFAULT '', DisplayName TEXT NOT NULL DEFAULT '', Bio TEXT NOT NULL DEFAULT '', Photo BLOB)"
        )
        |> ignore

        conn.Execute(
            "CREATE TABLE IF NOT EXISTS messages (Id TEXT PRIMARY KEY, ConversationId TEXT NOT NULL, Body TEXT NOT NULL DEFAULT '', TimestampUnix INTEGER NOT NULL, IsOutgoing INTEGER NOT NULL DEFAULT 0, Status INTEGER NOT NULL DEFAULT 0)"
        )
        |> ignore

        conn.Execute(
            "CREATE TABLE IF NOT EXISTS settings (Id TEXT PRIMARY KEY, ServerUrl TEXT NOT NULL DEFAULT '', PollCursor INTEGER NOT NULL DEFAULT 0)"
        )
        |> ignore

        conn.Execute(
            "CREATE TABLE IF NOT EXISTS outbox (Id INTEGER PRIMARY KEY AUTOINCREMENT, RecipientHex TEXT NOT NULL, EnvelopeJson TEXT NOT NULL, CreatedAt INTEGER NOT NULL)"
        )
        |> ignore

    let private identityPath = Path.Combine(appDataDir, "identity.key")

    let loadIdentity () =
        async {
            return
                try
                    if File.Exists(identityPath) then
                        File.ReadAllText(identityPath)
                        |> Option.ofObj
                        |> Option.filter (fun s -> s <> "")
                        |> Option.map (Convert.FromBase64String >> Crypto.identityFromPrivKey)
                    else
                        None
                with _ ->
                    None
        }

    let saveIdentity (identity: Crypto.Identity) =
        async {
            let b64 = Convert.ToBase64String identity.PrivKey
            File.WriteAllText(identityPath, b64)
        }

    let loadProfile () : Profile option =
        try
            use conn = openConn ()

            select {
                for p in profileTable do
                    where (p.Id = "me")
            }
            |> conn.SelectAsync<ProfileRow>
            |> Async.AwaitTask
            |> Async.RunSynchronously
            |> Seq.tryHead
            |> Option.map (fun p ->
                { DisplayName = p.DisplayName
                  Bio = p.Bio
                  Photo = p.Photo })
        with _ ->
            None

    let saveProfile (profile: Profile) =
        try
            use conn = openConn ()

            conn.Execute(
                "INSERT OR REPLACE INTO profile (Id, DisplayName, Bio, Photo) VALUES (@Id, @DisplayName, @Bio, @Photo)",
                {| Id = "me"
                   DisplayName = profile.DisplayName
                   Bio = profile.Bio
                   Photo = profile.Photo |> Option.defaultValue null |}
            )
            |> ignore
        with _ ->
            ()

    let loadData () : Data option =
        try
            use conn = openConn ()

            let settings =
                select {
                    for s in settingsTable do
                        where (s.Id = "settings")
                }
                |> conn.SelectAsync<SettingsRow>
                |> Async.AwaitTask
                |> Async.RunSynchronously
                |> Seq.tryHead

            settings
            |> Option.map (fun s ->
                let contacts =
                    select {
                        for c in contactTable do
                            selectAll
                    }
                    |> conn.SelectAsync<ContactRow>
                    |> Async.AwaitTask
                    |> Async.RunSynchronously
                    |> Seq.map (fun c ->
                        let contact: Contact =
                            { Pubkey = c.Pubkey
                              Nickname = c.Nickname
                              DisplayName = c.DisplayName
                              Bio = c.Bio
                              Photo = c.Photo }

                        c.Pubkey, contact)
                    |> Map.ofSeq

                let messages =
                    select {
                        for m in messageTable do
                            selectAll
                    }
                    |> conn.SelectAsync<MessageRow>
                    |> Async.AwaitTask
                    |> Async.RunSynchronously
                    |> Seq.groupBy _.ConversationId
                    |> Seq.map (fun (convId, rows) ->
                        convId,
                        rows
                        |> Seq.map (fun m ->
                            { Id = m.Id
                              Body = m.Body
                              Timestamp = DateTimeOffset.FromUnixTimeMilliseconds m.TimestampUnix
                              Direction =
                                if not m.IsOutgoing then
                                    Incoming
                                else
                                    Outgoing(
                                        if m.Status = 1 then
                                            DeliveryStatus.Delivered
                                        else
                                            DeliveryStatus.Sent
                                    ) })
                        |> Seq.sortBy _.Timestamp
                        |> Seq.toList)
                    |> Map.ofSeq

                { Contacts = contacts
                  Messages = messages
                  ServerUrl = s.ServerUrl
                  PollCursor = s.PollCursor })
        with _ ->
            None

    let saveData (data: Data) =
        try
            use conn = openConn ()

            for c in data.Contacts.Values do
                conn.Execute(
                    "INSERT OR REPLACE INTO contacts (Pubkey, Nickname, DisplayName, Bio, Photo) VALUES (@Pubkey, @Nickname, @DisplayName, @Bio, @Photo)",
                    {| Pubkey = c.Pubkey
                       Nickname = c.Nickname
                       DisplayName = c.DisplayName
                       Bio = c.Bio
                       Photo = c.Photo |}
                )
                |> ignore

            data.Messages
            |> Map.iter (fun convId msgs ->
                for m in msgs do
                    let isOutgoing, status =
                        match m.Direction with
                        | Incoming -> false, 0
                        | Outgoing DeliveryStatus.Delivered -> true, 1
                        | Outgoing DeliveryStatus.Sent -> true, 0

                    conn.Execute(
                        "INSERT OR REPLACE INTO messages (Id, ConversationId, Body, TimestampUnix, IsOutgoing, Status) VALUES (@Id, @ConversationId, @Body, @TimestampUnix, @IsOutgoing, @Status)",
                        {| Id = m.Id
                           ConversationId = convId
                           Body = m.Body
                           TimestampUnix = m.Timestamp.ToUnixTimeMilliseconds()
                           IsOutgoing = isOutgoing
                           Status = status |}
                    )
                    |> ignore)

            conn.Execute(
                "INSERT OR REPLACE INTO settings (Id, ServerUrl, PollCursor) VALUES (@Id, @ServerUrl, @PollCursor)",
                {| Id = "settings"
                   ServerUrl = data.ServerUrl
                   PollCursor = data.PollCursor |}
            )
            |> ignore
        with _ ->
            ()

    let enqueueOutbox (recipientHex: string) (envelopeJson: string) =
        use conn = openConn ()

        insert {
            for o in outboxTable do
                value
                    { Id = 0L
                      RecipientHex = recipientHex
                      EnvelopeJson = envelopeJson
                      CreatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() }

                excludeColumn o.Id
        }
        |> conn.InsertAsync
        |> Async.AwaitTask
        |> Async.RunSynchronously
        |> ignore

    let peekOutbox () : OutboxRow option =
        use conn = openConn ()

        select {
            for o in outboxTable do
                orderBy o.Id
        }
        |> conn.SelectAsync<OutboxRow>
        |> Async.AwaitTask
        |> Async.RunSynchronously
        |> Seq.tryHead

    let dequeueOutbox (id: int64) =
        use conn = openConn ()

        delete {
            for o in outboxTable do
                where (o.Id = id)
        }
        |> conn.DeleteAsync
        |> Async.AwaitTask
        |> Async.RunSynchronously
        |> ignore
