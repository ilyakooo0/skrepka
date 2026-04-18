namespace Skrepka

open System
open System.Net.Http
open System.Text
open System.Text.Json
open System.Text.Json.Serialization
open System.Threading.Tasks

module ApiClient =

    exception ApiError of string
    exception ServerRejected of string

    [<CLIMutable>]
    type EventPayload = { EncryptedBlob: string; Timestamp: int64 }

    [<JsonConverter(typeof<EventTypeConverter>)>]
    type EventType = Message | UnknownEvent of string
    and private EventTypeConverter() =
        inherit JsonConverter<EventType>()
        override _.Read(reader, _, _) =
            match reader.GetString() with
            | "message" -> Message
            | s -> UnknownEvent s
        override _.Write(writer, value, _) =
            writer.WriteStringValue(
                match value with
                | Message -> "message"
                | UnknownEvent s -> s)

    [<CLIMutable>]
    type PollEvent = { Id: string; EventType: EventType; Payload: EventPayload }

    [<CLIMutable>]
    type PollResponse = { Cursor: int64; Events: PollEvent array }

    /// Awaits a Task without converting TaskCanceledException to F# async
    /// cancellation (which bypasses try...with). Re-raises it as a regular exception.
    let private awaitTask (t: Task<'T>) : Async<'T> =
        Async.FromContinuations(fun (ok, err, _cancel) ->
            t.ContinueWith(fun (t: Task<'T>) ->
                if t.IsFaulted then err t.Exception.InnerException
                elif t.IsCanceled then err (TimeoutException("Request timed out"))
                else ok t.Result)
            |> ignore)

    let private jsonOpts =
        JsonSerializerOptions(PropertyNameCaseInsensitive = true, NumberHandling = JsonNumberHandling.AllowReadingFromString)

    let private client =
        let c = new HttpClient()
        c.Timeout <- TimeSpan.FromSeconds(60.)
        c

    let private pollClient =
        let c = new HttpClient()
        c.Timeout <- TimeSpan.FromSeconds(120.)
        c

    let private sendRequest (httpClient: HttpClient) (url: string) (body: string) (token: string option) =
        async {
            use request = new HttpRequestMessage(HttpMethod.Post, url)
            request.Content <- new StringContent(body, Encoding.UTF8, "application/json")
            token |> Option.iter (fun t -> request.Headers.Add("Authorization", $"Bearer {t}"))
            use! response = httpClient.SendAsync(request) |> awaitTask
            let! text = response.Content.ReadAsStringAsync() |> awaitTask
            let doc = JsonDocument.Parse(text)
            match doc.RootElement.TryGetProperty("error") with
            | true, err ->
                doc.Dispose()
                return raise (ApiError $"{url}: {err.GetString()}")
            | _ -> return doc
        }

    let private postJson<'T> httpClient url body token =
        async {
            use! doc = sendRequest httpClient url body token
            return doc.RootElement.Deserialize<'T>(jsonOpts)
        }

    let authenticate (serverUrl: string) (identity: Crypto.Identity) =
        async {
            let body = JsonSerializer.Serialize({| pubkey = identity.PubKeyHex |})
            use! challengeDoc = sendRequest client $"{serverUrl}/auth/challenge" body None
            let challenge = challengeDoc.RootElement.GetProperty("challenge").GetString()
            let sigHex = Crypto.signChallenge identity.PrivKey challenge
            let body = JsonSerializer.Serialize({| pubkey = identity.PubKeyHex; challenge = challenge; signature = sigHex |})
            use! tokenDoc = sendRequest client $"{serverUrl}/auth/verify" body None
            let token = tokenDoc.RootElement.GetProperty("token").GetString()
            if String.IsNullOrEmpty(token) then raise (ApiError "Authentication rejected by server")
            return token
        }

    let sendMessage (serverUrl: string) (token: string) (toHex: string) (blobHex: string) (timestamp: int64) =
        let body = JsonSerializer.Serialize({| ``to`` = toHex; encryptedBlob = blobHex; timestamp = timestamp |})
        async {
            use! doc = sendRequest client $"{serverUrl}/messages" body (Some token)
            match doc.RootElement.GetProperty("status").GetString() with
            | "delivered" | "federated" | "queued" -> ()
            | "rejected" -> raise (ServerRejected "Message rejected by server")
            | "unauthorized" -> raise (ServerRejected "Not authorized to deliver message")
            | s -> raise (ApiError $"Unexpected status: {s}")
        }

    let poll (serverUrl: string) (token: string) (cursor: int64) =
        let body = JsonSerializer.Serialize({| cursor = cursor |})
        postJson<PollResponse> pollClient $"{serverUrl}/poll" body (Some token)

    let ackMessages (serverUrl: string) (token: string) (messageIds: string list) =
        let body = JsonSerializer.Serialize({| messageIds = messageIds |})
        async {
            use! _ = sendRequest client $"{serverUrl}/messages/ack" body (Some token)
            ()
        }
