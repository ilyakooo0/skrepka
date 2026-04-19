namespace Skrepka

open System
open System.Data
open System.IO
open Donald
open Microsoft.Data.Sqlite

module Store =

    type Contact =
        { Pubkey: string
          Nickname: string
          DisplayName: string
          Bio: string
          Photo: byte[] option
          AddedDate: DateTimeOffset }

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
        conn |> Db.newCommand "PRAGMA busy_timeout = 5000" |> Db.exec
        conn

    // ── Readers ──

    let private readContact (rd: IDataReader) : Contact =
        { Pubkey = rd.ReadString "Pubkey"
          Nickname = rd.ReadString "Nickname"
          DisplayName = rd.ReadString "DisplayName"
          Bio = rd.ReadString "Bio"
          Photo = rd.ReadBytesOption "Photo"
          AddedDate = rd.ReadInt64 "AddedDateUnix" |> DateTimeOffset.FromUnixTimeMilliseconds }

    let private readMessage (rd: IDataReader) : ChatMessage =
        let isOutgoing = rd.ReadBoolean "IsOutgoing"
        let status = rd.ReadInt32 "Status"

        { Id = rd.ReadString "Id"
          Body = rd.ReadString "Body"
          Timestamp = rd.ReadInt64 "TimestampUnix" |> DateTimeOffset.FromUnixTimeMilliseconds
          Direction =
            if not isOutgoing then
                Incoming
            else
                Outgoing(
                    if status = 1 then
                        DeliveryStatus.Delivered
                    else
                        DeliveryStatus.Sent
                ) }

    // ── Schema ──

    do
        use conn = openConn ()
        conn |> Db.newCommand "PRAGMA journal_mode=WAL" |> Db.exec

        conn
        |> Db.newCommand
            "CREATE TABLE IF NOT EXISTS profile (Id TEXT PRIMARY KEY, DisplayName TEXT NOT NULL DEFAULT '', Bio TEXT NOT NULL DEFAULT '', Photo BLOB)"
        |> Db.exec

        conn
        |> Db.newCommand
            "CREATE TABLE IF NOT EXISTS contacts (Pubkey TEXT PRIMARY KEY, Nickname TEXT NOT NULL DEFAULT '', DisplayName TEXT NOT NULL DEFAULT '', Bio TEXT NOT NULL DEFAULT '', Photo BLOB, AddedDateUnix INTEGER NOT NULL DEFAULT 0)"
        |> Db.exec

        // Migration: add AddedDateUnix to existing contacts tables
        try
            conn
            |> Db.newCommand "ALTER TABLE contacts ADD COLUMN AddedDateUnix INTEGER NOT NULL DEFAULT 0"
            |> Db.exec
        with _ ->
            ()

        conn
        |> Db.newCommand
            "CREATE TABLE IF NOT EXISTS messages (Id TEXT PRIMARY KEY, ConversationId TEXT NOT NULL, Body TEXT NOT NULL DEFAULT '', TimestampUnix INTEGER NOT NULL, IsOutgoing INTEGER NOT NULL DEFAULT 0, Status INTEGER NOT NULL DEFAULT 0)"
        |> Db.exec

        conn
        |> Db.newCommand
            "CREATE TABLE IF NOT EXISTS settings (Id TEXT PRIMARY KEY, ServerUrl TEXT NOT NULL DEFAULT '', PollCursor INTEGER NOT NULL DEFAULT 0)"
        |> Db.exec

        conn
        |> Db.newCommand
            "CREATE TABLE IF NOT EXISTS outbox (Id INTEGER PRIMARY KEY AUTOINCREMENT, RecipientHex TEXT NOT NULL, EnvelopeJson TEXT NOT NULL, CreatedAt INTEGER NOT NULL)"
        |> Db.exec

        conn
        |> Db.newCommand "CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
        |> Db.exec

        let dbVersion =
            try
                conn
                |> Db.newCommand "SELECT value FROM schema_meta WHERE key = 'schema_version'"
                |> Db.querySingle (fun rd -> rd.ReadString "value" |> int)
                |> Option.defaultValue 0
            with ex ->
                log $"schema version check: {ex.Message}"
                0

        if dbVersion < 2 then
            conn
            |> Db.newCommand "CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(ConversationId)"
            |> Db.exec

        conn
        |> Db.newCommand "INSERT OR REPLACE INTO schema_meta (key, value) VALUES (@key, @value)"
        |> Db.setParams
            [ "key", SqlType.String "schema_version"
              "value", SqlType.String(string Constants.schemaVersion) ]
        |> Db.exec

    // ── Identity ──

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

    // ── Profile ──

    let loadProfile () =
        async {
            try
                use conn = openConn ()

                return
                    conn
                    |> Db.newCommand "SELECT DisplayName, Bio, Photo FROM profile WHERE Id = @Id"
                    |> Db.setParams [ "Id", SqlType.String Constants.profileId ]
                    |> Db.querySingle (fun rd ->
                        { DisplayName = rd.ReadString "DisplayName"
                          Bio = rd.ReadString "Bio"
                          Photo = rd.ReadBytesOption "Photo" })
            with ex ->
                log $"loadProfile error: {ex.Message}"
                return None
        }

    let saveProfile (profile: Profile) =
        async {
            try
                use conn = openConn ()

                conn
                |> Db.newCommand
                    "INSERT OR REPLACE INTO profile (Id, DisplayName, Bio, Photo) VALUES (@Id, @DisplayName, @Bio, @Photo)"
                |> Db.setParams
                    [ "Id", SqlType.String Constants.profileId
                      "DisplayName", SqlType.String profile.DisplayName
                      "Bio", SqlType.String profile.Bio
                      "Photo", SqlType.sqlBytesOrNull profile.Photo ]
                |> Db.exec
            with ex ->
                log $"saveProfile error: {ex.Message}"
        }

    // ── Data ──

    let loadData () =
        async {
            try
                use conn = openConn ()

                let settings =
                    conn
                    |> Db.newCommand "SELECT ServerUrl, PollCursor FROM settings WHERE Id = @Id"
                    |> Db.setParams [ "Id", SqlType.String Constants.settingsId ]
                    |> Db.querySingle (fun rd -> rd.ReadString "ServerUrl", rd.ReadInt64 "PollCursor")

                match settings with
                | None -> return None
                | Some(serverUrl, pollCursor) ->
                    let contacts =
                        conn
                        |> Db.newCommand "SELECT Pubkey, Nickname, DisplayName, Bio, Photo, AddedDateUnix FROM contacts"
                        |> Db.query readContact
                        |> List.map (fun c -> c.Pubkey, c)
                        |> Map.ofList

                    let messages =
                        conn
                        |> Db.newCommand
                            $"SELECT Id, Body, TimestampUnix, IsOutgoing, Status, ConversationId FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY ConversationId ORDER BY TimestampUnix DESC) AS rn FROM messages) WHERE rn <= {Constants.maxMessages}"
                        |> Db.query (fun rd -> rd.ReadString "ConversationId", readMessage rd)
                        |> List.groupBy fst
                        |> List.map (fun (convId, pairs) -> convId, pairs |> List.map snd |> List.sortBy _.Timestamp)
                        |> Map.ofList

                    return
                        Some
                            { Contacts = contacts
                              Messages = messages
                              ServerUrl = serverUrl
                              PollCursor = pollCursor }
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
                    conn
                    |> Db.newCommand
                        "INSERT OR REPLACE INTO contacts (Pubkey, Nickname, DisplayName, Bio, Photo, AddedDateUnix) VALUES (@Pubkey, @Nickname, @DisplayName, @Bio, @Photo, @AddedDateUnix)"
                    |> Db.setParams
                        [ "Pubkey", SqlType.String c.Pubkey
                          "Nickname", SqlType.String c.Nickname
                          "DisplayName", SqlType.String c.DisplayName
                          "Bio", SqlType.String c.Bio
                          "Photo",
                          (match c.Photo with
                           | Some bytes -> SqlType.Bytes bytes
                           | None -> SqlType.Null)
                          "AddedDateUnix", SqlType.Int64(c.AddedDate.ToUnixTimeMilliseconds()) ]
                    |> Db.exec

                for KeyValue(convId, msgs) in data.Messages do
                    for m in msgs do
                        let isOutgoing, status =
                            match m.Direction with
                            | Incoming -> false, 0
                            | Outgoing DeliveryStatus.Delivered -> true, 1
                            | Outgoing DeliveryStatus.Sent -> true, 0

                        conn
                        |> Db.newCommand
                            "INSERT OR REPLACE INTO messages (Id, ConversationId, Body, TimestampUnix, IsOutgoing, Status) VALUES (@Id, @ConversationId, @Body, @TimestampUnix, @IsOutgoing, @Status)"
                        |> Db.setParams
                            [ "Id", SqlType.String m.Id
                              "ConversationId", SqlType.String convId
                              "Body", SqlType.String m.Body
                              "TimestampUnix", SqlType.Int64(m.Timestamp.ToUnixTimeMilliseconds())
                              "IsOutgoing", SqlType.Boolean isOutgoing
                              "Status", SqlType.Int32 status ]
                        |> Db.exec

                conn
                |> Db.newCommand
                    "INSERT OR REPLACE INTO settings (Id, ServerUrl, PollCursor) VALUES (@Id, @ServerUrl, @PollCursor)"
                |> Db.setParams
                    [ "Id", SqlType.String Constants.settingsId
                      "ServerUrl", SqlType.String data.ServerUrl
                      "PollCursor", SqlType.Int64 data.PollCursor ]
                |> Db.exec

                tx.Commit()
            with ex ->
                log $"saveData error: {ex.Message}"
        }

    // ── Outbox ──

    let enqueueOutbox (recipientHex: string) (envelopeJson: string) =
        async {
            try
                use conn = openConn ()

                conn
                |> Db.newCommand
                    "INSERT INTO outbox (RecipientHex, EnvelopeJson, CreatedAt) VALUES (@RecipientHex, @EnvelopeJson, @CreatedAt)"
                |> Db.setParams
                    [ "RecipientHex", SqlType.String recipientHex
                      "EnvelopeJson", SqlType.String envelopeJson
                      "CreatedAt", SqlType.Int64(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()) ]
                |> Db.exec
            with ex ->
                log $"enqueueOutbox error: {ex.Message}"
        }

    let peekOutbox () =
        async {
            try
                use conn = openConn ()

                return
                    conn
                    |> Db.newCommand "SELECT Id, RecipientHex, EnvelopeJson, CreatedAt FROM outbox ORDER BY Id LIMIT 1"
                    |> Db.querySingle (fun rd ->
                        {| Id = rd.ReadInt64 "Id"
                           RecipientHex = rd.ReadString "RecipientHex"
                           EnvelopeJson = rd.ReadString "EnvelopeJson" |})
            with ex ->
                log $"peekOutbox error: {ex.Message}"
                return None
        }

    let dequeueOutbox (id: int64) =
        async {
            try
                use conn = openConn ()

                conn
                |> Db.newCommand "DELETE FROM outbox WHERE Id = @Id"
                |> Db.setParams [ "Id", SqlType.Int64 id ]
                |> Db.exec
            with ex ->
                log $"dequeueOutbox error: {ex.Message}"
        }

    let loadMessagesForConversation (conversationId: string) =
        async {
            try
                use conn = openConn ()

                return
                    conn
                    |> Db.newCommand
                        "SELECT Id, Body, TimestampUnix, IsOutgoing, Status FROM messages WHERE ConversationId = @convId ORDER BY TimestampUnix"
                    |> Db.setParams [ "convId", SqlType.String conversationId ]
                    |> Db.query readMessage
            with ex ->
                log $"loadMessagesForConversation error: {ex.Message}"
                return []
        }
