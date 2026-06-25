import CryptoKit
import Foundation
import Security
import Skrepka

// MARK: - HTTP

enum Http {
    static func perform(_ req: HttpRequest) async -> HttpResult {
        guard let url = URL(string: req.url) else {
            return .err(.url(req.url))
        }
        var request = URLRequest(url: url)
        request.httpMethod = req.method
        request.timeoutInterval = 70 // server long-polls for ~25s
        for header in req.headers {
            request.setValue(header.value, forHTTPHeaderField: header.name)
        }
        if !req.body.isEmpty {
            request.httpBody = Data(req.body)
        }
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            return .ok(HttpResponse(
                status: UInt16(clamping: status),
                headers: [],
                body: [UInt8](data)
            ))
        } catch let error as URLError where error.code == .timedOut {
            return .err(.timeout)
        } catch {
            return .err(.io(error.localizedDescription))
        }
    }
}

// MARK: - Timer

enum Time {
    static func handle(_ req: TimeRequest, resolve: @escaping (TimeResponse) -> Void) {
        switch req {
        case .now:
            let now = Date().timeIntervalSince1970
            let seconds = UInt64(now)
            let nanos = UInt32((now - Double(seconds)) * 1_000_000_000)
            resolve(.now(instant: Instant(seconds: seconds, nanos: nanos)))
        case .notifyAfter(let id, let duration):
            let seconds = Double(duration.nanos) / 1_000_000_000
            DispatchQueue.main.asyncAfter(deadline: .now() + seconds) {
                resolve(.durationElapsed(id: id))
            }
        case .notifyAt(let id, let instant):
            let target = Date(timeIntervalSince1970: Double(instant.seconds)
                + Double(instant.nanos) / 1_000_000_000)
            let delay = max(0, target.timeIntervalSinceNow)
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                resolve(.instantArrived(id: id))
            }
        case .clear(let id):
            resolve(.cleared(id: id))
        }
    }
}

// MARK: - Key-value store (one file per key under Application Support)

final class KvStore {
    private let dir: URL

    init() {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        dir = base.appendingPathComponent("skrepka/kv", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    }

    private func fileURL(_ key: String) -> URL {
        let safe = key.replacingOccurrences(of: ":", with: "_")
            .replacingOccurrences(of: "/", with: "_")
        return dir.appendingPathComponent(safe)
    }

    private func read(_ key: String) -> Value {
        guard let data = try? Data(contentsOf: fileURL(key)) else { return .none }
        return .bytes([UInt8](data))
    }

    func handle(_ op: KeyValueOperation) -> KeyValueResult {
        switch op {
        case .get(let key):
            return .ok(response: .get(value: read(key)))
        case .set(let key, let value):
            let previous = read(key)
            try? Data(value).write(to: fileURL(key))
            return .ok(response: .set(previous: previous))
        case .delete(let key):
            let previous = read(key)
            try? FileManager.default.removeItem(at: fileURL(key))
            return .ok(response: .delete(previous: previous))
        case .exists(let key):
            let present = FileManager.default.fileExists(atPath: fileURL(key).path)
            return .ok(response: .exists(isPresent: present))
        case .listKeys(_, _):
            return .ok(response: .listKeys(keys: [], nextCursor: 0))
        }
    }
}

// MARK: - Keychain identity (64-byte libsodium-form Ed25519 secret key)

enum Keychain {
    private static let service = "lol.skrepka.identity"
    private static let account = "identity"

    /// Load the stored 64-byte key, or generate and persist a fresh valid one.
    static func loadOrCreateIdentity() -> Data {
        if let existing = load(), existing.count == 64 {
            return existing
        }
        // Generate a valid Ed25519 keypair; sk64 = seed(32) || pub(32).
        let priv = Curve25519.Signing.PrivateKey()
        var key = Data()
        key.append(priv.rawRepresentation)        // 32-byte seed
        key.append(priv.publicKey.rawRepresentation) // 32-byte public key
        store(key)
        return key
    }

    private static func load() -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess else { return nil }
        return item as? Data
    }

    private static func store(_ data: Data) {
        let delete: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(delete as CFDictionary)
        let add: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemAdd(add as CFDictionary, nil)
    }
}
