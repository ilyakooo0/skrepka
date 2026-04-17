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

    let private log msg = eprintfn $"[skrepka] {msg}"

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
        conn.Execute("PRAGMA busy_timeout = 5000") |> ignore
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
        conn.Execute("PRAGMA journal_mode=WAL") |> ignore

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

        // Schema versioning
        conn.Execute("CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        |> ignore

        let dbVersion =
            try
                conn.QueryFirstOrDefault<string>("SELECT value FROM schema_meta WHERE key = 'schema_version'")
                |> Option.ofObj
                |> Option.map int
                |> Option.defaultValue 0
            with ex ->
                log $"schema version check: {ex.Message}"
                0

        if dbVersion < 2 then
            conn.Execute("CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(ConversationId)")
            |> ignore

        conn.Execute(
            "INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', @v)",
            {| v = string Constants.schemaVersion |}
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
                        |> Option.bind (Convert.FromBase64String >> Crypto.identityFromPrivKey)
                    else
                        None
                with ex ->
                    log $"loadIdentity error: {ex.Message}"
                    None
        }

    let saveIdentity (identity: Crypto.Identity) =
        async {
            let b64 = Convert.ToBase64String identity.PrivKey
            File.WriteAllText(identityPath, b64)
        }

    let loadProfile () =
        async {
            try
                use conn = openConn ()

                let! rows =
                    select {
                        for p in profileTable do
                            where (p.Id = Constants.profileId)
                    }
                    |> conn.SelectAsync<ProfileRow>
                    |> Async.AwaitTask

                return
                    rows
                    |> Seq.tryHead
                    |> Option.map (fun p ->
                        { DisplayName = p.DisplayName
                          Bio = p.Bio
                          Photo = p.Photo })
            with ex ->
                log $"loadProfile error: {ex.Message}"
                return None
        }

    let saveProfile (profile: Profile) =
        async {
            try
                use conn = openConn ()

                do!
                    conn.ExecuteAsync(
                        "INSERT OR REPLACE INTO profile (Id, DisplayName, Bio, Photo) VALUES (@Id, @DisplayName, @Bio, @Photo)",
                        {| Id = Constants.profileId
                           DisplayName = profile.DisplayName
                           Bio = profile.Bio
                           Photo = profile.Photo |> Option.defaultValue null |}
                    )
                    |> Async.AwaitTask
                    |> Async.Ignore
            with ex ->
                log $"saveProfile error: {ex.Message}"
        }

    let loadData () =
        async {
            try
                use conn = openConn ()

                let! settings =
                    select {
                        for s in settingsTable do
                            where (s.Id = Constants.settingsId)
                    }
                    |> conn.SelectAsync<SettingsRow>
                    |> Async.AwaitTask

                match settings |> Seq.tryHead with
                | None -> return None
                | Some s ->
                    let! contactRows =
                        select {
                            for c in contactTable do
                                selectAll
                        }
                        |> conn.SelectAsync<ContactRow>
                        |> Async.AwaitTask

                    let contacts =
                        contactRows
                        |> Seq.map (fun c ->
                            let contact: Contact =
                                { Pubkey = c.Pubkey
                                  Nickname = c.Nickname
                                  DisplayName = c.DisplayName
                                  Bio = c.Bio
                                  Photo = c.Photo }

                            c.Pubkey, contact)
                        |> Map.ofSeq

                    let! messageRows =
                        conn.QueryAsync<MessageRow>(
                            $"SELECT Id, ConversationId, Body, TimestampUnix, IsOutgoing, Status FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY ConversationId ORDER BY TimestampUnix DESC) AS rn FROM messages) WHERE rn <= {Constants.maxMessages}"
                        )
                        |> Async.AwaitTask

                    let messages =
                        messageRows
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

                    return
                        Some
                            { Contacts = contacts
                              Messages = messages
                              ServerUrl = s.ServerUrl
                              PollCursor = s.PollCursor }
            with ex ->
                log $"loadData error: {ex.Message}"
                return None
        }

    let saveData (data: Data) =
        async {
            try
                use conn = openConn ()
                use tx = conn.BeginTransaction()

                for c in data.Contacts.Values do
                    do!
                        conn.ExecuteAsync(
                            "INSERT OR REPLACE INTO contacts (Pubkey, Nickname, DisplayName, Bio, Photo) VALUES (@Pubkey, @Nickname, @DisplayName, @Bio, @Photo)",
                            {| Pubkey = c.Pubkey
                               Nickname = c.Nickname
                               DisplayName = c.DisplayName
                               Bio = c.Bio
                               Photo = c.Photo |},
                            tx
                        )
                        |> Async.AwaitTask
                        |> Async.Ignore

                for KeyValue(convId, msgs) in data.Messages do
                    for m in msgs do
                        let isOutgoing, status =
                            match m.Direction with
                            | Incoming -> false, 0
                            | Outgoing DeliveryStatus.Delivered -> true, 1
                            | Outgoing DeliveryStatus.Sent -> true, 0

                        do!
                            conn.ExecuteAsync(
                                "INSERT OR REPLACE INTO messages (Id, ConversationId, Body, TimestampUnix, IsOutgoing, Status) VALUES (@Id, @ConversationId, @Body, @TimestampUnix, @IsOutgoing, @Status)",
                                {| Id = m.Id
                                   ConversationId = convId
                                   Body = m.Body
                                   TimestampUnix = m.Timestamp.ToUnixTimeMilliseconds()
                                   IsOutgoing = isOutgoing
                                   Status = status |},
                                tx
                            )
                            |> Async.AwaitTask
                            |> Async.Ignore

                do!
                    conn.ExecuteAsync(
                        "INSERT OR REPLACE INTO settings (Id, ServerUrl, PollCursor) VALUES (@Id, @ServerUrl, @PollCursor)",
                        {| Id = Constants.settingsId
                           ServerUrl = data.ServerUrl
                           PollCursor = data.PollCursor |},
                        tx
                    )
                    |> Async.AwaitTask
                    |> Async.Ignore

                tx.Commit()
            with ex ->
                log $"saveData error: {ex.Message}"
        }

    let enqueueOutbox (recipientHex: string) (envelopeJson: string) =
        async {
            try
                use conn = openConn ()

                do!
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
                    |> Async.Ignore
            with ex ->
                log $"enqueueOutbox error: {ex.Message}"
        }

    let peekOutbox () =
        async {
            try
                use conn = openConn ()

                let! rows =
                    conn.QueryAsync<OutboxRow>(
                        "SELECT Id, RecipientHex, EnvelopeJson, CreatedAt FROM outbox ORDER BY Id LIMIT 1"
                    )
                    |> Async.AwaitTask

                return rows |> Seq.tryHead
            with ex ->
                log $"peekOutbox error: {ex.Message}"
                return None
        }

    let dequeueOutbox (id: int64) =
        async {
            try
                use conn = openConn ()

                do!
                    delete {
                        for o in outboxTable do
                            where (o.Id = id)
                    }
                    |> conn.DeleteAsync
                    |> Async.AwaitTask
                    |> Async.Ignore
            with ex ->
                log $"dequeueOutbox error: {ex.Message}"
        }

    let loadMessagesForConversation (conversationId: string) =
        async {
            try
                use conn = openConn ()

                let! rows =
                    conn.QueryAsync<MessageRow>(
                        "SELECT Id, ConversationId, Body, TimestampUnix, IsOutgoing, Status FROM messages WHERE ConversationId = @convId ORDER BY TimestampUnix",
                        {| convId = conversationId |}
                    )
                    |> Async.AwaitTask

                return
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
                    |> Seq.toList
            with ex ->
                log $"loadMessagesForConversation error: {ex.Message}"
                return []
        }
