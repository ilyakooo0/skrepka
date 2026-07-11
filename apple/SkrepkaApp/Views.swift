import Skrepka
import SwiftUI
import UIKit

let accent = Color(red: 98 / 255, green: 54 / 255, blue: 1.0)

/// Hoisted out of `body`: a DateFormatter costs real work to build, and these are read
/// once per message bubble on every render.
private let timeFormatter: DateFormatter = {
    let fmt = DateFormatter()
    fmt.timeStyle = .short // locale-aware: 24h or AM/PM, as the user has it set
    return fmt
}()

private let dateFormatter: DateFormatter = {
    let fmt = DateFormatter()
    fmt.dateStyle = .short
    return fmt
}()

func formatTime(_ ms: Int64) -> String {
    timeFormatter.string(from: Date(timeIntervalSince1970: Double(ms) / 1000))
}

/// Conversation-list stamp: the time for today, the date for anything older.
func formatStamp(_ ms: Int64) -> String {
    let date = Date(timeIntervalSince1970: Double(ms) / 1000)
    return Calendar.current.isDateInToday(date)
        ? timeFormatter.string(from: date)
        : dateFormatter.string(from: date)
}

struct RootView: View {
    @ObservedObject var core: Core

    var body: some View {
        Group {
            if !core.view.hasIdentity {
                identity
            } else {
                switch core.view.page {
                case "chat": ChatView(core: core)
                case "add_contact": AddContactView(core: core)
                case "settings": SettingsView(core: core)
                case "edit_profile": EditProfileView(core: core)
                default: ConversationsView(core: core)
                }
            }
        }
    }

    /// Without an identity there is no app. If loading one failed, say so — a spinner
    /// that never resolves is the worst possible way to report a Keychain error.
    @ViewBuilder private var identity: some View {
        let error = core.identityError ?? (core.view.error.isEmpty ? nil : core.view.error)
        if let error {
            VStack(spacing: 12) {
                Image(systemName: "exclamationmark.triangle")
                    .font(.largeTitle).foregroundColor(.orange)
                Text("Identity unavailable").font(.headline)
                Text(error)
                    .font(.footnote).foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                Button("Try again") { core.bootIdentity() }
                    .buttonStyle(.borderedProminent).tint(accent)
            }
            .padding(32)
        } else {
            ProgressView("Generating identity…")
        }
    }
}

struct ConnDot: View {
    let status: String
    var color: Color {
        switch status {
        case "online": return .green
        case "connecting": return .orange
        default: return .gray
        }
    }
    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(status.capitalized).font(.caption).foregroundColor(.secondary)
        }
        .fixedSize()
    }
}

/// Decoded avatars, keyed by their base64 source. A contact's photo is attacker-supplied
/// bytes off the wire; decoding it synchronously inside `body` hands any peer a way to
/// stall the main thread on every single render.
private let avatarCache: NSCache<NSString, UIImage> = {
    let cache = NSCache<NSString, UIImage>()
    cache.countLimit = 128
    return cache
}()

struct Avatar: View {
    let base64: String
    let name: String
    var size: CGFloat = 44
    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image).resizable().scaledToFill()
                    .frame(width: size, height: size).clipShape(Circle())
            } else {
                ZStack {
                    Circle().fill(accent.opacity(0.15))
                    Text(initials(name)).font(.system(size: size * 0.4, weight: .semibold))
                        .foregroundColor(accent)
                }.frame(width: size, height: size)
            }
        }
        .task(id: base64) { await load() }
    }

    private func load() async {
        guard !base64.isEmpty else {
            image = nil
            return
        }
        let key = base64 as NSString
        if let cached = avatarCache.object(forKey: key) {
            image = cached
            return
        }
        let source = base64
        let decoded = await Task.detached(priority: .userInitiated) { decodeImage(source) }.value
        guard !Task.isCancelled else { return }
        if let decoded { avatarCache.setObject(decoded, forKey: key) }
        image = decoded
    }
}

func initials(_ name: String) -> String {
    let parts = name.split(separator: " ")
    let chars = parts.prefix(2).compactMap { $0.first }
    return chars.isEmpty ? "?" : String(chars).uppercased()
}

/// Toggles `Contact::blocked` in the core. Blocked peers stay in the contact list —
/// listed apart — so the block is always reversible from the UI.
struct BlockToggle: View {
    @ObservedObject var core: Core
    let peer: String
    let blocked: Bool

    var body: some View {
        Button(role: blocked ? nil : .destructive) {
            core.update(.setBlocked(peer: peer, blocked: !blocked))
        } label: {
            Label(blocked ? "Unblock" : "Block",
                  systemImage: blocked ? "hand.raised.slash" : "hand.raised")
        }
    }
}

struct ConversationsView: View {
    @ObservedObject var core: Core

    var visible: [ContactVM] { core.view.contacts.filter { !$0.blocked } }
    var blocked: [ContactVM] { core.view.contacts.filter { $0.blocked } }

