# Skrepka

Decentralized, end-to-end encrypted messaging with no accounts and no home servers. See [PROTOCOL.md](PROTOCOL.md) for the full specification.

## Install the relay server

```sh
curl -fsSL https://raw.githubusercontent.com/ilyakooo0/skrepka/master/install.sh | sudo sh
```

This downloads the latest binary for your platform, installs it to `/usr/local/bin/skrepka-server`, and on Linux sets up a systemd service. Re-running the same command will update the binary and restart the service.
