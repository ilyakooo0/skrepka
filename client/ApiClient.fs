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
    exception Unauthorized

    [<CLIMutable>]
    type PollEvent = { EncryptedBlob: string }

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
        c.Timeout <- TimeSpan.FromSeconds(30.)
        c

    let private sendRequest (httpClient: HttpClient) (url: string) (body: string) (token: string option) =
        async {
            use request = new HttpRequestMessage(HttpMethod.Post, url)
            request.Content <- new StringContent(body, Encoding.UTF8, "application/json")
            token |> Option.iter (fun t -> request.Headers.Add("Authorization", $"Bearer {t}"))
            use! response = httpClient.SendAsync(request) |> awaitTask
            let! text = response.Content.ReadAsStringAsync() |> awaitTask
            if response.IsSuccessStatusCode then
                return JsonDocument.Parse(text)
            else
                if response.StatusCode = System.Net.HttpStatusCode.Unauthorized then
                    return raise Unauthorized
                let code =
                    try
                        use d = JsonDocument.Parse(text)
                        match d.RootElement.TryGetProperty("error") with
                        | true, e -> e.GetString()
                        | _ -> string (int response.StatusCode)
                    with _ -> string (int response.StatusCode)
                return raise (ApiError $"{url}: {code}")
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
            // Bind the signature to the host we actually dialed, so a relay server
            // cannot replay it to a different server (see PROTOCOL.md §6, §10).
            let serverHost = Uri(serverUrl).Host.ToLowerInvariant().TrimEnd('.')
            let sigHex = Crypto.signChallenge identity.PrivKey serverHost challenge
            let body = JsonSerializer.Serialize({| pubkey = identity.PubKeyHex; challenge = challenge; signature = sigHex |})
            use! tokenDoc = sendRequest client $"{serverUrl}/auth/verify" body None
            let token = tokenDoc.RootElement.GetProperty("token").GetString()
            if String.IsNullOrEmpty(token) then raise (ApiError "Authentication rejected by server")
            return token
        }

    let sendMessage (serverUrl: string) (token: string) (toHex: string) (blobHex: string) =
        let body =
            JsonSerializer.Serialize(
                {| messages = [| {| ``to`` = toHex; encryptedBlob = blobHex |} |] |})
        async {
            try
                use! _doc = sendRequest client $"{serverUrl}/messages" body (Some token)
                ()
            with ApiError msg when msg.EndsWith(": self_send") ->
                return raise (ServerRejected "Message rejected by server")
        }

    let poll (serverUrl: string) (token: string) (cursor: int64) =
        let body = JsonSerializer.Serialize({| cursor = cursor |})
        postJson<PollResponse> pollClient $"{serverUrl}/poll" body (Some token)

