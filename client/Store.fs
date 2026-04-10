namespace Skrepka

open System
open System.Collections.Generic
open System.IO
open System.Text.Json
open System.Text.Json.Serialization
open Microsoft.Maui.Storage

module Store =

    [<CLIMutable>]
    type Contact =
        { Pubkey: string
          Nickname: string }

    type private UnixDateTimeOffsetConverter() =
        inherit JsonConverter<DateTimeOffset>()
        override _.Read(reader, _, _) =
            DateTimeOffset.FromUnixTimeSeconds(reader.GetInt64())
        override _.Write(writer, value, _) =
            writer.WriteNumberValue(value.ToUnixTimeSeconds())

    [<CLIMutable>]
    type ChatMessage =
        { Id: string
          Body: string
          [<JsonPropertyName("TimestampUnix")>] Timestamp: DateTimeOffset
          IsOutgoing: bool }

    type Data =
        { Contacts: Contact list
          Messages: Map<string, ChatMessage list>
          ServerUrl: string
          PollCursor: uint64 }

    [<CLIMutable>]
    type private DataDto =
        { Contacts: Contact array
          Messages: Dictionary<string, ChatMessage array>
          ServerUrl: string
          PollCursor: uint64 }

    let private jsonOpts =
        let opts = JsonSerializerOptions(WriteIndented = true, PropertyNameCaseInsensitive = true)
        opts.Converters.Add(UnixDateTimeOffsetConverter())
        opts

    let private dataPath () =
        Path.Combine(FileSystem.AppDataDirectory, "data.json")

    let loadIdentity () =
        async {
            let! privKeyB64 =
                SecureStorage.Default.GetAsync("identity_privkey")
                |> Async.AwaitTask

            let! pubKeyHex =
                SecureStorage.Default.GetAsync("identity_pubkey")
                |> Async.AwaitTask

            if isNull privKeyB64 || isNull pubKeyHex then
                return None
            else
                return
                    Some
                        { Crypto.Identity.PrivKey = Convert.FromBase64String privKeyB64
                          Crypto.Identity.PubKeyHex = pubKeyHex }
        }

    let saveIdentity (identity: Crypto.Identity) =
        task {
            do! SecureStorage.Default.SetAsync("identity_privkey", Convert.ToBase64String identity.PrivKey)
            do! SecureStorage.Default.SetAsync("identity_pubkey", identity.PubKeyHex)
        }

    let loadData () : Data option =
        let path = dataPath ()

        if File.Exists path then
            try
                let json = File.ReadAllText path
                let dto = JsonSerializer.Deserialize<DataDto>(json, jsonOpts)

                Some
                    { Contacts =
                        if isNull dto.Contacts then [] else dto.Contacts |> Array.toList
                      Messages =
                        if isNull dto.Messages then
                            Map.empty
                        else
                            dto.Messages
                            |> Seq.map (fun (KeyValue(pk, msgs)) -> pk, msgs |> Array.toList)
                            |> Map.ofSeq
                      ServerUrl = if isNull dto.ServerUrl then "" else dto.ServerUrl
                      PollCursor = dto.PollCursor }
            with _ ->
                None
        else
            None

    let saveData (data: Data) =
        try
            let messageDtos = Dictionary<string, ChatMessage array>()
            data.Messages |> Map.iter (fun pk msgs -> messageDtos[pk] <- msgs |> Array.ofList)

            let dto: DataDto =
                { Contacts = data.Contacts |> Array.ofList
                  Messages = messageDtos
                  ServerUrl = data.ServerUrl
                  PollCursor = data.PollCursor }

            let json = JsonSerializer.Serialize(dto, jsonOpts)
            File.WriteAllText(dataPath (), json)
        with _ ->
            ()
