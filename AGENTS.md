# CLAUDE.md

Decentralized, end-to-end encrypted messenger. No accounts, no home servers — identity is an Ed25519 keypair. Messages route over plain HTTP through any relay in an open federated mesh.

`PROTOCOL.md` is the normative spec (v0.1 draft) and should be read before touching crypto, the wire format, or the server. The relay sees only the recipient pubkey and an opaque blob; the sender's identity and signature live *inside* the AEAD ciphertext, so a server never learns who sent a message.

## Tech Stack

- **Shared core:** Rust (edition 2021, `rust-version` 1.90) built on [Crux](https://redbadger.github.io/crux/) — `crux_core` (MVU), `crux_http`, `crux_kv`, `crux_time`. All business logic lives here: identity, auth, the long-poll loop, the outbox, contacts, profiles, message ingest.
- **FFI:** `boltffi` exports `CoreFFI` (`core/src/ffi.rs`) as a bincode bridge; `facet` drives Swift type generation from the core's `Event` / `ViewModel` / `Effect` types.
- **Apple shell:** Swift + SwiftUI, **iOS 17+ only** (`include_macos = false` in `core/boltffi.toml`). The shell is a thin effect executor — it performs HTTP, key-value, and timer effects and renders the `ViewModel`. It contains no business logic.
- **Crypto:** `ed25519-dalek` + `x25519-dalek` + `curve25519-dalek`, `chacha20poly1305` (XChaCha20-Poly1305), `hkdf` + `sha2` (HKDF-SHA256), `zstd` (plaintext compression). **No libsodium** — `core/src/crypto.rs` hand-reimplements libsodium's `crypto_sign_ed25519_{pk,sk}_to_curve25519` so blobs stay wire-compatible with any spec-following client.
- **Server:** `server.knot`, written in [Knot](https://github.com/ilyakooo0/knot) — a custom functional language compiled to a native binary. Its runtime transparently persists every `*ref` to SQLite, so all server state (`*sessions`, `*messages`, `*presence`, …) survives restarts despite reading like in-memory lists.
- **Persistence (client):** `crux_kv` — JSON blobs under the keys `settings`, `profile`, `contacts`, `cursor`, `outbox`, and `messages:<peer_hex>`. The Swift shell backs this with one file per key under Application Support. The 64-byte Ed25519 secret key lives in the iOS Keychain, never in kv.

## Project Layout

```
core/                       Rust shared core (crate `skrepka_core`)
  src/app.rs                Crux App: Event / Model / ViewModel / Effect + update(). The whole state machine.
  src/model.rs              Persisted state types (Settings, OwnProfile, Contact, StoredMessage, OutboxItem)
                            and the flat ViewModel the shell renders.
  src/crypto.rs             Identity, encrypt/decrypt, ed25519→x25519 derivation, auth-challenge signing.
  src/protocol.rs           Plaintext payload (de)serialization (text / delivery.ack / profile) + Envelope.
  src/phonemic.rs           Urbit-style @p syllable encoding of pubkeys; try_parse_pubkey accepts @p or hex.
  src/ffi.rs                boltffi surface: update / resolve / view over bincode bytes.
  src/bin/codegen.rs        Emits Swift bindings via facet typegen (feature `codegen`).
  boltffi.toml              Apple packaging config (iOS 17 target, module `SkrepkaShared`).

apple/
  project.yml               xcodegen spec → SkrepkaApp.xcodeproj (bundle lol.skrepka.SkrepkaApp-iOS).
  SkrepkaApp/SkrepkaApp.swift   @main entry point.
  SkrepkaApp/Core.swift     Drives the core: serializes events in, dispatches effects out, resolves them back.
  SkrepkaApp/Effects.swift  Effect handlers — Http (URLSession, 70s timeout), Time, KvStore (file per key),
                            Keychain (loads or generates the 64-byte identity key).
  SkrepkaApp/Views.swift    RootView, ConversationsView, ChatView, MessageBubble, Avatar.
  SkrepkaApp/Forms.swift    AddContactView, SettingsView, EditProfileView.
  SkrepkaApp/QRView.swift   QR generation + AVFoundation camera scanner.
  SkrepkaApp/PhotoPicker.swift  PHPicker → downscaled 256px JPEG as base64.
  generated/                gitignored — Shared/ (xcframework + SPM package) and App/Skrepka (Swift types).

server.knot                 The entire relay: config, types, routes, auth, poll, send, federation, background loops.
servers.json                Public relay list (flat JSON array of URLs). A static suggestion, not a directory.
install.sh                  Linux deploy: downloads the release binary, writes a systemd unit, configures Caddy + TLS.
skrepka.service             Reference systemd unit (install.sh writes its own, with --http-max-body-bytes=42M).
Justfile                    All build/run recipes.
.cargo/config.toml          Pins IPHONEOS/MACOSX deployment targets (see Gotchas).
.github/workflows/build.yml CI: compiles server.knot on linux-x86_64 / linux-arm64 / macos-arm64, cuts a release.
PROTOCOL.md                 Wire protocol specification.
PROTOCOL-REVIEW.md          Audit of spec-vs-implementation gaps (written against the old F# client — see Gotchas).
```

## Build & Run

One-time setup:

```sh
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
cargo install boltffi_cli
brew install xcodegen
```

Recipes (`just <name>`; `just` alone runs `test`):

```sh
just test                # cargo test -p skrepka_core  (crypto, protocol, @p, state machine)
just typegen             # regenerate Swift types into apple/generated/App
just pack                # build the core xcframework + Swift package into apple/generated/Shared
just project             # xcodegen generate → apple/SkrepkaApp.xcodeproj
just generate            # typegen + pack + project — run this after any core type change
just build SIM_ID=<udid> # xcodebuild for a booted simulator
just run SIM_ID=<udid>   # install + launch on that simulator
just server              # wipe server.db* and run the local ./server binary
```

`just server` expects a **prebuilt `./server`** binary; there is no local recipe that compiles it. To build it you need the Knot compiler (`knot build server.knot`), which CI downloads from `ilyakooo0/knot` releases — on Linux it links statically against musl. `server` and `*.db*` are gitignored.

Deploying a relay:

```sh
curl -fsSL https://raw.githubusercontent.com/ilyakooo0/skrepka/master/install.sh | sudo DOMAIN=relay.example.com sh
```

Every top-level scalar constant in `server.knot` is overridable at startup as `--name=value` (e.g. `--serverHost=relay.example.com`, `--federationEnabled=False`, `--trustForwardedFor=False`); `--help` lists them all.

## Architecture

The core is a pure MVU state machine. `Skrepka::update(Event, &mut Model) -> Command<Effect, Event>` is the only place state changes; `Skrepka::view(&Model) -> ViewModel` is the only thing the shell reads. The shell never decides anything — it turns `Effect`s into platform calls and resolves the results back in.

Two kinds of `Event` variants, and the distinction matters:

- **Shell-facing** (`IdentityLoaded`, `SendText`, `OpenChat`, `AddContact`, …) — cross the FFI, so they appear in the generated Swift `Event` enum.
- **Internal** (`LoadedContacts`, `PollResult`, `SendResult`, …) — carry non-FFI-safe payloads (`crux_http::Result`, `KeyValueError`) and are marked `#[serde(skip)] #[facet(skip)] #[facet(opaque)]` so they never reach Swift. Adding a new internal event means adding those attributes too, or typegen breaks.

The `ViewModel` is deliberately flat and stringly-typed (`page: String`, `conn_status: String`) so the Swift side switches on plain strings rather than needing generated enums for UI state.

Runtime flow: `IdentityLoaded` (from the Keychain, at boot) fans out five kv loads → `LoadedSettings` triggers `Connect` → `Authenticate` (challenge/verify, signature bound to the server's bare hostname under the `skrepka-auth-v1:` tag) → on a token, `Poll` (server long-polls ~25 s, client re-polls immediately) and `StartFlush` (drains the outbox one message at a time, encrypting at send time). Failures back off via `crux_time` — 3 s doubling to a 30 s cap.

## Code Conventions

- **Rust:** standard `rustfmt`; the code is written clippy-clean (note the targeted `#[allow]`s in `app.rs` / `ffi.rs`). Doc comments (`//!`, `///`) carry the design rationale and cite `PROTOCOL.md` sections — keep that habit; it's how the crypto stays auditable against the spec.
- **Swift:** SwiftUI, no business logic. `Core.swift` uses `try!` on bincode round-trips deliberately (a serialization mismatch is a build-time bug, not a runtime condition) with `swiftlint:disable` comments marking each.
- **Knot:** `server.knot` is written for clarity over performance — every collection is a flat list, every scan is O(n). The header comment says so explicitly. Its dense comments encode security reasoning (SSRF deny-list, rate-limit key choice, replay/dedup invariants); read them before changing behavior.
- Anything on the wire is **lowercase hex**; anything shown to a human can be **@p** (`ridler-binzod-…`). `try_parse_pubkey` accepts both.

## Version Control

Convention is **jj** (jujutsu), not git — but note the working copy is currently a **plain git checkout with no `.jj/`**. Run `jj git init --colocate` before using jj commands here.

When reading diffs, pass `--git` to `jj diff` / `jj show` — the configured formatter is difftastic, whose ANSI output is meant for terminals, not models.

## Gotchas

- **Regenerate after core type changes.** Touching `Event`, `ViewModel`, or `Effect` without running `just generate` leaves the Swift side compiling against stale types.
- **`.cargo/config.toml` is load-bearing.** It pins `IPHONEOS_DEPLOYMENT_TARGET=17.0` / `MACOSX_DEPLOYMENT_TARGET=11.0` so `zstd-sys` (a C dep) and rustc agree on the minimum OS version. Without it the linker fails on a version mismatch.
- **Body-size cap on the relay.** `--http-max-body-bytes` must exceed `maxBlobLen` (40 MiB hex) plus the JSON envelope, or the runtime's default 16 MiB cap rejects a max-size blob with a bare `413` before the handler's `400 invalid_message` check runs. `install.sh` sets `42M`.
- **Refined types don't validate inside lists.** Knot's route-boundary checks only fire on top-level scalar body fields, so `handleSendMessages` and `handleRecvGossip` re-validate nested `to` / `pubkey` / `encryptedBlob` by hand. Preserve those checks.
- **Stale artifacts from the deleted F# client.** `README.md` (describes an F#/Avalonia app and links a nonexistent logo), `dotnet-tools.json` (Fantomas), parts of `.gitignore` (`client/bin`, `client/obj`, `.fake`), and `PROTOCOL-REVIEW.md` (cites `client/ApiClient.fs`) all predate the Rust rewrite. Don't treat them as descriptions of the current code.
- **PROTOCOL.md is behind the core in one place.** §4 and §10 claim "the reference client does not yet enforce" stale-`profile` rejection. The Rust core *does* enforce it — `ingest_poll` in `app.rs` drops any `profile` whose `ts` predates `Contact::last_profile_ts`.
- **Federation is unauthenticated by design.** `/federation/*` endpoints accept any caller; abuse is bounded by the SSRF deny-list, the `no_presence` gate, and per-IP rate limits — not by peer authentication. `PROTOCOL.md` §10 enumerates what that does and doesn't protect.
