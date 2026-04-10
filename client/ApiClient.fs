namespace Skrepka

open System
open System.Net.Http
open System.Text
open System.Text.Json
open System.Text.Json.Serialization
open System.Threading.Tasks

module ApiClient =

    [<CLIMutable>]
    type EventPayload = { EncryptedBlob: string; Timestamp: int64 }

    [<CLIMutable>]
    type PollEvent = { Id: string; EventType: string; Payload: EventPayload }

    type MessageStatus = Delivered | Federated | Queued | Rejected | Unauthorized

    [<CLIMutable>]
    type SendResult = { Status: MessageStatus; MessageId: string }

    [<CLIMutable>]
    type PollResponse = { Cursor: int64; Events: PollEvent array }

    [<CLIMutable>]
    type private ChallengeResponse = { challenge: string }

    [<CLIMutable>]
    type private VerifyResponse = { token: string }

    /// Awaits a Task without converting TaskCanceledException to F# async
    /// cancellation (which bypasses try...with). Re-raises it as a regular exception.
    let private awaitTask (t: Task<'T>) : Async<'T> =
        Async.FromContinuations(fun (ok, err, _cancel) ->
            t.ContinueWith(fun (t: Task<'T>) ->
                if t.IsFaulted then err t.Exception.InnerException
                elif t.IsCanceled then err (TimeoutException("Request timed out"))
                else ok t.Result)
            |> ignore)

    type private MessageStatusConverter() =
        inherit JsonConverter<MessageStatus>()
        override _.Read(reader, _, _) =
            match reader.GetString() with
            | "delivered" -> Delivered
            | "federated" -> Federated
            | "queued" -> Queued
            | "rejected" -> Rejected
            | "unauthorized" -> Unauthorized
            | s -> failwith $"Unknown message status: {s}"
        override _.Write(writer, value, _) =
            writer.WriteStringValue(
                match value with
                | Delivered -> "delivered"
                | Federated -> "federated"
                | Queued -> "queued"
                | Rejected -> "rejected"
                | Unauthorized -> "unauthorized")

    let private jsonOpts =
        let opts = JsonSerializerOptions(PropertyNameCaseInsensitive = true, NumberHandling = JsonNumberHandling.AllowReadingFromString)
        opts.Converters.Add(MessageStatusConverter())
        opts

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
            use doc = JsonDocument.Parse(text)
            match doc.RootElement.TryGetProperty("error") with
            | true, err -> return failwith $"{url}: {err.GetString()}"
            | _ -> return text
        }

    let private post httpClient url body token =
        sendRequest httpClient url body token |> Async.Ignore

    let private postJson<'T> httpClient url body token =
        async {
            let! text = sendRequest httpClient url body token
            return JsonSerializer.Deserialize<'T>(text, jsonOpts)
        }

    let authenticate (serverUrl: string) (identity: Crypto.Identity) =
        async {
            let body = JsonSerializer.Serialize({| pubkey = identity.PubKeyHex |})
            let! resp = postJson<ChallengeResponse> client $"{serverUrl}/auth/challenge" body None
            let sigHex = Crypto.signChallenge identity.PrivKey resp.challenge
            let body = JsonSerializer.Serialize({| pubkey = identity.PubKeyHex; challenge = resp.challenge; signature = sigHex |})
            let! resp = postJson<VerifyResponse> client $"{serverUrl}/auth/verify" body None
            if String.IsNullOrEmpty(resp.token) then failwith "Authentication rejected by server"
            return resp.token
        }

    let sendMessage (serverUrl: string) (token: string) (toHex: string) (blobHex: string) (timestamp: int64) =
        async {
            let body = JsonSerializer.Serialize({| ``to`` = toHex; encryptedBlob = blobHex; timestamp = timestamp |})
            return! postJson<SendResult> client $"{serverUrl}/messages" body (Some token)
        }

    let poll (serverUrl: string) (token: string) (cursor: int64) =
        async {
            let body = JsonSerializer.Serialize({| cursor = cursor; timeout = 30000 |})
            let! response = postJson<PollResponse> pollClient $"{serverUrl}/poll" body (Some token)
            return
                { response with
                    Events = response.Events |> Array.filter (fun e -> e.EventType = "message") }
        }

    let ackMessages (serverUrl: string) (token: string) (messageIds: string list) =
        async {
            let body = JsonSerializer.Serialize({| messageIds = messageIds |})
            do! post client $"{serverUrl}/messages/ack" body (Some token)
        }
