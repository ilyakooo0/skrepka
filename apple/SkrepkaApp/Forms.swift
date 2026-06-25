import Skrepka
import SwiftUI
import UIKit

func decodeImage(_ base64: String) -> UIImage? {
    guard !base64.isEmpty, let data = Data(base64Encoded: base64) else { return nil }
    return UIImage(data: data)
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
                    input = code
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
                        UIPasteboard.general.string = core.view.myPubkeyHex
                        copied = true
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
                PhotoPicker { base64 in
                    photo = base64
                    picking = false
                }
            }
            .onAppear {
                name = core.view.profile.displayName
                bio = core.view.profile.bio
                photo = core.view.profile.photo.isEmpty ? nil : core.view.profile.photo
            }
        }
    }
}
