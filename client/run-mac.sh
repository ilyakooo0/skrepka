#!/bin/bash
set -e
cd "$(dirname "$0")"
dotnet build Skrepka.fsproj -f net10.0-maccatalyst
open bin/Debug/net10.0-maccatalyst/maccatalyst-arm64/Skrepka.app
