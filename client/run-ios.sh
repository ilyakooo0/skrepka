#!/bin/bash
set -e
cd "$(dirname "$0")"

DEVICE="${1:-iPhone 17 Pro}"
BUNDLE_ID="com.skrepka.client"
APP="bin/Debug/net10.0-ios/iossimulator-arm64/Skrepka.app"

dotnet build Skrepka.fsproj -f net10.0-ios

UDID=$(xcrun simctl list devices available -j | python3 -c "
import json, sys
devices = json.load(sys.stdin)['devices']
name = '$DEVICE'
for runtime, devs in devices.items():
    for d in devs:
        if d['name'] == name and d['isAvailable']:
            print(d['udid']); sys.exit()
print('', end=''); sys.exit(1)
")

if [ -z "$UDID" ]; then
    echo "Simulator '$DEVICE' not found. Available:"
    xcrun simctl list devices available | grep -i iphone
    exit 1
fi

xcrun simctl boot "$UDID" 2>/dev/null || true
open -a Simulator
xcrun simctl install "$UDID" "$APP"
xcrun simctl launch "$UDID" "$BUNDLE_ID"
