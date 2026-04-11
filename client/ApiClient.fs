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

    [<JsonConverter(typeof<MessageStatusConverter>)>]
    type MessageStatus = Delivered | Federated | Queued | Rejected | Unauthorized | UnknownStatus of string
    and private MessageStatusConverter() =
        inherit JsonConverter<MessageStatus>()
        override _.Read(reader, _, _) =
            match reader.GetString() with
            | "delivered" -> Delivered
            | "federated" -> Federated
            | "queued" -> Queued
            | "rejected" -> Rejected
            | "unauthorized" -> Unauthorized
            | s -> UnknownStatus s
        override _.Write(writer, value, _) =
            writer.WriteStringValue(
                match value with
                | Delivered -> "delivered"
                | Federated -> "federated"
                | Queued -> "queued"
                | Rejected -> "rejected"
                | Unauthorized -> "unauthorized"
                | UnknownStatus s -> s)

    let messageStatusToError = function
        | Delivered | Federated | Queued -> None
        | Rejected -> Some "Message rejected by server"
        | Unauthorized -> Some "Not authorized to deliver message"
        | UnknownStatus s -> Some $"Unexpected status: {s}"

    [<CLIMutable>]
    type private SendResult = { Status: MessageStatus }

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
            use doc = JsonDocument.Parse(text)
            match doc.RootElement.TryGetProperty("error") with
            | true, err -> return failwith $"{url}: {err.GetString()}"
            | _ -> return text
        }

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
        let body = JsonSerializer.Serialize({| ``to`` = toHex; encryptedBlob = blobHex; timestamp = timestamp |})
        async {
            let! result = postJson<SendResult> client $"{serverUrl}/messages" body (Some token)
            return result.Status
        }

    let poll (serverUrl: string) (token: string) (cursor: int64) =
        let body = JsonSerializer.Serialize({| cursor = cursor; timeout = 30000 |})
        postJson<PollResponse> pollClient $"{serverUrl}/poll" body (Some token)

    let ackMessages (serverUrl: string) (token: string) (messageIds: string list) =
        let body = JsonSerializer.Serialize({| messageIds = messageIds |})
        sendRequest client $"{serverUrl}/messages/ack" body (Some token) |> Async.Ignore