    var body: some View {
        NavigationStack {
            Group {
                if core.view.contacts.isEmpty {
                    ContentUnavailableView(
                        "No conversations",
                        systemImage: "bubble.left.and.bubble.right",
                        description: Text("Tap + to add a contact by their key or QR code.")
                    )
                } else {
                    List {
                        ForEach(visible, id: \.pubkey) { row($0) }
                        if !blocked.isEmpty {
                            Section("Blocked") {
                                ForEach(blocked, id: \.pubkey) { row($0).opacity(0.5) }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Skrepka")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { ConnDot(status: core.view.connStatus) }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { core.update(.showAddContact) } label: { Image(systemName: "plus") }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { core.update(.showSettings) } label: { Image(systemName: "gearshape") }
                }
            }
        }
    }

    private func row(_ contact: ContactVM) -> some View {
        Button { core.update(.openChat(contact.pubkey)) } label: {
            HStack(spacing: 12) {
                Avatar(base64: contact.photo, name: contact.name)
                VStack(alignment: .leading, spacing: 2) {
                    Text(contact.name).font(.headline).foregroundColor(.primary)
                    Text(contact.lastMessage.isEmpty ? contact.ob : contact.lastMessage)
                        .font(.subheadline).foregroundColor(.secondary).lineLimit(1)
                }
                Spacer()
                if contact.lastTs > 0 {
                    Text(formatStamp(contact.lastTs))
                        .font(.caption).foregroundColor(.secondary)
                }
            }
        }
        .contextMenu {
            BlockToggle(core: core, peer: contact.pubkey, blocked: contact.blocked)
        }
    }
}

struct ChatView: View {
    @ObservedObject var core: Core
    @State private var draft = ""

    var body: some View {
        VStack(spacing: 0) {
            messages
            composer
        }
        .safeAreaInset(edge: .top) { header }
    }

    /// The open chat's contact row. The core only fills in `photo` for this one peer,
    /// and only while their chat is up — a base64 avatar is far too big to clone into
    /// every contact on every render — so the header is the one place it can be shown.
    private var peer: ContactVM? {
        core.view.contacts.first { $0.pubkey == core.view.activePeer }
    }

    private var header: some View {
        HStack(spacing: 12) {
            Button { core.update(.back) } label: { Image(systemName: "chevron.left") }
            Avatar(base64: peer?.photo ?? "", name: core.view.activePeerName, size: 32)
            VStack(alignment: .leading, spacing: 1) {
                Text(core.view.activePeerName).font(.headline)
                Text(core.view.activePeerOb).font(.caption2).foregroundColor(.secondary).lineLimit(1)
            }
            Spacer()
            if core.view.activePeerBlocked {
                Text("Blocked").font(.caption).foregroundColor(.secondary)
            }
            Menu {
                BlockToggle(
                    core: core,
                    peer: core.view.activePeer,
                    blocked: core.view.activePeerBlocked
                )
            } label: {
                Image(systemName: "ellipsis.circle")
            }
        }
        .padding(.horizontal).padding(.vertical, 8)
        .background(.bar)
    }

    private var messages: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(core.view.messages, id: \.id) { msg in
                        MessageBubble(msg: msg).id(msg.id)
                    }
                }.padding()
            }
            .onAppear {
                // A chat opens at its newest message, not its oldest.
                if let last = core.view.messages.last {
                    withAnimation(nil) { proxy.scrollTo(last.id, anchor: .bottom) }
                }
            }
            .onChange(of: core.view.messages.count) {
                if let last = core.view.messages.last { proxy.scrollTo(last.id, anchor: .bottom) }
            }
        }
    }

    private var composer: some View {
        HStack(spacing: 8) {
            TextField("Message", text: $draft, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(1...4)
            Button {
                let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !text.isEmpty else { return }
                core.update(.composeChanged(text))
                core.update(.sendText)
                draft = ""
            } label: {
                Image(systemName: "arrow.up.circle.fill").font(.title)
            }
            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(.horizontal).padding(.vertical, 8)
        .background(.bar)
    }
}

struct MessageBubble: View {
    let msg: MessageVM
    var body: some View {
        HStack {
            if msg.outgoing { Spacer(minLength: 40) }
            VStack(alignment: msg.outgoing ? .trailing : .leading, spacing: 2) {
                Text(msg.body)
                    .foregroundColor(msg.outgoing ? .white : .primary)
                HStack(spacing: 4) {
                    Text(formatTime(msg.ts)).font(.caption2)
                        .foregroundColor(msg.outgoing ? .white.opacity(0.7) : .secondary)
                    if msg.outgoing {
                        Image(systemName: msg.delivered ? "checkmark.circle.fill" : "checkmark")
                            .font(.caption2).foregroundColor(.white.opacity(0.8))
                    }
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background(msg.outgoing ? accent : Color(.systemGray5))
            .clipShape(RoundedRectangle(cornerRadius: 16))
            if !msg.outgoing { Spacer(minLength: 40) }
        }
    }
}
