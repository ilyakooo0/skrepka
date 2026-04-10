namespace Skrepka

open System
open System.Net.Http
open System.Text
open System.Text.Json
open System.Threading.Tasks

module ApiClient =

    type EventPayload = { EncryptedBlob: string; Timestamp: int64 }
    type PollEvent = { Id: string; Payload: EventPayload }

    type AuthResult = { Token: string; ExpiresAt: int64 }
    type SendResult = { Status: string; MessageId: string }
    type PollResponse = { Events: PollEvent list; Cursor: uint64 }

    /// Awaits a Task without converting TaskCanceledException to F# async
    /// cancellation (which bypasses try...with). Re-raises it as a regular exception.
    let private awaitTask (t: Task<'T>) : Async<'T> =
        Async.FromContinuations(fun (ok, err, _cancel) ->
            t.ContinueWith(fun (t: Task<'T>) ->
                if t.IsFaulted then err t.Exception.InnerException
                elif t.IsCanceled then err (TimeoutException("Request timed out"))
                else ok t.Result)
            |> ignore)

    let private client =
        let c = new HttpClient()
        c.Timeout <- TimeSpan.FromSeconds(60.)
        c

    let private postJson (url: string) (body: string) (token: string option) =
        async {
            let request = new HttpRequestMessage(HttpMethod.Post, url)
            request.Content <- new StringContent(body, Encoding.UTF8, "application/json")

            token
            |> Option.iter (fun t -> request.Headers.Add("Authorization", $"Bearer {t}"))

            let! response = client.SendAsync(request) |> awaitTask
            let! text = response.Content.ReadAsStringAsync() |> awaitTask
            return JsonDocument.Parse(text)
        }

    let private getJson (url: string) (token: string) =
        async {
            let request = new HttpRequestMessage(HttpMethod.Get, url)
            request.Headers.Add("Authorization", $"Bearer {token}")
            let! response = client.SendAsync(request) |> awaitTask
            let! text = response.Content.ReadAsStringAsync() |> awaitTask
            return JsonDocument.Parse(text)
        }

    let private expectObject (doc: JsonDocument) (endpoint: string) =
        let root = doc.RootElement

        if root.ValueKind <> JsonValueKind.Object then
            failwith $"{endpoint}: unexpected response: {root.GetRawText()}"

        match root.TryGetProperty("error") with
        | true, err -> failwith $"{endpoint}: server error: {err.GetString()}"
        | _ -> root

    let requestChallenge (serverUrl: string) (pubkeyHex: string) =
        async {
            let body = JsonSerializer.Serialize({| pubkey = pubkeyHex |})
            let! doc = postJson $"{serverUrl}/auth/challenge" body None
            let root = expectObject doc "/auth/challenge"
            return root.GetProperty("challenge").GetString()
        }

    let verify (serverUrl: string) (pubkeyHex: string) (challenge: string) (signatureHex: string) =
        async {
            let body = JsonSerializer.Serialize({| pubkey = pubkeyHex; challenge = challenge; signature = signatureHex |})

            let! doc = postJson $"{serverUrl}/auth/verify" body None
            let root = expectObject doc "/auth/verify"
            return
                { Token = root.GetProperty("token").GetString()
                  ExpiresAt = root.GetProperty("expiresAt").GetInt64() }
        }

    let sendMessage (serverUrl: string) (token: string) (toHex: string) (blobHex: string) (timestamp: int64) =
        async {
            let body = JsonSerializer.Serialize({| ``to`` = toHex; encryptedBlob = blobHex; timestamp = timestamp |})

            let! doc = postJson $"{serverUrl}/messages" body (Some token)
            let root = expectObject doc "/messages"
            return
                { Status = root.GetProperty("status").GetString()
                  MessageId = root.GetProperty("messageId").GetString() }
        }

    let private pollClient =
        let c = new HttpClient()
        c.Timeout <- TimeSpan.FromSeconds(120.)
        c

    let poll (serverUrl: string) (token: string) (cursor: uint64) =
        async {
            let request = new HttpRequestMessage(HttpMethod.Post, $"{serverUrl}/poll")
            request.Content <- new StringContent(JsonSerializer.Serialize({| cursor = cursor; timeout = 30000 |}), Encoding.UTF8, "application/json")
            request.Headers.Add("Authorization", $"Bearer {token}")

            let! response = pollClient.SendAsync(request) |> awaitTask
            let! text = response.Content.ReadAsStringAsync() |> awaitTask
            let doc = JsonDocument.Parse(text)
            let root = expectObject doc "/poll"
            let cursor = root.GetProperty("cursor").GetUInt64()

            let events = root.GetProperty("events")

            let events =
                [ for e in events.EnumerateArray() do
                      if e.ValueKind = JsonValueKind.Object
                         && e.GetProperty("eventType").GetString() = "message" then
                          let p = e.GetProperty("payload")
                          let ts = p.GetProperty("timestamp")
                          yield
                              { Id = e.GetProperty("id").GetString()
                                Payload =
                                    { EncryptedBlob = p.GetProperty("encryptedBlob").GetString()
                                      Timestamp = if ts.ValueKind = JsonValueKind.String then Int64.Parse(ts.GetString()) else ts.GetInt64() } } ]

            return { Events = events; Cursor = cursor }
        }

    let ackMessages (serverUrl: string) (token: string) (messageIds: string list) =
        async {
            let body = JsonSerializer.Serialize({| messageIds = messageIds |})
            do! postJson $"{serverUrl}/messages/ack" body (Some token) |> Async.Ignore
        }
