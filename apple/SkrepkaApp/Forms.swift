import ImageIO
import Skrepka
import SwiftUI
import UIKit

/// Decode an avatar, bounded to `maxPixel` on its long edge.
///
/// A contact's `photo` is whatever bytes a peer put in a `profile` payload, and nothing
/// upstream bounds the image's *decoded* size — only the blob's. `UIImage(data:)` would
/// honour whatever dimensions the header claims, so a few KB of base64 declaring
/// 30000x30000 costs ~3.6 GB of bitmap and the app is jetsammed. ImageIO decodes straight
/// to the thumbnail size, so the cost is capped no matter what the source claims to be.
///
/// 512 covers the largest avatar we draw (88pt at @3x) with headroom; our own photos come
/// out of `PhotoPicker` at 256, and a thumbnail is never upscaled past the source.
func decodeImage(_ base64: String, maxPixel: Int = 512) -> UIImage? {
    guard !base64.isEmpty, let data = Data(base64Encoded: base64) else { return nil }
    let options: [CFString: Any] = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: maxPixel,
    ]
    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
          let thumb = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
    else { return nil }
    return UIImage(cgImage: thumb)
}

struct AddContactView: View {
    @ObservedObject var core: Core
    @State private var input = ""
    @State private var nickname = ""
    @State private var scanning = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Public key") {
                    TextField("@p syllables or hex", text: $input, axis: .vertical)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    Button { scanning = true } label: {
                        Label("Scan QR code", systemImage: "qrcode.viewfinder")
                    }
                }
                Section("Nickname (optional)") {
                    TextField("e.g. Alice", text: $nickname)
                }
                if !core.view.error.isEmpty {
                    Text(core.view.error).foregroundColor(.red)
                }
            }
            .navigationTitle("Add contact")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { core.update(.showConversations) }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        core.update(.addContact(input: input, nickname: nickname))
                    }.disabled(input.isEmpty)
                }
            }
            .sheet(isPresented: $scanning) {
                QRScannerView { code in
                    input = scannedKeyPayload(code)
                    scanning = false
                }
            }
        }
    }
}

struct SettingsView: View {
    @ObservedObject var core: Core
    @State private var serverUrl = ""
    @State private var copied = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Your identity") {
                    HStack {
                        Avatar(base64: core.view.profile.photo, name: core.view.profile.displayName)
                        VStack(alignment: .leading) {
                            Text(core.view.profile.displayName.isEmpty
                                ? "No name" : core.view.profile.displayName).font(.headline)
                            Text(core.view.connStatus.capitalized)
                                .font(.caption).foregroundColor(.secondary)
                        }
                    }
                    if let qr = qrImage(core.view.myPubkeyHex) {
                        Image(uiImage: qr).interpolation(.none).resizable().scaledToFit()
                            .frame(maxWidth: 200).frame(maxWidth: .infinity)
                    }
                    Text(core.view.myPubkeyOb).font(.system(.footnote, design: .monospaced))
                        .textSelection(.enabled)
                    Button {
                        // Expire the pasteboard item: a public key is not a secret, but it
                        // is an identifier, and every app on the device can read the board.
                        UIPasteboard.general.setItems(
                            [[UIPasteboard.typeAutomatic: core.view.myPubkeyHex]],
                            options: [.expirationDate: Date().addingTimeInterval(60)]
                        )
                        copied = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { copied = false }
                    } label: {
                        Label(copied ? "Copied!" : "Copy key", systemImage: "doc.on.doc")
                    }
                    Button { core.update(.showEditProfile) } label: {
                        Label("Edit profile", systemImage: "pencil")
                    }
                }
                Section("Server") {
                    TextField("https://relay.example.com", text: $serverUrl)
                        .autocorrectionDisabled().textInputAutocapitalization(.never)
                    Button("Save & reconnect") {
                        core.update(.setServerUrl(serverUrl))
                    }.disabled(serverUrl.isEmpty || serverUrl == core.view.serverUrl)
                    // A rejected URL sets `error` in the core and leaves the page open;
                    // without this the Save button just does nothing, forever.
                    if !core.view.error.isEmpty {
                        Text(core.view.error).foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("Settings")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { core.update(.showConversations) }
                }
            }
            .onAppear { serverUrl = core.view.serverUrl }
        }
    }
}

struct EditProfileView: View {
    @ObservedObject var core: Core
    @State private var name = ""
    @State private var bio = ""
    @State private var photo: String?
    @State private var picking = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        Spacer()
                        Button { picking = true } label: {
                            Avatar(base64: photo ?? "", name: name, size: 88)
                        }
                        Spacer()
                    }
                    Button("Choose photo") { picking = true }
                        .frame(maxWidth: .infinity)
                }
                Section("Name") { TextField("Display name", text: $name) }
                Section("Bio") { TextField("About you", text: $bio, axis: .vertical) }
                // SaveProfile sets model.error on validation failures ("display name
                // too long", "bio too long", "photo too large") but leaves the page
                // open. Without displaying it the user taps Save, nothing happens, and
                // they have no idea why.
                if !core.view.error.isEmpty {
                    Section {
                        Text(core.view.error).foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("Edit profile")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { core.update(.showConversations) }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        core.update(.saveProfile(displayName: name, bio: bio, photo: photo))
                    }
                }
            }
            .sheet(isPresented: $picking) {
                PhotoPicker(
                    onPick: { base64 in
                        photo = base64
                        picking = false
                    },
                    onCancel: { picking = false }
                )
            }
            .onAppear {
                name = core.view.profile.displayName
                bio = core.view.profile.bio
                photo = core.view.profile.photo.isEmpty ? nil : core.view.profile.photo
            }
        }
    }
}
