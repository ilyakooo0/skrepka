namespace Skrepka

open System
open System.Net.Http
open System.Text
open System.Text.Json

module ApiClient =

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

            let! response = client.SendAsync(request) |> Async.AwaitTask
            let! text = response.Content.ReadAsStringAsync() |> Async.AwaitTask
            return JsonDocument.Parse(text)
        }

    let private getJson (url: string) (token: string) =
        async {
            let request = new HttpRequestMessage(HttpMethod.Get, url)
            request.Headers.Add("Authorization", $"Bearer {token}")
            let! response = client.SendAsync(request) |> Async.AwaitTask
            let! text = response.Content.ReadAsStringAsync() |> Async.AwaitTask
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
            let body = $"""{{ "pubkey": "{pubkeyHex}" }}"""
            let! doc = postJson $"{serverUrl}/auth/challenge" body None
            let root = expectObject doc "/auth/challenge"
            return root.GetProperty("challenge").GetString()
        }

    let verify (serverUrl: string) (pubkeyHex: string) (challenge: string) (signatureHex: string) =
        async {
            let body =
                $"""{{ "pubkey": "{pubkeyHex}", "challenge": "{challenge}", "signature": "{signatureHex}" }}"""

            let! doc = postJson $"{serverUrl}/auth/verify" body None
            let root = expectObject doc "/auth/verify"
            let token = root.GetProperty("token").GetString()
            let expiresAt = root.GetProperty("expiresAt").GetInt64()
            return (token, expiresAt)
        }

    let sendMessage (serverUrl: string) (token: string) (toHex: string) (blobHex: string) (timestamp: int64) =
        async {
            let body =
                $"""{{ "to": "{toHex}", "encryptedBlob": "{blobHex}", "timestamp": {timestamp} }}"""

            let! doc = postJson $"{serverUrl}/messages" body (Some token)
            let root = expectObject doc "/messages"
            let status = root.GetProperty("status").GetString()
            let msgId = root.GetProperty("messageId").GetString()
            return (status, msgId)
        }

    let private pollClient =
        let c = new HttpClient()
        c.Timeout <- System.Threading.Timeout.InfiniteTimeSpan
        c

    let poll (serverUrl: string) (token: string) (cursor: int64) =
        async {
            let request = new HttpRequestMessage(HttpMethod.Get, $"{serverUrl}/poll?cursor={cursor}&timeout=30")
            request.Headers.Add("Authorization", $"Bearer {token}")

            let! response = pollClient.SendAsync(request) |> Async.AwaitTask
            let! text = response.Content.ReadAsStringAsync() |> Async.AwaitTask
            let doc = JsonDocument.Parse(text)
            let root = expectObject doc "/poll"
            let cursor = root.GetProperty("cursor").GetInt64()

            // Knot runtime wraps relations as [[record1, record2, ...]]
            let eventsOuter = root.GetProperty("events")

            let eventsInner =
                if eventsOuter.GetArrayLength() > 0
                   && eventsOuter.[0].ValueKind = JsonValueKind.Array then
                    eventsOuter.[0]
                else
                    eventsOuter

            let events =
                [ for e in eventsInner.EnumerateArray() do
                      if e.ValueKind = JsonValueKind.Object then
                          let id = e.GetProperty("id").GetString()
                          let evtType = e.GetProperty("eventType").GetString()
                          let payloadEl = e.GetProperty("payload")
                          let payload =
                              if payloadEl.ValueKind = JsonValueKind.String then
                                  payloadEl.GetString()
                              else
                                  payloadEl.GetRawText()
                          yield (id, evtType, payload) ]

            return (events, cursor)
        }

    let ackMessages (serverUrl: string) (token: string) (messageIds: string list) =
        async {
            let idsJson =
                messageIds |> List.map (fun id -> $"\"{id}\"") |> String.concat ", "

            let body = $"""{{ "messageIds": [{idsJson}] }}"""
            let! _ = postJson $"{serverUrl}/messages/ack" body (Some token)
            return ()
        }
