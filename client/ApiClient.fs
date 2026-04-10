namespace Skrepka

open System
open System.Net.Http
open System.Text
open System.Text.Json
open System.Threading.Tasks

module ApiClient =

    type EventPayload = { EncryptedBlob: string; Timestamp: int64 }
    type PollEvent = { Id: string; Payload: EventPayload }

    [<CLIMutable>]
    type SendResult = { Status: string; MessageId: string }

    type PollResponse = { Events: PollEvent list; Cursor: uint64 }

    [<CLIMutable>]
    type ChallengeResponse = { challenge: string }

    [<CLIMutable>]
    type VerifyResponse = { token: string }

    [<CLIMutable>]
    type PollPayloadDto = { encryptedBlob: string; timestamp: JsonElement }

    [<CLIMutable>]
    type PollEventDto = { id: string; eventType: string; payload: PollPayloadDto }

    [<CLIMutable>]
    type PollResponseDto = { cursor: uint64; events: PollEventDto array }

    /// Awaits a Task without converting TaskCanceledException to F# async
    /// cancellation (which bypasses try...with). Re-raises it as a regular exception.
    let private awaitTask (t: Task<'T>) : Async<'T> =
        Async.FromContinuations(fun (ok, err, _cancel) ->
            t.ContinueWith(fun (t: Task<'T>) ->
                if t.IsFaulted then err t.Exception.InnerException
                elif t.IsCanceled then err (TimeoutException("Request timed out"))
                else ok t.Result)
            |> ignore)

    let private jsonOpts = JsonSerializerOptions(PropertyNameCaseInsensitive = true)

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
            let request = new HttpRequestMessage(HttpMethod.Post, url)
            request.Content <- new StringContent(body, Encoding.UTF8, "application/json")

            token
            |> Option.iter (fun t -> request.Headers.Add("Authorization", $"Bearer {t}"))

            let! response = httpClient.SendAsync(request) |> awaitTask
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

    let requestChallenge (serverUrl: string) (pubkeyHex: string) =
        async {
            let body = JsonSerializer.Serialize({| pubkey = pubkeyHex |})
            let! response = postJson<ChallengeResponse> client $"{serverUrl}/auth/challenge" body None
            return response.challenge
        }

    let verify (serverUrl: string) (pubkeyHex: string) (challenge: string) (signatureHex: string) =
        async {
            let body = JsonSerializer.Serialize({| pubkey = pubkeyHex; challenge = challenge; signature = signatureHex |})
            let! response = postJson<VerifyResponse> client $"{serverUrl}/auth/verify" body None
            if String.IsNullOrEmpty(response.token) then failwith "Authentication rejected by server"
            return response.token
        }

    let sendMessage (serverUrl: string) (token: string) (toHex: string) (blobHex: string) (timestamp: int64) =
        async {
            let body = JsonSerializer.Serialize({| ``to`` = toHex; encryptedBlob = blobHex; timestamp = timestamp |})
            return! postJson<SendResult> client $"{serverUrl}/messages" body (Some token)
        }

    let poll (serverUrl: string) (token: string) (cursor: uint64) =
        async {
            let body = JsonSerializer.Serialize({| cursor = cursor; timeout = 30000 |})
            let! response = postJson<PollResponseDto> pollClient $"{serverUrl}/poll" body (Some token)

            let events =
                [ for e in response.events do
                      if e.eventType = "message" then
                          let ts =
                              if e.payload.timestamp.ValueKind = JsonValueKind.String
                              then Int64.Parse(e.payload.timestamp.GetString())
                              else e.payload.timestamp.GetInt64()
                          { Id = e.id
                            Payload = { EncryptedBlob = e.payload.encryptedBlob; Timestamp = ts } } ]

            return { Events = events; Cursor = response.cursor }
        }

    let ackMessages (serverUrl: string) (token: string) (messageIds: string list) =
        async {
            let body = JsonSerializer.Serialize({| messageIds = messageIds |})
            do! sendRequest client $"{serverUrl}/messages/ack" body (Some token) |> Async.Ignore
        }
