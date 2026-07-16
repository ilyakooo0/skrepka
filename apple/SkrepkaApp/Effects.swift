import CryptoKit
import Foundation
import Security
import Skrepka

// MARK: - HTTP

/// Hard cap on any HTTP response body we will buffer. A hostile relay
/// can answer any endpoint with a multi-gigabyte body; without this cap
/// `URLSession.data(for:)` would OOM the app before the core's own
/// `MAX_POLL_RESPONSE_BYTES` check (which runs on the wrong side of the
/// FFI boundary to prevent the allocation) ever fires.
private let maxResponseBytes = 64 * 1024 * 1024 // 64 MiB

/// The one session delegate, handling two defenses against an untrusted relay.
///
/// **Redirect cancellation.** URLSession replays the original request's headers onto a
/// redirect target, including `Authorization: Bearer <session_token>`. A hostile (or
/// compromised) relay could answer `/poll` or `/messages` with a 302 to a host it chooses
/// and harvest the bearer token from the request we would dutifully re-send there. Sessions
/// are bound to a single relay by design (§6), so a cross-host redirect is never legitimate
/// — refusing it costs nothing and closes the token-exfiltration path. Same-host redirects
/// (e.g. HTTP → HTTPS upgrade on the same host) are allowed; the Authorization header stays
/// within the relay's own host. Returning `nil` from the completion handler does not error
/// the task: it stops the redirect and hands the 3xx response itself back to the caller,
/// which the core sees as a non-2xx status and treats as a failed request.
///
/// **Response size limiting.** As body chunks arrive we accumulate the byte count per task
/// and cancel the task the moment it crosses `maxResponseBytes`, so a multi-gigabyte body
/// never fully materializes in memory. Cancelling surfaces to the caller as a `URLError`
/// with code `.cancelled`, which `Http.perform` maps to a transport error.
private final class HttpSessionDelegate: NSObject, URLSessionTaskDelegate, URLSessionDataDelegate {
    let maxResponseBytes: Int

    /// Per-task accumulated byte counts. The delegate is shared across every concurrent
    /// request, so a single shared counter would conflate their bodies — key by task instead.
    /// Guarded by `lock` because delegate callbacks arrive on the session's own (non-main)
    /// queue and may interleave across tasks.
    private var taskSizes: [URLSessionTask: Int] = [:]
    private let lock = NSLock()

    init(maxResponseBytes: Int) {
        self.maxResponseBytes = maxResponseBytes
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        // Allow same-host redirects (e.g. HTTP → HTTPS upgrade on the same host).
        // Cancel cross-host redirects — a hostile relay could redirect to an
        // attacker-controlled host and harvest the Authorization header.
        if let originalURL = task.currentRequest?.url,
           let redirectHost = request.url?.host?.lowercased(),
           let originalHost = originalURL.host?.lowercased(),
           redirectHost == originalHost {
            completionHandler(request)
        } else {
            completionHandler(nil)
        }
    }

    func urlSession(
        _ session: URLSession,
        dataTask: URLSessionDataTask,
        didReceive data: Data
    ) {
        lock.lock()
        let total = (taskSizes[dataTask] ?? 0) + data.count
        taskSizes[dataTask] = total
        let exceeded = total > maxResponseBytes
        lock.unlock()
        if exceeded {
            dataTask.cancel()
        }
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didCompleteWithError error: Error?
    ) {
        lock.lock()
        taskSizes.removeValue(forKey: task)
        lock.unlock()
    }
}

enum Http {
    /// Strongly held by `session` for the app's lifetime — the session is never invalidated,
    /// so the delegate is never released. That is the intended shape here, not a leak.
    private static let httpDelegate = HttpSessionDelegate(maxResponseBytes: maxResponseBytes)

    /// A private, ephemeral session. `URLSession.shared` would hand every relay a
    /// persistent cookie jar and an on-disk response cache — a relay is untrusted
    /// infrastructure and must not be able to pin a stable identifier on the client
    /// or leave polled ciphertext lying around on disk. It would also follow redirects,
    /// which is what `HttpSessionDelegate` is here to prevent.
    private static let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieAcceptPolicy = .never
        config.httpShouldSetCookies = false
        config.httpCookieStorage = nil
        config.urlCache = nil
        config.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        config.timeoutIntervalForRequest = 70 // server long-polls for ~25s
        config.tlsMinimumSupportedProtocolVersion = .TLSv12
        return URLSession(configuration: config, delegate: httpDelegate, delegateQueue: nil)
    }()

    static func perform(_ req: HttpRequest) async -> HttpResult {
        guard let url = URL(string: req.url),
              let scheme = url.scheme,
              scheme == "http" || scheme == "https" else {
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
            let (data, response) = try await session.data(for: request)
            let http = response as? HTTPURLResponse
            return .ok(HttpResponse(
                status: UInt16(clamping: http?.statusCode ?? 0),
                headers: headers(of: http),
                body: [UInt8](data)
            ))
        } catch let error as URLError where error.code == .cancelled {
            // The size-limit delegate cancels the task when the body exceeds the cap.
            // Treat it as a transport error so the core backs off and retries.
            return .err(.io("response body exceeded \(maxResponseBytes) bytes"))
        } catch let error as URLError where error.code == .timedOut {
            return .err(.timeout)
        } catch {
            return .err(.io(error.localizedDescription))
        }
    }

    /// HTTP header names are case-insensitive; the core matches them lowercased.
    private static func headers(of response: HTTPURLResponse?) -> [HttpHeader] {
        guard let response else { return [] }
        return response.allHeaderFields.compactMap { (name, value) -> HttpHeader? in
            guard let name = name as? String, let value = value as? String else { return nil }
            return HttpHeader(name: name.lowercased(), value: value)
        }
    }
}

