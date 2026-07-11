import Foundation
import Skrepka
import SkrepkaShared

/// Drives the Rust core: serializes events in, deserializes effects out, performs
/// each effect (HTTP, key-value, timer, render) and resolves it back into the core.
@MainActor
final class Core: ObservableObject {
    @Published var view: ViewModel

    /// A Keychain failure never reaches the core — without an identity there is no
    /// `IdentityLoaded` event to carry it — so the shell holds it. `RootView` shows this
    /// instead of spinning on a progress view forever.
    @Published private(set) var identityError: String?

    private let core = CoreFFI()
    private let store = KvStore()

    init() {
        // swiftlint:disable:next force_try
        self.view = try! .bincodeDeserialize(input: [UInt8](core.view()))
        bootIdentity()
    }

    // MARK: - Event/effect loop

    func update(_ event: Event) {
        // swiftlint:disable:next force_try
        let effects = [UInt8](core.update(data: Data(try! event.bincodeSerialize())))
        dispatch(effects)
    }

    private func resolve(_ id: UInt32, _ output: [UInt8]) {
        let effects = [UInt8](core.resolve(id: id, data: Data(output)))
        dispatch(effects)
    }

    private func dispatch(_ effects: [UInt8]) {
        // swiftlint:disable:next force_try
        let requests = try! Requests.bincodeDeserialize(input: effects).value
        for request in requests {
            process(request)
        }
    }

    private func process(_ request: Request) {
        let id = request.id
        switch request.effect {
        case .render:
            // swiftlint:disable:next force_try
            self.view = try! .bincodeDeserialize(input: [UInt8](core.view()))

        case .http(let req):
            Task { [weak self] in
                let result = await Http.perform(req)
                // swiftlint:disable:next force_try
                self?.resolve(id, try! result.bincodeSerialize())
            }

        case .keyValue(let op):
            // The file I/O runs on the store's own serial queue; hop the result back to
            // the main actor, because the core is single-threaded and `.render` publishes.
            store.handle(op) { [weak self] result in
                // swiftlint:disable:next force_try
                let output = try! result.bincodeSerialize()
                Task { @MainActor in self?.resolve(id, output) }
            }

        case .time(let req):
            Time.handle(req) { [weak self] response in
                // swiftlint:disable:next force_try
                self?.resolve(id, try! response.bincodeSerialize())
            }
        }
    }

    // MARK: - Identity

    /// Loads the identity key, or reports why it could not. Safe to call again — that is
    /// what the retry affordance on the error screen does, and the common failure (the
    /// device has not been unlocked since boot) resolves on its own.
    func bootIdentity() {
        switch Keychain.loadOrCreateIdentity() {
        case .success(let key):
            identityError = nil
            update(.identityLoaded([UInt8](key)))
        case .failure(let error):
            identityError = error.message
        }
    }
}
