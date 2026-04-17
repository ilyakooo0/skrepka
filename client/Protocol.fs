namespace Skrepka

open System
open System.Text.Json

module Protocol =

    open Store
    open Crypto
    open ApiClient
    open AppTypes

    let private log msg = eprintfn $"[skrepka] {msg}"

    let serializeEnvelope =
        function
        | Envelope.TextMessage(id, body) ->
            JsonSerializer.Serialize(
                {| ``type`` = "text"
                   id = id
                   body = body |}
            )
        | Envelope.DeliveryAck ackIds ->
            JsonSerializer.Serialize(
                {| ``type`` = "delivery.ack"
                   ack_ids = ackIds |}
            )
        | Envelope.ProfileMessage profile ->
            JsonSerializer.Serialize(
                {| ``type`` = "profile"
                   display_name = profile.DisplayName
                   bio = profile.Bio
                   photo = profile.Photo |}
            )

    let private tryGetJsonString (el: JsonElement) (name: string) =
        match el.TryGetProperty(name) with
        | true, v when v.ValueKind <> JsonValueKind.Null -> Some(v.GetString())
        | _ -> None

    let private tryGetJsonBytes (el: JsonElement) (name: string) =
        match el.TryGetProperty(name) with
        | true, v when v.ValueKind <> JsonValueKind.Null -> Some(v.GetBytesFromBase64())
        | _ -> None

    let private parseEnvelope (json: string) =
        use doc = JsonDocument.Parse(json)
        let root = doc.RootElement

        match tryGetJsonString root "type" with
        | Some "text" ->
            match tryGetJsonString root "id", tryGetJsonString root "body" with
            | Some id, Some body -> Some(Envelope.TextMessage(id, body))
            | _ -> None
        | Some "delivery.ack" ->
            match root.TryGetProperty("ack_ids") with
            | true, v ->
                let ackIds = v.EnumerateArray() |> Seq.map _.GetString() |> Seq.toList
                Some(Envelope.DeliveryAck ackIds)
            | _ -> None
        | Some "profile" ->
            let displayName = tryGetJsonString root "display_name" |> Option.defaultValue ""
            let bio = tryGetJsonString root "bio" |> Option.defaultValue ""
            let photo = tryGetJsonBytes root "photo"

            Some(
                Envelope.ProfileMessage
                    { DisplayName = displayName
                      Bio = bio
                      Photo = photo }
            )
        | _ -> None

    let decryptEvent (privKey: byte[]) (payload: EventPayload) =
        try
            let blob = Crypto.fromHex payload.EncryptedBlob

            match Crypto.decrypt privKey blob with
            | Some(plaintext, senderHex) ->
                match parseEnvelope plaintext with
                | Some envelope ->
                    Ok
                        { Sender = senderHex
                          Timestamp = DateTimeOffset.FromUnixTimeMilliseconds(payload.Timestamp)
                          Envelope = envelope }
                | None -> Error "unknown envelope type"
            | None -> Error "decrypt failed"
        with ex ->
            Error $"parse: {ex.Message}"

    let sendEnvelope (session: Session) (recipientHex: string) (envelope: Envelope) =
        async {
            let payload = serializeEnvelope envelope

            match Crypto.encrypt session.Identity.PrivKey (Crypto.fromHex recipientHex) payload with
            | Some blob ->
                let ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                do! sendMessage session.Url session.Token recipientHex (Crypto.toHex blob) ts
            | None -> log $"encrypt failed for {recipientHex}"
        }
