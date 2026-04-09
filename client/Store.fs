namespace Skrepka

open System
open System.Collections.Generic
open System.IO
open System.Text.Json
open Microsoft.Maui.Storage

module Store =

    [<CLIMutable>]
    type ContactDto =
        { Pubkey: string
          Nickname: string }

    [<CLIMutable>]
    type MessageDto =
        { Id: string
          Body: string
          TimestampUnix: int64
          IsOutgoing: bool }

    [<CLIMutable>]
    type DataDto =
        { Contacts: ContactDto array
          Messages: Dictionary<string, MessageDto array>
          ServerUrl: string
          PollCursor: uint64 }

    let private jsonOpts =
        JsonSerializerOptions(WriteIndented = true, PropertyNameCaseInsensitive = true)

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
                return Some(Convert.FromBase64String privKeyB64, pubKeyHex)
        }

    let saveIdentity (privKey: byte[]) (pubKeyHex: string) =
        task {
            do! SecureStorage.Default.SetAsync("identity_privkey", Convert.ToBase64String privKey)
            do! SecureStorage.Default.SetAsync("identity_pubkey", pubKeyHex)
        }

    let loadData () =
        let path = dataPath ()

        if File.Exists path then
            try
                let json = File.ReadAllText path
                let dto = JsonSerializer.Deserialize<DataDto>(json, jsonOpts)

                Some
                    { Contacts =
                        if Object.ReferenceEquals(dto.Contacts, null) then
                            [||]
                        else
                            dto.Contacts
                      Messages =
                        if Object.ReferenceEquals(dto.Messages, null) then
                            Dictionary()
                        else
                            dto.Messages
                      ServerUrl =
                        if Object.ReferenceEquals(dto.ServerUrl, null) then
                            ""
                        else
                            dto.ServerUrl
                      PollCursor = dto.PollCursor }
            with _ ->
                None
        else
            None

    let saveData (dto: DataDto) =
        try
            let json = JsonSerializer.Serialize(dto, jsonOpts)
            File.WriteAllText(dataPath (), json)
        with _ ->
            ()
