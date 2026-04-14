#!/bin/bash
set -e
cd "$(dirname "$0")"
dotnet build -f net10.0
open bin/Debug/net10.0/Skrepka.app
