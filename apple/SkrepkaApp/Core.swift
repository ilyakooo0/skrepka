import Foundation
import Skrepka
import SkrepkaShared

/// Drives the Rust core: serializes events in, deserializes effects out, performs
/// each effect (HTTP, key-value, timer, render) and resolves it back into the core.
@MainActor
final class Core: ObservableObject {
    @Published var view: ViewModel

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
            let result = store.handle(op)
            // swiftlint:disable:next force_try
            resolve(id, try! result.bincodeSerialize())

        case .time(let req):
            Time.handle(req) { [weak self] response in
                // swiftlint:disable:next force_try
                self?.resolve(id, try! response.bincodeSerialize())
            }
        }
    }

    // MARK: - Identity

    private func bootIdentity() {
        let key = Keychain.loadOrCreateIdentity()
        update(.identityLoaded([UInt8](key)))
    }
}
