# Skrepka Security Audit — FFI, Phonemic, Apple Shell (2026-07-16)

**Scope:** Deep audit of `core/src/ffi.rs`, `core/src/phonemic.rs`, and all Apple shell files (`apple/SkrepkaApp/*.swift`). Cross-referenced against `PROTOCOL.md`, `AGENTS.md`, `AUDIT-NEW.md`, and `AUDIT-FRESH.md`. Findings below are **not** in prior audits.

**Legend:** 🔴 critical · 🟠 high · 🟡 medium · 🔵 low · ⚪ info

---

## 1. FFI Boundary

### 🟠 F1. `try!` in Core.swift crashes on empty bytes from `guard` — FFI panic safety is a lie

**Type:** FFI boundary / panic safety
**Files:** `core/src/ffi.rs:42-44` (`guard`), `apple/SkrepkaApp/Core.swift:30,38,49,60,66,74,81`

The `guard` function in `ffi.rs` catches panics with `catch_unwind` and returns an empty `Vec<u8>`. The module doc (lines 4-9) claims: *"the shell already tolerates an empty effect list (it just does nothing) and an empty view (it renders the previous one), so a bug degrades into a stalled UI rather than a corrupted process."*

This is false. Every bincode deserialization in `Core.swift` uses `try!`:

```swift
// Core.swift:30 (init)
self.view = try! .bincodeDeserialize(input: [UInt8](core.view()))

// Core.swift:38 (update)
let effects = [UInt8](core.update(data: Data(try! event.bincodeSerialize())))

// Core.swift:49 (dispatch)
let requests = try! Requests.bincodeDeserialize(input: effects).value

// Core.swift:60 (render)
self.view = try! .bincodeDeserialize(input: [UInt8](core.view()))
```

If `core.view()` or `core.update()` returns empty bytes (from a caught panic), `try! .bincodeDeserialize(input: [])` throws, and `try!` produces a fatal error — **crashing the app**, not degrading gracefully. The `init` case is the worst: there is no "previous view" to render, so the very first `core.view()` call would crash the app on launch if the core panics.

**Attack scenario:** Any input that causes a panic inside `App::update` or `Skrepka::view` — an unforeseen edge case, a dependency bug, or an integer overflow in debug mode — would crash the app instantly via `try!` rather than degrading to a stalled UI as the FFI docs claim. On iOS, this is a clean crash with no data corruption, but it's a denial-of-service: the user can't use the app at all.

**Exploitable in practice:** Requires triggering a panic in the Rust core. The core code is careful with `unwrap_or` / `unwrap_or_default`, but panics from dependencies (e.g., `serde_json` on malformed input, `zstd` on a crafted frame) or array indexing bugs are possible. A hostile relay crafting specific poll responses could potentially trigger a panic in the decrypt path.

**Suggested fix:** Replace `try!` with `try?` or a `do/catch` block that logs the error and skips the deserialization. For `init`, provide a default empty `ViewModel` if `core.view()` returns empty bytes. Alternatively, have `guard` return a sentinel (e.g., a single zero byte) that the Swift side can detect as "panic occurred" and handle gracefully.

---

### 🟡 F2. `AssertUnwindSafe` is unsound — Model is read after a panic

**Type:** FFI boundary / memory safety
**Files:** `core/src/ffi.rs:39-44` (`guard` + `AssertUnwindSafe`)

The `guard` function uses `AssertUnwindSafe(f)` to bypass the `UnwindSafe` requirement. The doc comment (lines 39-41) justifies this: *"AssertUnwindSafe is sound here because a poisoned Bridge is never read again for correctness: the worst case is a dropped effect batch, and the next event starts a fresh update."*

This is incorrect. The `Bridge` holds the `Core`, which holds the `Model`. `App::update` takes `&mut Model` and mutates it in place. If a panic occurs **mid-update** (after some model mutations but before the function returns), the `Model` is left in a partially-mutated, inconsistent state. The `catch_unwind` catches the panic, returns empty bytes, but the `Model` stays corrupted. The **next** `update` call operates on this corrupted model.

