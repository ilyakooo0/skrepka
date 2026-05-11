# Skrepka

<p align="center">
  <img src="client/Assets/Images/logo.png" width="300px" align="center">
</p>

Decentralized, end-to-end encrypted messaging with no accounts and no home servers. Identity is a keypair; messages route over plain HTTP through any relay in the mesh. See [PROTOCOL.md](PROTOCOL.md) for the full specification.

## Run the client

The client is an F# / .NET 10 / Fabulous + Avalonia app targeting **macOS desktop** and **iOS**.

```sh
cd client && ./run-mac.sh        # macOS desktop (.app bundle)
cd client && ./run-ios.sh        # iOS simulator (default: iPhone 17 Pro)
cd client && dotnet build        # Plain build
```

## Install the relay server

```sh
curl -fsSL https://raw.githubusercontent.com/ilyakooo0/skrepka/master/install.sh | sudo DOMAIN=skrepka.example.com sh
```

This installs the server binary, sets up a systemd service, and configures [Caddy](https://caddyserver.com) as a reverse proxy with automatic TLS. Re-running the same command updates the binary and restarts the service.
