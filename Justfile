# Skrepka iOS client (Rust core + Crux + SwiftUI shell)
#
# One-time setup:
#   rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
#   cargo install boltffi_cli
#   brew install xcodegen

sim_id := env_var_or_default("SIM_ID", "")
bundle := "lol.skrepka.SkrepkaApp-iOS"

default: test

# Run the Rust core test suite (crypto, protocol, @p, state machine).
test:
    cargo test -p skrepka_core

# Generate the Swift type bindings from the core.
typegen:
    cargo run -q -p skrepka_core --bin codegen --features codegen -- \
        --language swift --output-dir apple/generated/App

# Build the core for Apple and package the xcframework + Swift package.
pack:
    cd core && boltffi pack apple

# Generate the Xcode project from project.yml.
project:
    cd apple && xcodegen generate

# Full regeneration: types, xcframework, Xcode project.
generate: typegen pack project

# Build the iOS app for a booted simulator (set SIM_ID, or pass a destination).
build sim=sim_id:
    cd apple && xcodebuild -project SkrepkaApp.xcodeproj -scheme SkrepkaApp-iOS \
        -destination 'platform=iOS Simulator,id={{sim}}' \
        -derivedDataPath build -skipPackagePluginValidation build

# Install + launch on a booted simulator.
run sim=sim_id:
    cd apple && xcrun simctl install {{sim}} \
        build/Build/Products/Debug-iphonesimulator/SkrepkaApp-iOS.app
    xcrun simctl launch {{sim}} {{bundle}}

# Run a local relay server for testing (resets the disposable relay db first).
server:
    rm -f server.db server.db-wal server.db-shm
    ./server