The comment's claim that "the next event starts a fresh update" is misleading — a fresh update on a corrupted model is not fresh. The model's invariants (e.g., `contacts` is consistent with `messages`, `cursor` is valid, `outbox` items are well-formed) may be violated.

**Attack scenario:** A panic mid-update corrupts the model. The next `update` call sees the corrupted state and may:
- Write corrupted state to kv (persisting the corruption across launches)
- Crash on a subsequent update (if the corruption violates an invariant checked by `update`)
- Produce incorrect behavior (e.g., sending messages to the wrong recipient)

**Exploitable in practice:** Requires triggering a panic mid-update, which is the same bar as F1. The corruption is silent — the user sees a stalled UI (if F1 doesn't crash first), but the next interaction operates on corrupted state.

**Suggested fix:** After a caught panic, reset the `Model` to a known-good state (e.g., re-load from kv) or mark the `Bridge` as poisoned and refuse further operations. Alternatively, snapshot the `Model` before `update` and restore it on panic. This is expensive but correct. At minimum, document that a panic may corrupt the model and recommend the shell re-initialize the core after a caught panic.

---

### 🔵 F3. `resolve` accepts arbitrary `EffectId` — no validation against pending effects

**Type:** FFI boundary / input validation
**Files:** `core/src/ffi.rs:70-78` (`resolve`)

The `resolve` method accepts any `u32` as an effect ID and any `&[u8]` as the resolution data. The `Bridge::resolve` call would fail with `Err` if the effect ID is unknown, which `guard` converts to an empty Vec. But the empty Vec would crash the Swift side via `try!` (see F1).

More importantly, if the Swift side has a bug that resolves the same effect ID twice (e.g., from a race between a timer callback and a `.clear` call), the second resolution would produce effects for a non-existent or already-resolved effect. The `Bridge::resolve` would return `Err`, which becomes empty bytes, which crashes via `try!`.

**Attack scenario:** Not directly exploitable by an attacker — the effect IDs are generated by the core and passed to the shell. But a shell bug (e.g., a race condition in timer handling) could trigger a double-resolve, crashing the app.

**Suggested fix:** The shell should track which effect IDs are pending and guard against double-resolve. The FFI should return a distinguishable error for "unknown effect ID" vs "serialization failure" so the shell can handle it gracefully.

---

## 2. Phonemic

### 🔵 P1. `to_ob` / `from_ob` round-trip asymmetry for empty input

**Type:** Correctness asymmetry
**Files:** `core/src/phonemic.rs:98-109` (`to_ob`), `core/src/phonemic.rs:113-132` (`from_ob`)

`to_ob(&[])` returns `Some(String::new())` (empty string), but `from_ob("")` returns `None` (because `split('-').filter(|p| !p.is_empty()).collect()` yields an empty Vec, which triggers `parts.is_empty() => None`).

This means `to_ob` produces a string that `from_ob` can't decode. The round-trip property is broken for empty input.

**Impact:** No caller passes empty bytes to `to_ob` for pubkey purposes (keys are always 32 bytes). The asymmetry is documented in the test `odd_length_input_has_no_spelling` (line 210). Harmless in practice.

**Suggested fix:** Either make `to_ob(&[])` return `None` (consistent with odd-length rejection) or make `from_ob("")` return `Some(vec![])` (consistent with the encoding). The former is safer — an empty encoding is meaningless.

---

### 🔵 P2. `try_parse_pubkey` hex path lowercases redundantly — no bug, but misleading

**Type:** Code clarity
**Files:** `core/src/phonemic.rs:154`

`hex::decode(trimmed.to_lowercase())` — the `hex` crate's `decode` accepts both uppercase and lowercase hex digits. The `to_lowercase()` is redundant for the hex path. It doesn't cause a bug (the output of `valid_pubkey_hex` is always lowercase via `hex::encode`), but it suggests the case matters when it doesn't.

**Suggested fix:** Remove the `to_lowercase()` or add a comment explaining it's for consistency, not correctness.

---

### ⚪ P3. No @p/hex collision for 32-byte pubkeys — confirmed safe

**Type:** Correctness verification
**Files:** `core/src/phonemic.rs:148-158` (`try_parse_pubkey`)

A 64-char hex string has no hyphens, so `from_ob` sees one part of 64 chars, fails the `part.len() != 6` check, returns `None`. The hex path then decodes it. No collision.

A valid @p for a 32-byte key is 16 syllables (111 chars with hyphens). `hex::decode` fails on hyphens. No collision.

A 6-char hex string (e.g., "abcdef") that happens to be a valid @p syllable: `from_ob` decodes it to 2 bytes, `valid_pubkey_hex` rejects (not 32 bytes). `hex::decode` gives 3 bytes, also rejected. No collision.

**Verdict:** Safe. The @p-first ordering in `try_parse_pubkey` is correct.

---

### ⚪ P4. `from_ob` multibyte handling is correct — confirmed safe

**Type:** Correctness verification
**Files:** `core/src/phonemic.rs:113-132`

`to_lowercase()` is applied before `split('-')`. For non-ASCII input, `to_lowercase()` may change byte lengths, but the `part.len() != 6 || !part.is_ascii()` check on each part catches any non-ASCII characters that survive lowercasing. The test `multibyte_input_is_rejected_not_panicked_on` (line 279) confirms this.

The `part[0..3]` and `part[3..6]` slices are safe because `part.len() == 6` and `part.is_ascii()` (ASCII = 1 byte per char, so byte indices == char indices).

**Verdict:** Safe. No panic on multibyte input.

---

## 3. Apple Shell — HTTP Handling

### 🟡 A1. `Http.perform` doesn't validate URL scheme — `file://` requests would be honored

**Type:** Defense-in-depth gap
**Files:** `apple/SkrepkaApp/Effects.swift:104-106`

```swift
guard let url = URL(string: req.url) else {
    return .err(.url(req.url))
}
var request = URLRequest(url: url)
```

The shell accepts any URL scheme. `URLSession.data(for:)` handles `file://` URLs by reading local files. The core's `normalize_server_url` only accepts `http`/`https`, but if a bug in the core (or a future change) produces a `file://` or `data:` URL, the shell would honor it without question.

**Attack scenario:** Not directly exploitable — the server URL is user-configured and validated by `normalize_server_url`. But if a bug in URL construction (e.g., `format!("{}/poll", model.settings.server_url)` where `server_url` is somehow `file:///etc/passwd`) reaches the shell, a local file could be read and its contents returned to the core as an HTTP response body. The core would try to parse it as JSON, fail, and treat it as an empty page.

**Exploitable in practice:** Requires a core bug that produces a non-http URL. `normalize_server_url` prevents this for the server URL, but there's no belt-and-suspenders check in the shell.

**Suggested fix:** Add a scheme check in `Http.perform`:
```swift
guard url.scheme == "http" || url.scheme == "https" else {
    return .err(.url(req.url))
}
```

---

### 🟡 A2. `HttpSessionDelegate` cancels same-host redirects — may break legitimate HTTPS upgrades

**Type:** Protocol conformance / usability
**Files:** `apple/SkrepkaApp/Effects.swift:45-53`

The redirect delegate cancels **all** redirects, including same-host redirects. A relay that redirects from `http://relay:80` to `https://relay:443` (a legitimate TLS upgrade) would have its redirect cancelled. The client would see the 3xx response and treat it as a failure.

The protocol says "plain HTTP, served over TLS in production" (§5), and `normalize_server_url` accepts both `http` and `https`. So a relay that serves HTTP on port 80 and redirects to HTTPS on port 443 would be broken by this client.

**Attack scenario:** Not an attack — a usability issue. A relay operator who sets up an HTTP-to-HTTPS redirect would find that Skrepka clients can't connect.

**Exploitable in practice:** Depends on relay configuration. The `install.sh` deploys Caddy with TLS, so production relays serve HTTPS directly (no redirect). But a relay misconfigured to redirect would be unreachable.

**Suggested fix:** Allow same-host redirects (compare the redirect target's host against the original request's host). Only cancel cross-host redirects, which are the token-exfiltration vector. Or, since the protocol says no redirects, document that relays must not redirect.

---

### 🔵 A3. `UInt16(clamping:)` silently truncates status codes > 65535

**Type:** Input validation
**Files:** `apple/SkrepkaApp/Effects.swift:120`

```swift
status: UInt16(clamping: http?.statusCode ?? 0),
```

HTTP status codes are 3-digit integers (100-599), so this is fine in practice. But `UInt16(clamping:)` would clamp any value > 65535 to 65535, which is a valid `UInt16` but not a valid HTTP status. The core checks `status >= 200 && status < 300` for success, so 65535 would be treated as failure. No security issue.

**Verdict:** Safe. HTTP status codes are bounded by the protocol.

---

### ⚪ A4. URLSession configuration is correct — confirmed safe

**Type:** Implementation review
**Files:** `apple/SkrepkaApp/Effects.swift:91-101`

The session configuration is:
- `ephemeral` — no cookies, no cache, no persistent storage ✓
- `httpCookieAcceptPolicy = .never` ✓
- `httpShouldSetCookies = false` ✓
- `httpCookieStorage = nil` ✓
- `urlCache = nil` ✓
- `requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData` ✓
- `timeoutIntervalForRequest = 70` — matches the server's ~25s long-poll ✓
- `tlsMinimumSupportedProtocolVersion = .TLSv12` ✓

No sensitive data in logs. The `error.localizedDescription` in the catch block returns user-friendly strings like "The network connection was lost" — no relay-specific info beyond what the user already configured.

**Verdict:** Safe. Good defense-in-depth.

---

### ⚪ A5. Response size limiting is correct — confirmed safe

**Type:** Implementation review
**Files:** `apple/SkrepkaApp/Effects.swift:31-79`

The `HttpSessionDelegate` tracks per-task byte counts in a thread-safe `NSLock`-guarded dictionary. When a task's accumulated body exceeds `maxResponseBytes` (64 MiB), the task is cancelled. The `didCompleteWithError` callback cleans up the dictionary entry. Every task eventually completes (success, failure, or cancel), so no dictionary leak.

The 64 MiB cap matches the core's `MAX_POLL_RESPONSE_BYTES` (also 64 MiB). The shell's cap fires before the core's (the shell cancels the task mid-stream, the core never sees the full body), which is the correct ordering — the shell's cap prevents OOM before the core's check runs.

**Verdict:** Safe. Well-designed.

---

## 4. Apple Shell — Keychain & KV Persistence

### ⚪ A6. Keychain storage is correct — confirmed safe

**Type:** Implementation review
**Files:** `apple/SkrepkaApp/Effects.swift:320-415`

- `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` — key never rides backup ✓
- `SecItemUpdate` first, then `SecItemAdd` if not found — no delete-then-add window ✓
- `errSecItemNotFound` is the only status that triggers key generation ✓
- 64-byte key length is validated on load ✓
- `loadOrCreateIdentity` is called only on the main actor (singleton `Core.shared`), so no race ✓

The `store` function's update-then-add sequence has a theoretical race (between `SecItemUpdate` returning `errSecItemNotFound` and `SecItemAdd`, another thread could add the item), but `bootIdentity` is only called on the `@MainActor` singleton, so there's no concurrency.

**Verdict:** Safe. Good practice.

---

### ⚪ A7. KV persistence is correct — confirmed safe

**Type:** Implementation review
**Files:** `apple/SkrepkaApp/Effects.swift:195-316`

- Serial queue — all operations serialized ✓
- Atomic writes with `.completeFileProtectionUnlessOpen` ✓
- `isExcludedFromBackup = true` — plaintext history not in iCloud backup ✓
- Percent-encoding with `.alphanumerics` — injective key→filename mapping, no path traversal ✓
- Legacy migration runs before any read (same serial queue) ✓
- Missing file = empty key (`.none`), not an error — correct distinction from read failure ✓

**Verdict:** Safe. Well-designed.

---

## 5. Apple Shell — Photo Picker & QR Scanning

### 🔵 A8. `PhotoPicker` last-resort quality doesn't check size cap

**Type:** Logic bug / UX
**Files:** `apple/SkrepkaApp/PhotoPicker.swift:80-81`

```swift
// Last resort: the smallest quality that still produces something.
return image.jpegData(compressionQuality: 0.1)?.base64EncodedString()
```

The loop (lines 71-79) reduces quality until the base64 fits within 64 KiB (`maxBase64Len`). But the last-resort return on line 81 doesn't check if the result fits. If a 256px JPEG at q0.1 still exceeds 64 KiB (possible for high-frequency noise images), the core's `SaveProfile` rejects it with "photo too large" and the user has no recourse.

**Attack scenario:** A user picks a photo that, even at 256px and q0.1, produces > 64 KiB of base64. The profile save fails with no way to proceed. Not a security issue — a UX dead end.

**Exploitable in practice:** Very unlikely for real photos (256px JPEG at q0.1 is typically 5-15 KiB). But a synthetic image (e.g., pure noise) could exceed the cap.

**Suggested fix:** If the last-resort still exceeds the cap, return `nil` (triggering `onCancel`) or downscale further (e.g., 128px). Or document that the user should pick a different photo.

---

### 🔵 A9. `scannedKeyPayload` is business logic in the shell — portability concern

**Type:** Protocol conformance / architecture
**Files:** `apple/SkrepkaApp/QRView.swift:24-35`

`scannedKeyPayload` parses QR code content: strips URL schemes (`skrepka://`, `https://`, `http://`), extracts the last path component, and trims whitespace. This is parsing logic that determines what input the core receives.

`AGENTS.md` says: *"The shell never decides anything — it turns Effects into platform calls and resolves the results back in."* This function decides how to interpret a QR code, which is arguably a business decision.

An Android client would need to reimplement this logic. If the parsing differs (e.g., one client strips `skrepka://` and another doesn't), the same QR code would produce different inputs to the core.

**Attack scenario:** Not a security vulnerability — the core's `try_parse_pubkey` validates the result regardless. But a portability bug: a QR code with a `skrepka://` prefix would work on iOS (stripped by `scannedKeyPayload`) but fail on an Android client that doesn't strip the scheme.

**Suggested fix:** Move `scannedKeyPayload` into the core (e.g., `try_parse_pubkey_from_qr` or add scheme-stripping to `try_parse_pubkey`). The shell should pass the raw QR content to the core.

---

### 🔵 A10. `QRScannerView` doesn't check camera permission

**Type:** UX gap
**Files:** `apple/SkrepkaApp/QRView.swift:75-80`

`ScannerVC.viewDidLoad` calls `AVCaptureDevice.default(for: .video)`, which returns `nil` if camera permission hasn't been granted (or has been denied). The `guard` fails silently, and the scanner shows a black screen with no error message or permission prompt.

**Attack scenario:** Not a security issue. A user who denied camera permission can't scan QR codes and sees a black screen with no explanation.

**Suggested fix:** Check `AVCaptureDevice.authorizationStatus(for: .video)` and request permission if not determined. Show an error message if denied.

---

### ⚪ A11. `QRScannerView` camera lifecycle is correct — confirmed safe

**Type:** Implementation review
**Files:** `apple/SkrepkaApp/QRView.swift:101-114`

`startRunning()` and `stopRunning()` are dispatched to a background queue (`DispatchQueue.global(qos: .userInitiated)`) to avoid blocking the main thread. The `done` flag in `Coordinator` prevents multiple `onScan` callbacks. The camera session is properly stopped in `viewWillDisappear`.

**Verdict:** Safe.

---

## 6. Apple Shell — Logic Leakage & Protocol Conformance

### 🟡 A12. `BackgroundRefresh` polls `core.view` in a tight loop — main actor contention

**Type:** Performance / architecture
**Files:** `apple/SkrepkaApp/SkrepkaApp.swift:156-163`

The `settle` function polls `core.view` every 200ms, reading the `@Published` `ViewModel` on the main actor. While the overhead per poll is minimal (reading a published property), this runs for up to 25 seconds during a background refresh. If the core is processing a large poll response (which also runs on the main actor via `resolve`), the 200ms polls interleave with core processing.

More importantly, `core.view` is a `@Published` property backed by `ViewModel`, which is a value type. Each read copies the entire `ViewModel` (including `contacts: Vec<ContactVM>` and `messages: Vec<MessageVM>`). For a user with 500 contacts and 1000 messages, each poll copies ~1 MB of data. Over 25 seconds at 200ms intervals, that's 125 copies = ~125 MB of transient allocations.

**Attack scenario:** Not an attack — a performance issue. A user with many contacts and active conversations would experience increased memory pressure during background refresh.

**Suggested fix:** Use a Combine subscription (`core.$view.sink`) instead of polling, or have the core expose a lightweight "status changed" flag that the shell can check without copying the full `ViewModel`.

---

### 🔵 A13. `Core.swift` `dispatch` silently drops effects if `try!` crashes — no recovery

**Type:** Error handling
**Files:** `apple/SkrepkaApp/Core.swift:47-53`

```swift
private func dispatch(_ effects: [UInt8]) {
    // swiftlint:disable:next force_try
    let requests = try! Requests.bincodeDeserialize(input: effects).value
    for request in requests {
        process(request)
    }
}
```

If `effects` is valid bincode but contains an effect variant the Swift side doesn't know about (e.g., after a core update that adds a new effect without regenerating Swift types), `try!` would crash. The AGENTS.md warns about this: *"Touching Event, ViewModel, or Effect without running just generate leaves the Swift side compiling against stale types."*

But there's no runtime recovery. The crash is immediate and unrecoverable. A safer approach would be to catch the deserialization error, log it, and skip the unknown effect — the core would see the effect as unresolved and its watchdog would handle it.

**Suggested fix:** Replace `try!` with `try?` and log the error. Unknown effects are dropped; the core's watchdog handles the missing resolution.

---

### ⚪ A14. `Time.handle` timer lifecycle is correct — confirmed safe

**Type:** Implementation review
**Files:** `apple/SkrepkaApp/Effects.swift:147-191`

The `timers` dictionary is on the `@MainActor`. The `schedule` function removes the old work item before inserting a new one. The `DispatchWorkItem`'s callback runs on the main queue (via `MainActor.assumeIsolated`), so there's no interleaving between `schedule` and the callback. The `.clear` case removes and cancels the work item.

No race condition: all operations are on the main actor / main queue, which is single-threaded.

**Verdict:** Safe.

---

### ⚪ A15. `SkrepkaApp.swift` background refresh is correct — confirmed safe

**Type:** Implementation review
**Files:** `apple/SkrepkaApp/SkrepkaApp.swift:64-164`

- `isProtectedDataAvailable` guard prevents running while locked ✓
- `settle` polling respects `Task.isCancelled` and deadline ✓
- `setTaskCompleted(success: !Task.isCancelled)` correctly reports failure on cancellation ✓
- `schedule()` is called before `run()` — next refresh is always queued ✓
- `Core.shared` is only accessed after the `isProtectedDataAvailable` guard ✓

**Verdict:** Safe. Well-designed.

---

## 7. Protocol & AGENTS.md Conformance

### 🔵 A16. AGENTS.md says "five kv loads" but core does six — `seen_ids` added

**Type:** Documentation drift
**Files:** `AGENTS.md:98` ("fans out five kv loads"), `core/src/app.rs:719-726` (six loads)

AGENTS.md line 98 says: *"IdentityLoaded fans out five kv loads → LoadedSettings triggers Connect"*. But the core actually fans out **six** kv loads: `settings`, `profile`, `contacts`, `cursor`, `outbox`, and `seen_ids` (line 725: `KeyValue::get(K_SEEN_IDS)`). The `STARTUP_LOADS` constant is 6 (line 312).

**Impact:** Documentation drift, not a bug. A developer reading AGENTS.md would expect five loads and be confused by the sixth.

**Suggested fix:** Update AGENTS.md to say "six kv loads" and include `seen_ids` in the list.

---

### 🔵 A17. AGENTS.md lists kv keys without `seen_ids` — stale documentation

**Type:** Documentation drift
**Files:** `AGENTS.md:14` ("keys `settings`, `profile`, `contacts`, `cursor`, `outbox`, and `messages:<peer_hex>`")

The `seen_ids` key is not listed in AGENTS.md's kv key list. It was added as part of the dedup fix (AUDIT-NEW.md Q18) but the documentation wasn't updated.

**Suggested fix:** Add `seen_ids` to the kv key list in AGENTS.md.

---

## Summary of New Findings

| # | Severity | Type | Title |
|---|----------|------|-------|
| F1 | 🟠 high | FFI/panic | `try!` in Core.swift crashes on empty bytes from `guard` — FFI panic safety claim is false |
| F2 | 🟡 medium | FFI/memory | `AssertUnwindSafe` is unsound — Model is read after a panic, corruption persists |
| F3 | 🔵 low | FFI/input | `resolve` accepts arbitrary EffectId — double-resolve crashes via `try!` |
| P1 | 🔵 low | Correctness | `to_ob`/`from_ob` round-trip asymmetry for empty input |
| P2 | 🔵 low | Clarity | `try_parse_pubkey` hex path lowercases redundantly |
| P3 | ⚪ info | Safe | No @p/hex collision for 32-byte pubkeys — confirmed |
| P4 | ⚪ info | Safe | `from_ob` multibyte handling is correct — confirmed |
| A1 | 🟡 medium | HTTP/defense | `Http.perform` doesn't validate URL scheme — `file://` would be honored |
| A2 | 🟡 medium | HTTP/protocol | Redirect delegate cancels same-host redirects — breaks HTTPS upgrades |
| A3 | 🔵 low | HTTP/input | `UInt16(clamping:)` silently truncates status codes > 65535 |
| A4 | ⚪ info | Safe | URLSession configuration is correct |
| A5 | ⚪ info | Safe | Response size limiting is correct |
| A6 | ⚪ info | Safe | Keychain storage is correct |
| A7 | ⚪ info | Safe | KV persistence is correct |
| A8 | 🔵 low | Photo/UX | `PhotoPicker` last-resort quality doesn't check size cap |
| A9 | 🔵 low | Architecture | `scannedKeyPayload` is business logic in the shell — portability concern |
| A10 | 🔵 low | QR/UX | `QRScannerView` doesn't check camera permission |
| A11 | ⚪ info | Safe | QR scanner camera lifecycle is correct |
| A12 | 🟡 medium | Performance | `BackgroundRefresh` polls `core.view` — copies full ViewModel every 200ms |
| A13 | 🔵 low | Error handling | `Core.swift` `dispatch` crashes on unknown effect — no recovery |
| A14 | ⚪ info | Safe | Timer lifecycle is correct |
| A15 | ⚪ info | Safe | Background refresh is correct |
| A16 | 🔵 low | Docs | AGENTS.md says "five kv loads" but core does six |
| A17 | 🔵 low | Docs | AGENTS.md kv key list missing `seen_ids` |

**High (1):** F1
**Medium (4):** F2, A1, A2, A12
**Low (8):** F3, P1, P2, A3, A8, A9, A10, A13, A16, A17
**Info (8):** P3, P4, A4, A5, A6, A7, A11, A14, A15

---

## Priorities

1. **F1 (high):** Replace `try!` in Core.swift with graceful error handling. The FFI's panic safety design is undermined by `try!` — a caught panic crashes the app instead of degrading. This is the most impactful finding because it turns every potential core panic into an immediate app crash.

2. **F2 (medium):** Address `AssertUnwindSafe` soundness. After a caught panic, the Model may be corrupted. At minimum, document the risk and consider resetting the Model from kv on panic recovery.

3. **A1 (medium):** Add URL scheme validation in `Http.perform`. Defense-in-depth against a core bug producing non-http URLs.

4. **A2 (medium):** Allow same-host redirects or document that relays must not redirect. The current all-redirects-cancelled policy breaks legitimate HTTPS upgrades.

5. **A12 (medium):** Replace `settle`'s polling with a Combine subscription to avoid copying the full ViewModel every 200ms during background refresh.