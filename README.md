# Skrepka

Decentralized, end-to-end encrypted messaging with no accounts and no home servers. Identity is an Ed25519 keypair; messages route over plain HTTP through any relay in an open federated mesh. A relay only ever sees the recipient's public key and an opaque blob — the sender's identity and signature live *inside* the AEAD ciphertext, so a server never learns who sent a message.

See [PROTOCOL.md](PROTOCOL.md) for the full specification.

## What's here

| Path | What it is |
| --- | --- |
| `core/` | The shared core (Rust, [Crux](https://redbadger.github.io/crux/)). All business logic: identity, crypto, auth, the long-poll loop, the outbox, contacts, profiles, message ingest. |
| `apple/` | The iOS client (Swift + SwiftUI, iOS 17+). A thin shell: it executes HTTP/key-value/timer effects and renders the view model. No business logic. |
| `server.knot` | The relay server, written in [Knot](https://github.com/ilyakooo0/knot) and compiled to a native binary. |
| `servers.json` | A public relay list. A static suggestion, not a directory. |

Crypto is X25519 + XChaCha20-Poly1305 with HKDF-SHA256, signed with Ed25519 — see `core/src/crypto.rs`, which is written to be auditable against the spec.

## Build the client

One-time setup:

```sh
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
cargo install boltffi_cli
brew install xcodegen
```

Then (`just` alone runs `test`):

```sh
just test                # run the core test suite
just generate            # regenerate Swift types, xcframework, and the Xcode project
just build SIM_ID=<udid> # build for a booted simulator
just run SIM_ID=<udid>   # install + launch on that simulator
```

Run `just generate` after any change to the core's `Event`, `ViewModel`, or `Effect` types — otherwise the Swift side compiles against stale generated types.

## Run a relay

To install one on a Linux host, with a systemd service and [Caddy](https://caddyserver.com) as a reverse proxy with automatic TLS:

```sh
curl -fsSL https://raw.githubusercontent.com/ilyakooo0/skrepka/master/install.sh | sudo DOMAIN=skrepka.example.com sh
```

Re-running the same command updates the binary and restarts the service.

Every top-level constant in `server.knot` is overridable at startup as `--name=value` (`--serverHost=`, `--federationEnabled=False`, `--trustForwardedFor=False`, …); run the binary with `--help` for the full list. `--serverHost` must be the public hostname clients use to reach the relay: it is the federation identity, and clients bind their auth signature to it.

To run a relay locally you need a prebuilt `./server` binary (`knot build server.knot`, or grab a release asset); then `just server` resets the disposable database and starts it.
