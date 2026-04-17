namespace Skrepka

open System
open Avalonia.Media
open Fabulous.Avalonia

open type Fabulous.Avalonia.View

module AppTypes =

    open Store
    open Crypto

    // ── Domain Types ──

    type Page =
        | Setup
        | Conversations
        | Chat of pubkey: string * compose: string
        | AddContact of pubkey: string * nickname: string
        | Settings
        | EditProfile of displayName: string * bio: string * photo: byte[] option

    type Session =
        { Url: string
          Token: string
          Identity: Identity }

    type ConnStatus =
        | Offline
        | Connecting
        | Online of token: string

    type AuthState =
        | NoIdentity
        | Identified of identity: Identity * conn: ConnStatus

    [<RequireQualifiedAccess>]
    type Envelope =
        | TextMessage of id: string * body: string
        | DeliveryAck of ackIds: string list
        | ProfileMessage of profile: Profile

    type IncomingEvent =
        { Sender: string
          Timestamp: DateTimeOffset
          Envelope: Envelope }

    // ── Model ──

    type Model =
        { Page: Page
          Auth: AuthState
          ServerUrl: string
          Contacts: Map<string, Contact>
          PollStatus: string
          Messages: Map<string, ChatMessage list>
          Error: string option
          PollCursor: int64
          Profile: Profile option
          FlushingOutbox: bool }

    // ── Msg ──

    type Msg =
        | SetPage of Page
        | GenIdentity
        | SetServerUrl of string
        | DoConnect
        | AuthOk of string
        | AuthErr of string
        | DoDisconnect
        | DoSend
        | DoSaveContact
        | PollResult of events: IncomingEvent list * status: string * cursor: int64
        | CopyPubKey
        | DismissError
        | StateLoaded of Identity option * Data option * Profile option
        | DoPickPhoto
        | PhotoPicked of byte[] option
        | DoSaveProfile
        | StartFlush
        | FlushResult of sent: bool
        | Search of string

    // ── CmdMsg ──

    type CmdMsg =
        | CmdConnect of url: string * identity: Identity
        | CmdEnqueue of recipientHex: string * envelope: Envelope
        | CmdFlushOutbox of session: Session
        | CmdPoll of session: Session * cursor: int64
        | CmdCopyToClipboard of string
        | CmdLoadState
        | CmdSaveIdentity of Identity
        | CmdSaveData of Data
        | CmdPickPhoto
        | CmdSaveProfile of Profile

    // ── Shared Helpers ──

    let hexToOb (hex: string) = Crypto.fromHex hex |> Phonemic.toOb

    let truncKey (hex: string) =
        let ob = hexToOb hex
        let parts = ob.Split('-')

        if parts.Length <= 4 then
            ob
        else
            $"{parts.[0]}-{parts.[1]}..{parts.[parts.Length - 2]}-{parts.[parts.Length - 1]}"

    let contactName (contacts: Map<string, Contact>) (pk: string) =
        match Map.tryFind pk contacts with
        | Some c when c.Nickname <> "" -> c.Nickname
        | Some c when c.DisplayName <> "" -> c.DisplayName
        | _ -> truncKey pk

    let messagesFor (pk: string) (messages: Map<string, ChatMessage list>) =
        messages |> Map.tryFind pk |> Option.defaultValue []

    let connStatusLabel =
        function
        | NoIdentity
        | Identified(_, Offline) -> "OFFLINE"
        | Identified(_, Connecting) -> "CONNECTING"
        | Identified(_, Online _) -> "ONLINE"

    // ── Shared View ──

    let viewErrorBanner (error: string option) =
        VStack(4.) {
            match error with
            | Some err ->
                TextBlock(err).foreground(SolidColorBrush(Colors.Red)).fontSize (12.)
                Button("Dismiss", DismissError)
            | None -> ()
        }
