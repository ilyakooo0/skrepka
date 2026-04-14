#!/bin/bash
set -e
cd "$(dirname "$0")"
dotnet build -f net10.0
export DOTNET_ROOT="$(dotnet --info | grep 'Base Path' | sed 's/.*: *//' | sed 's|/sdk/.*||')"
exec bin/Debug/net10.0/Skrepka.app/Contents/MacOS/Skrepka