// MARK: - Timer

@MainActor
enum Time {
    /// Live timers, so `.clear` can actually cancel one. Resolving a crux effect twice
    /// (once from `.clear`, once from the work item that was never cancelled) traps in
    /// the core, so a dangling work item is a latent crash, not just wasted work.
    private static var timers: [TimerId: DispatchWorkItem] = [:]

    static func handle(_ req: TimeRequest, resolve: @MainActor @escaping (TimeResponse) -> Void) {
        switch req {
        case .now:
            let now = Date().timeIntervalSince1970
            let seconds = UInt64(now)
            let nanos = UInt32((now - Double(seconds)) * 1_000_000_000)
            resolve(.now(instant: Instant(seconds: seconds, nanos: nanos)))
        case .notifyAfter(let id, let duration):
            let seconds = Double(duration.nanos) / 1_000_000_000
            schedule(id, after: seconds) { resolve(.durationElapsed(id: id)) }
        case .notifyAt(let id, let instant):
            let target = Date(timeIntervalSince1970: Double(instant.seconds)
                + Double(instant.nanos) / 1_000_000_000)
            schedule(id, after: max(0, target.timeIntervalSinceNow)) {
                resolve(.instantArrived(id: id))
            }
        case .clear(let id):
            timers.removeValue(forKey: id)?.cancel()
            resolve(.cleared(id: id))
        }
    }

    private static func schedule(
        _ id: TimerId,
        after seconds: TimeInterval,
        fire: @MainActor @escaping () -> Void
    ) {
        timers.removeValue(forKey: id)?.cancel() // a reused id supersedes the old timer
        let work = DispatchWorkItem {
            MainActor.assumeIsolated {
                timers.removeValue(forKey: id)
                fire()
            }
        }
        timers[id] = work
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: work)
    }
}

// MARK: - Key-value store (one file per key under Application Support)

final class KvStore {
    private let dir: URL
    /// Serial: the core issues overlapping reads and writes to the same key, and the
    /// file for a key is the only copy of that state. Off the main actor, because
    /// `messages:<peer>` grows without bound and a write of it must not stutter the UI.
    private let queue = DispatchQueue(label: "lol.skrepka.kv")

    init() {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        var url = base.appendingPathComponent("skrepka/kv", isDirectory: true)
        try? FileManager.default.createDirectory(
            at: url,
            withIntermediateDirectories: true,
            attributes: [.protectionKey: FileProtectionType.completeUnlessOpen]
        )
        // Plaintext message history: it must not ride along in an iCloud/iTunes backup,
        // which is not covered by the device passcode the way the Keychain item is.
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? url.setResourceValues(values)
        dir = url

        // Ordered ahead of every operation: `handle` runs on the same serial queue, so
        // the rename is done before the first read can look for a file under the new name.
        queue.async { [self] in migrateLegacyNames() }
    }

    /// Rename the files an older build wrote, which substituted `_` for `:`.
    ///
    /// `messages:<peer>` lived in `messages_<peer>`; `fileURL(forKey:)` now percent-encodes,
    /// so it looks for `messages%3A<peer>` and finds nothing. Without this, an upgrade opens
    /// every conversation empty — and the first new message writes a fresh file, orphaning
    /// the old one (plaintext history) on disk forever. The other five keys are alphanumeric,
    /// so their names are unchanged and they need no migration.
    private func migrateLegacyNames() {
        let fm = FileManager.default
        guard let names = try? fm.contentsOfDirectory(atPath: dir.path) else { return }
        for name in names where name.hasPrefix("messages_") {
            let peer = String(name.dropFirst("messages_".count))
            let destination = fileURL(forKey: "messages:\(peer)")
            guard !fm.fileExists(atPath: destination.path) else { continue }
            try? fm.moveItem(at: dir.appendingPathComponent(name), to: destination)
        }
    }

    /// Runs the operation on the serial queue and resolves from there. The core does not
    /// care which thread resolves an effect — `Core` hops the result back to the main
    /// actor before it touches the state machine.
    func handle(_ op: KeyValueOperation, completion: @escaping (KeyValueResult) -> Void) {
        queue.async { [self] in completion(perform(op)) }
    }

