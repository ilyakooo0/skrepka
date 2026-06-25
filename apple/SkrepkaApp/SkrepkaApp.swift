import SwiftUI

@main
struct SkrepkaApp: App {
    @StateObject private var core = Core()

    var body: some Scene {
        WindowGroup {
            RootView(core: core)
        }
    }
}
