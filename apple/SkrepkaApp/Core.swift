import Foundation
import Skrepka
import SkrepkaShared

/// Drives the Rust core: serializes events in, deserializes effects out, performs
/// each effect (HTTP, key-value, timer, render) and resolves it back into the core.
@MainActor
final class Core: ObservableObject {
    /// One core per process, reachable outside the view tree.
    ///
    /// `SkrepkaApp` holds this in a `@StateObject`, but the background-refresh handler runs
    /// with no view installed — and a `@StateObject` read from there hands back a *fresh*
    /// instance every time. That would mean a second `CoreFFI` with its own identity, its own
    /// kv state and its own poll loop, writing over the real one's files and rendering into
    /// nothing. The state machine is a singleton in fact; make it one in the type.
    static let shared = Core()

    @Published var view: ViewModel

    /// A Keychain failure never reaches the core — without an identity there is no
    /// `IdentityLoaded` event to carry it — so the shell holds it. `RootView` shows this
    /// instead of spinning on a progress view forever.
    @Published private(set) var identityError: String?

    private let core = CoreFFI()
    private let store = KvStore()

    private init() {
        // The FFI's guard returns empty bytes when the core panics; force-try
        // on empty bytes crashes the app. Fall back to a default ViewModel instead.
        self.view = (try? ViewModel.bincodeDeserialize(input: [UInt8](core.view()))) ?? ViewModel()
        bootIdentity()
    }

    // MARK: - Event/effect loop

    func update(_ event: Event) {
        guard let eventData = try? event.bincodeSerialize() else { return }
        let effects = [UInt8](core.update(data: Data(eventData)))
        dispatch(effects)
    }

    private func resolve(_ id: UInt32, _ output: [UInt8]) {
        let effects = [UInt8](core.resolve(id: id, data: Data(output)))
        dispatch(effects)
    }

    private func dispatch(_ effects: [UInt8]) {
        guard let requests = try? Requests.bincodeDeserialize(input: effects).value else { return }
        for request in requests {
            process(request)
        }
    }

    private func process(_ request: Request) {
        let id = request.id
        switch request.effect {
        case .render:
            self.view = (try? ViewModel.bincodeDeserialize(input: [UInt8](core.view()))) ?? self.view

        case .http(let req):
            Task { [weak self] in
                let result = await Http.perform(req)
                guard let output = try? result.bincodeSerialize() else { return }
                self?.resolve(id, output)
            }

        case .keyValue(let op):
            // The file I/O runs on the store's own serial queue; hop the result back to
            // the main actor, because the core is single-threaded and `.render` publishes.
            store.handle(op) { [weak self] result in
                guard let output = try? result.bincodeSerialize() else { return }
                Task { @MainActor in self?.resolve(id, output) }
            }

        case .time(let req):
            Time.handle(req) { [weak self] response in
                guard let output = try? response.bincodeSerialize() else { return }
                self?.resolve(id, output)
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