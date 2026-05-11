# CLAUDE.md

Decentralized E2E encrypted messenger. No accounts, no home servers — identity is a keypair.

## Tech Stack

- **Client:** F# / .NET 10 / Fabulous (Elm-style MVU) + Avalonia UI
- **Server:** Knot (custom functional language, compiled via Rust toolchain)
- **Crypto:** libsodium (Ed25519 + X25519 + XChaCha20-Poly1305), LZ4 plaintext compression
- **Persistence:** SQLite — client via Donald + Microsoft.Data.Sqlite; server via the Knot runtime, which transparently persists every `*ref` to SQLite

## Project Layout

- `client/` — F# cross-platform app (macOS desktop, iOS)
  - `App.fs` — Top-level state machine (Model / Msg / CmdMsg / update)
  - `AppTypes.fs` — Shared model/msg/envelope types and helpers
  - `Constants.fs` — App-wide constants (HKDF info, poll timing, profile/settings IDs)
  - `Crypto.fs` — Encryption/decryption, key derivation, signing
  - `ApiClient.fs` — HTTP transport (auth, poll, send)
  - `Protocol.fs` — Envelope serialize/parse + send orchestration
  - `Store.fs` — SQLite persistence (contacts, messages, settings, profile, outbox)
  - `Phonemic.fs` — Urbit @p syllable encoding for human-readable keys
  - `Buttons.fs`, `Labels.fs`, `TextFields.fs`, `Styles.fs`, `Keyboard.fs` — UI primitives
  - `ViewSetup.fs`, `ViewConversations.fs`, `ViewChat.fs`, `ViewAddContact.fs`, `ViewSettings.fs`, `ViewEditProfile.fs` — Per-page views
  - `Platform/Desktop/` — macOS entry point + `.app` bundle wiring
  - `Platform/iOS/` — iOS entry point, native photo picker, native QR scanner
- `server.knot` — Complete server implementation (routes, federation, gossip, presence, retries)
- `servers.json` — Public relay list (flat JSON array of URLs)
- `install.sh` — Linux deployment (downloads release binary, sets up systemd + Caddy)
- `PROTOCOL.md` — Wire protocol specification

## Build & Run

```bash
# macOS desktop
cd client && ./run-mac.sh

# iOS simulator
cd client && ./run-ios.sh

# Plain build
cd client && dotnet build
```

## Version Control

Use **jj** (jujutsu), not git.

## Code Conventions

- Formatter: Fantomas (`dotnet tool restore && dotnet fantomas client/`)
- F# naming: PascalCase types, camelCase functions/fields
- Architecture: Elm-style MVU — all state in `Model`, all effects via `CmdMsg`
- No mutable state outside UI framework