    private func perform(_ op: KeyValueOperation) -> KeyValueResult {
        switch op {
        case .get(let key):
            switch read(key) {
            case .success(let value): return .ok(response: .get(value: value))
            case .failure(let error): return .err(error: .io(message: error.localizedDescription))
            }

        case .set(let key, let value):
            do {
                // Atomic: a crash mid-write must not leave a truncated messages:<peer>.
                try Data(value).write(
                    to: fileURL(forKey: key),
                    options: [.atomic, .completeFileProtectionUnlessOpen]
                )
                // The core discards `previous`, so reading the old value back would
                // double the cost of every write to buy nothing.
                return .ok(response: .set(previous: .none))
            } catch {
                return .err(error: .io(message: error.localizedDescription))
            }

        case .delete(let key):
            switch read(key) {
            case .failure(let error):
                return .err(error: .io(message: error.localizedDescription))
            case .success(let previous):
                let url = fileURL(forKey: key)
                do {
                    if FileManager.default.fileExists(atPath: url.path) {
                        try FileManager.default.removeItem(at: url)
                    }
                    return .ok(response: .delete(previous: previous))
                } catch {
                    return .err(error: .io(message: error.localizedDescription))
                }
            }

        case .exists(let key):
            let present = FileManager.default.fileExists(atPath: fileURL(forKey: key).path)
            return .ok(response: .exists(isPresent: present))

        case .listKeys:
            // Never used by the core. Reporting success with no keys would read as
            // "the store is empty" — say so honestly instead.
            return .err(error: .io(message: "listKeys is not implemented"))
        }
    }

    /// A missing file is an empty key; anything else is a real failure. Collapsing the
    /// two would let a transient read error look like "no contacts yet", and the next
    /// save would write that emptiness back over the real store.
    private func read(_ key: String) -> Result<Value, Error> {
        let url = fileURL(forKey: key)
        guard FileManager.default.fileExists(atPath: url.path) else { return .success(.none) }
        do {
            return .success(.bytes([UInt8](try Data(contentsOf: url))))
        } catch {
            return .failure(error)
        }
    }

    /// Percent-encoding, so the key → filename mapping is injective. Substituting `_`
    /// for both `:` and `/` would collide `messages:ab` with `messages/ab`, and two
    /// peers' histories would land in the same file.
    private func fileURL(forKey key: String) -> URL {
        let encoded = key.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? key
        return dir.appendingPathComponent(encoded)
    }
}

// MARK: - Keychain identity (64-byte libsodium-form Ed25519 secret key)

enum Keychain {
    private static let service = "lol.skrepka.identity"
    private static let account = "identity"

    /// `Result`'s failure type has to be an `Error`, and `OSStatus` is a bare `Int32`.
    struct Status: Error { let code: OSStatus }

    enum IdentityError: Error {
        /// The item may well exist — we just could not read it (e.g. the device has not
        /// been unlocked since boot). Never generate a replacement on this path.
        case unreadable(OSStatus)
        case corrupt(Int)
        case notStored(OSStatus)

        var message: String {
            switch self {
            case .unreadable(let status):
                return "Could not read the identity key from the Keychain (\(status)). "
                    + "Unlock the device and try again."
            case .corrupt(let count):
                return "The stored identity key is \(count) bytes, not 64. "
                    + "Reinstalling the app will create a new identity — the old one is unrecoverable."
            case .notStored(let status):
                return "Could not save the new identity key to the Keychain (\(status))."
            }
        }
    }

    /// Load the stored 64-byte key, or — only when the Keychain positively reports that
    /// no item exists — generate and persist a fresh one.
    static func loadOrCreateIdentity() -> Result<Data, IdentityError> {
        switch load() {
        case .failure(let status):
            return .failure(.unreadable(status.code))

        case .success(.some(let existing)):
            guard existing.count == 64 else { return .failure(.corrupt(existing.count)) }
            return .success(existing)

        case .success(.none):
            // Generate a valid Ed25519 keypair; sk64 = seed(32) || pub(32).
            let priv = Curve25519.Signing.PrivateKey()
            var key = Data()
            key.append(priv.rawRepresentation)           // 32-byte seed
            key.append(priv.publicKey.rawRepresentation) // 32-byte public key
            if let status = store(key) { return .failure(.notStored(status)) }
            return .success(key)
        }
    }

    /// `errSecItemNotFound` is the only status that means "no identity yet". Every other
    /// failure leaves the question open, and the caller must not answer it by minting a
    /// new keypair — that would overwrite an identity we merely failed to read.
    private static func load() -> Result<Data?, Status> {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        switch status {
        case errSecSuccess: return .success(item as? Data)
        case errSecItemNotFound: return .success(nil)
        default: return .failure(Status(code: status))
        }
    }

    /// Update in place, adding only if nothing is there. Delete-then-add would open a
    /// window where a crash (or a kill) leaves no key at all, and the next launch would
    /// silently mint a *new* identity — losing the old one, and with it every contact's
    /// idea of who we are.
    ///
    /// Returns `nil` on success, or the failing `OSStatus`.
    private static func store(_ data: Data) -> OSStatus? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            // ThisDeviceOnly: the identity key must never ride along in a device backup.
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]

        let updated = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if updated == errSecSuccess { return nil }
        guard updated == errSecItemNotFound else { return updated }

        let added = SecItemAdd(query.merging(attributes) { current, _ in current } as CFDictionary, nil)
        return added == errSecSuccess ? nil : added
    }
}
