import BackgroundTasks
import SwiftUI
import UIKit

@main
struct SkrepkaApp: App {
    /// Must stay in step with `BGTaskSchedulerPermittedIdentifiers` in `project.yml`.
    /// An identifier the Info.plist does not list is refused by `submit` — quietly, and
    /// forever: the task simply never runs, and nothing at runtime says why.
    static let refreshTaskId = "lol.skrepka.SkrepkaApp.fetch"

    @StateObject private var core = Core.shared
    @Environment(\.scenePhase) private var scenePhase

    init() {
        // Launch handlers must all be registered before the app finishes launching, so this
        // cannot wait for a view to appear. The handler is called on a background queue;
        // `BackgroundRefresh` hops to the main actor, where the core lives.
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.refreshTaskId,
            using: nil
        ) { task in
            guard let task = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }
            BackgroundRefresh.handle(task)
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView(core: core)
                .onChange(of: scenePhase) { _, phase in
                    switch phase {
                    case .active:
                        // Backgrounding kills the long-poll socket and the app stops running,
                        // so on return the core would otherwise sit out its whole backoff
                        // (up to 30s) before noticing. Reconnect immediately instead.
                        guard core.view.hasIdentity else { return }
                        core.update(.connect)
                    case .background:
                        // Ask for a refresh pass on the way out — that is the only window in
                        // which a pending request is any use, and the system replaces the
                        // previous request for this identifier rather than queueing another.
                        BackgroundRefresh.schedule()
                    default:
                        break
                    }
                }
        }
    }
}

/// Opportunistic catch-up while the app is backgrounded.
///
/// This does **not** keep the poll loop alive — iOS grants no such thing to a non-VoIP app.
/// `BGAppRefreshTask` wakes us for a few tens of seconds at times the system chooses from the
/// user's launch habits (`earliestBeginDate` is a floor, not a schedule: a pass may be hours
/// late, or never come at all if the app was force-quit), and suspends us again as soon as we
/// report completion. So this drains whatever the relay is already holding, on the system's
/// terms. Prompt delivery would need a push, and the protocol has no APNs surface at all.
@MainActor
enum BackgroundRefresh {
    /// The system coalesces and defers as it sees fit; asking for less does not make it come
    /// sooner, it only tells the scheduler we have nothing useful to do before then.
    private static let earliestBegin: TimeInterval = 30 * 60

    /// The grant is around 30s, and an app that habitually burns all of it — or worse, gets
    /// expired — is scheduled less often. Leave headroom.
    private static let budget: TimeInterval = 25

    /// How long to hold the poll open once we are online. The relay answers a poll at once
    /// when it is holding mail and otherwise long-polls ~25s, so a few seconds of silence
    /// already *is* the answer "nothing waiting" — there is nothing to be gained by waiting
    /// out the long poll, and the budget is better left unspent.
    private static let idleGrace: TimeInterval = 5

    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: SkrepkaApp.refreshTaskId)
        request.earliestBeginDate = Date(timeIntervalSinceNow: earliestBegin)
        // Throws on `.notPermitted` (the identifier is missing from the Info.plist — a
        // packaging bug, see `SkrepkaApp.refreshTaskId`) and on `.tooManyPendingTaskRequests`.
        // Neither is actionable from here, and neither is worth failing a scene transition.
        try? BGTaskScheduler.shared.submit(request)
    }

    nonisolated static func handle(_ task: BGAppRefreshTask) {
        let work = Task { @MainActor in await run(task) }
        // Expiry only *cancels*; `run` owns the single `setTaskCompleted` call.
        // The handler is assigned immediately after Task creation — the window
        // where the task is alive but unhandled is one assignment, and the system
        // does not expire a task in its first few milliseconds.
        task.expirationHandler = { work.cancel() }
    }

    private static func run(_ task: BGAppRefreshTask) async {
        // Before anything that can fail or be cut short: we still want the next pass.
        schedule()

        // Every kv file is written `completeUnlessOpen`, so while the device is
        // locked an *existing* one cannot be opened and every read fails. The
        // core now distinguishes a failed read from an absent key (`parse_kv`
        // returns `Err` vs `Ok(None)`), so it surfaces a storage error instead
        // of silently loading an empty model. But the guard is still the right
        // call: a locked device means the core would come up with errors on
        // every key, no contacts, and no history — and even if it doesn't
        // overwrite, it would poll into an empty conversation list and ack
        // messages the user can't see. Locked means we must not run at all.
        guard UIApplication.shared.isProtectedDataAvailable else {
            task.setTaskCompleted(success: false)
            return
        }

        let deadline = Date(timeIntervalSinceNow: budget)
        let core = Core.shared

        // Reading `Core.shared` is what boots the core when the system launched us straight
        // into the background. Startup is asynchronous — the identity, then five kv loads —
        // and the core fires its own `Connect` once the settings land. It must be left to do
        // that: nudging it beforehand would authenticate against the *default* relay, because
        // the configured URL has not been read off disk yet.
        guard await settle(by: deadline, until: { core.view.hasIdentity }) else {
            task.setTaskCompleted(success: false)
            return
        }

        // Still offline once startup has had its chance: either the core is idle, or it was
        // suspended part-way through a backoff whose timer will not come due for another 30s.
        // A `Connect` collapses that wait. (It is a no-op when the core already believes it
        // is online — there, a stale poll is the watchdog's problem, not ours.)
        let startupDeadline = min(deadline, Date(timeIntervalSinceNow: 3))
        let connecting = await settle(by: startupDeadline, until: {
            core.view.connStatus != "offline"
        })
        if !connecting {
            core.update(.connect)
        }

        // Online is the token in hand and the poll issued. Anything the relay was holding
        // comes back on that first page.
        guard await settle(by: deadline, until: { core.view.connStatus == "online" }) else {
            task.setTaskCompleted(success: false)
            return
        }
        try? await Task.sleep(for: .seconds(idleGrace))

        task.setTaskCompleted(success: !Task.isCancelled)
    }

    /// Waits for a condition on the view, or for the deadline (or expiry) to overtake it.
    ///
    /// The core has nothing to await — it publishes a `ViewModel` and that is the whole of
    /// its output — so the shell watches that. A 200ms tick across the handful of transitions
    /// this cares about is cheaper than threading a Combine subscription through an actor hop.
    private static func settle(by deadline: Date, until condition: () -> Bool) async -> Bool {
        while !condition() {
            guard !Task.isCancelled, Date() < deadline else { return false }
            // Cancellation makes this throw at once; the guard above is what breaks the loop.
            try? await Task.sleep(for: .milliseconds(200))
        }
        return true
    }
}
