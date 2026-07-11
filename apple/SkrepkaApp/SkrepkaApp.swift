import SwiftUI

@main
struct SkrepkaApp: App {
    @StateObject private var core = Core()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView(core: core)
                .onChange(of: scenePhase) { _, phase in
                    // Backgrounding kills the long-poll socket and the app stops running,
                    // so on return the core would otherwise sit out its whole backoff
                    // (up to 30s) before noticing. Reconnect immediately instead.
                    guard phase == .active, core.view.hasIdentity else { return }
                    core.update(.connect)
                }
        }
    }
}
