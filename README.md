# Skrepka

<p align="center">
  <img src="client/Assets/Images/logo.png" width="300px" align="center">
</p>

Decentralized, end-to-end encrypted messaging with no accounts and no home servers. See [PROTOCOL.md](PROTOCOL.md) for the full specification.

## Install the relay server

```sh
curl -fsSL https://raw.githubusercontent.com/ilyakooo0/skrepka/master/install.sh | sudo DOMAIN=skrepka.example.com sh
```

This installs the server binary, sets up a systemd service, and configures [Caddy](https://caddyserver.com) as a reverse proxy with automatic TLS. Re-running the same command will update the binary and restart the service.
