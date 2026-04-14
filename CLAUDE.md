# CLAUDE.md

Decentralized E2E encrypted messenger. No accounts, no home servers — identity is a keypair.

## Tech Stack

- **Client:** F# / .NET 10 / Fabulous (Elm-style MVU) + Avalonia UI
- **Server:** Knot (custom functional language, compiled via Rust toolchain)
- **Crypto:** libsodium (Ed25519 + X25519 + XChaCha20-Poly1305)
- **Persistence:** SQLite via Dapper.FSharp (client), in-memory (server)

## Project Layout

- `client/` — F# cross-platform app (macOS, iOS)
  - `App.fs` — Main state machine (Model/Msg/CmdMsg/update/view)
  - `Crypto.fs` — Encryption/decryption, key derivation
  - `ApiClient.fs` — HTTP transport (auth, poll, send)
  - `Store.fs` — SQLite persistence
  - `Phonemic.fs` — Urbit @p syllable encoding for human-readable keys
  - `Buttons.fs` — Animated button component
  - `Platform/Desktop/` — macOS entry point
  - `Platform/iOS/` — iOS entry point + native photo picker
- `server.knot` — Complete server implementation (routes, federation, gossip)
- `servers.json` — Bootstrap server list
- `install.sh` — Linux deployment (systemd + Caddy)

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
