# Skrepka Deep Audit — app.rs & model.rs (2026-07-16)

**Scope:** Deep audit of `core/src/app.rs` and `core/src/model.rs`, cross-referenced against PROTOCOL.md §4, §6, §9, §10 and existing audits (AUDIT-NEW.md, AUDIT-FRESH.md, PROTOCOL-REVIEW.md). Findings below are **not** documented in any prior audit.

**Legend:** 🔴 critical · 🟠 high · 🟡 medium · 🔵 low · ⚪ info

---

## 1. State Machine — Poll Loop / Cursor / Budget

### 🟡 D1. `events_stored` doesn't count successfully-decrypted-but-non-stored events — livelock on budget exhaustion

**Type:** State machine bug (livelock)
**File:** `core/src/app.rs:2127, 2188-2200, 2248-2293, 2316, 2342-2349`

The `events_stored` counter drives the cursor-restore decision on budget/count exhaustion (lines 2145-2147, 2163-2165): if `events_stored == 0`, the cursor is restored to `prev_cursor`, and the relay re-serves the same page on the next poll.

`events_stored` is only incremented for:
- Text messages that **pass** dedup (line 2264 — inside `if !id_set.contains`)
- All `delivery.ack` payloads (line 2316)
- Profiles that **pass** staleness (line 2348 — inside `if ts >= c.last_profile_ts`)

It is **NOT** incremented for:
- **Duplicate text messages** (line 2248: the `if !id_set.contains` block is not entered)
- **Stale profiles** (line 2342: the `if ts >=` block is not entered)
- **Profiles from strangers** (line 2327: `continue` before any increment)
- **Self-messages** (line 2188: `continue` before any increment)
- **Blocked-sender messages** (line 2198: `continue` before any increment)

All of these are **successfully decrypted** — they consume the full AEAD decrypt cost and the per-blob byte budget — but they don't increment `events_stored`. If a poll page consists entirely of such events and the byte budget is exhausted mid-page, `events_stored == 0`, the cursor is restored, and the client re-polls with the old cursor. The relay re-serves the same page. **Livelock.**

**Attack scenario:**
1. Client receives 4 large blobs (each ~20 MiB decoded, total ~80 MiB > 64 MiB budget).
2. First encounter: all 4 are new text messages. `events_stored = 3` (budget exhausted on 4th). Cursor kept at `page.cursor`. Relay deletes events. No issue.
3. **Hostile relay re-serves the same 4 blobs** (it kept copies despite cursor advance). All 4 are now duplicates. Budget exhausted on 4th blob. `events_stored == 0`. Cursor restored to `prev_cursor`.
4. Client re-polls with `prev_cursor`. Relay re-serves same 4 blobs. Go to 3. **Permanent livelock** — the client can never advance past this page, wasting bandwidth and battery on every cycle.

The same pattern applies to a page of large stale profile blobs, large profile-from-stranger blobs, or large self-message echoes — all decrypt successfully, all are dropped, none increment `events_stored`.

**Note:** AUDIT-FRESH.md N9 identified the budget-exhaustion livelock for the case where blobs **fail decryption** (events_stored == 0, hostile junk). The fix applied (keep cursor if `events_stored > 0`) addresses that case. But the **duplicate/stale/stranger/self/blocked** cases are different: the blobs ARE decryptable, the client DID process them (and doesn't need them again), but `events_stored` doesn't reflect this. This is a new variant of the N9 livelock that the existing fix does not cover.

**Suggested fix:** Increment `events_stored` after successful decryption and parse, regardless of whether the event is stored:
```rust
let Ok(dec) = crate::crypto::decrypt(&id, &blob) else { continue; };
let Some(parsed) = protocol::parse_payload(&dec.plaintext) else { continue; };
events_stored += 1;  // successfully decrypted — cursor can advance past this
```
This ensures the cursor is kept whenever at least one event was successfully processed (even if it was a duplicate/stale/stranger), breaking the livelock. The unprocessed tail (budget exhaustion) is still lost, but that's the accepted N9 tradeoff.

---

### 🔵 D2. `SetServerUrl` resets `send_retries` but not `poll_retries` — new relay inherits stale poll backoff

**Type:** State machine bug (stale state on relay switch)
**File:** `core/src/app.rs:960`

When switching relays, `SetServerUrl` resets `send_retries = 0` (line 960) and `flush_paused_until = 0` (line 959), with the comment: "The old relay's rate limit was the old relay's opinion. A new one is entitled to take our sends immediately."

The same logic applies to `poll_retries` — it's the old relay's poll failure count — but it is **not reset**. If the old relay was failing (e.g., 5xx storm), `poll_retries` could be at 4 (backoff = 30s). The first poll to the new relay fails (e.g., transient network issue), and `backoff_poll` uses `backoff_ms(5) = 30s` instead of starting at 3s. The new relay's poll loop is penalized for the old relay's failures.

**Attack scenario:** No attack needed — this triggers on any relay switch after a period of poll failures. The user switches to a healthy relay but experiences unnecessarily long poll backoffs.

**Suggested fix:** Add `model.poll_retries = 0;` alongside `model.send_retries = 0;` at line 960.

---

## 2. State Machine — Outbox / Flush

### 🔵 D3. `SendResult` pops outbox items even when `kv_load_failed` is set — duplicate sends on relaunch

**Type:** State machine bug (write guard gap)
**File:** `core/src/app.rs:1547-1560, 1728-1733`

If `kv_load_failed` is set (by a `LoadedMessages` failure) while a send is in flight, `SendResult` still pops the batch from `model.outbox` (line 1557-1559) on a 200 or 400. The subsequent `persist_outbox` (line 1560) calls `refuse_write`, which checks `kv_load_failed` and refuses the write. The items are removed from the in-memory outbox but **not from the on-disk outbox**.

On relaunch, the outbox is re-loaded from disk — the popped items are still there. They are re-sent:
- For a **200** (relay accepted): duplicate sends. The recipient's dedup handles it, but the sender wastes bandwidth and the recipient sees duplicate delivery attempts.
- For a **400** (relay rejected): the items are re-sent and re-rejected, burning retry budget.

**Timeline:**
1. Startup loads complete. `Connect` → `Authenticate` → `VerifyResult` → `Poll` + `StartFlush`.
2. `StartFlush` sends a batch. `flushing = true`, `in_flight` is set.
3. `LoadedMessages` for some peer fails. `kv_load_failed = true`.
4. `SendResult` arrives (200). `flushing` cleared, batch popped (line 1557-1559). `persist_outbox` refused (line 1729-1730).
5. On relaunch: outbox loaded from disk. Items re-sent.

**Note:** The window is narrow — `LoadedMessages` is a lazy load triggered by `LoadedContacts`, and `StartFlush` fires from `VerifyResult` which also fires after startup loads. But the ordering is: startup loads → `Connect` → `Authenticate` → `VerifyResult` → `StartFlush` + `Poll` → `LoadedMessages` (lazy). So the send can be in flight when `LoadedMessages` fails.

**Suggested fix:** Check `kv_load_failed` before popping in `SendResult`. If set, don't pop — leave items in the outbox for relaunch to handle:
```rust
if ((200..300).contains(&status) || status == 400) && !model.kv_load_failed {
    // pop and persist
}
```
Alternatively, don't pop if `persist_outbox` was refused (check the return of `refuse_write`).

---

## 3. Model / Persistence

### 🔵 D4. `now_ms()` returns 0 on system clock failure — outbox TTL disabled

**Type:** Robustness gap
**File:** `core/src/app.rs:580-585`

```rust
fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
```

If the system clock is before `UNIX_EPOCH` (misconfigured device, RTK bug, NTP step), `now_ms()` returns 0. Consequences:

- **Outbox TTL disabled:** `first_attempt` is stamped as 0 (line 1990-1993). `OutboxItem::is_expired` checks `first_attempt > 0` (line 170) — 0 means "never attempted," so the TTL never applies. Stuck items are retried forever (only the retry counter bounds them, which at 10 retries with slow backoff could take days).
- **`flush_paused_until` bypassed:** `now_ms() < flush_paused_until` → `0 < 0` → false. Flushing proceeds immediately, ignoring a relay's `Retry-After`.
- **`last_ack_ts` / `last_profile_ts` clamped to 0:** `ts.min(now)` → `ts.min(0)` → 0 (if ts is positive). All future acks/profiles pass the staleness check (any ts >= 0). Dedup is weakened.

**Attack scenario:** No attack — this is a device misconfiguration. But on iOS, a clock that briefly reads as pre-epoch during boot could trigger this transiently.

**Suggested fix:** Use `UNIX_EPOCH` as the floor instead of 0:
```rust
fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(1)  // 1, not 0 — 0 is a valid "never attempted" sentinel
}
```
Or better: propagate the error and have callers handle clock failure explicitly.

---

### 🔵 D5. `LoadedMessages` merge doesn't update `seen_ids` — weakened dedup after `seen_ids` load failure

**Type:** Dedup gap
**File:** `core/src/app.rs:815-856`

The `LoadedMessages` handler merges on-disk messages into the in-memory conversation (union by ID, re-sort, trim). But it does **not** add the on-disk message IDs to `model.seen_ids`.

When `seen_ids` loads successfully from kv at startup, this is fine — the on-disk IDs are already in the set. But when `seen_ids` **fails to load** (line 807-811, non-fatal), the set is empty. The `ingest_poll` seeding at line 2244-2246 seeds from the conversation:
```rust
if id_set.is_empty() {
    id_set.extend(convo.iter().map(|m| m.id.clone()));
}
```

If a poll arrives **before** `LoadedMessages` for a peer, the conversation is empty (not loaded yet). The seeding adds no IDs. The poll's messages are stored and their IDs are added to the set. Later, `LoadedMessages` arrives and merges the on-disk messages — but their IDs are **never** added to `seen_ids` (the merge doesn't touch `seen_ids`, and the seeding only runs when `id_set.is_empty()`, which is no longer true after the poll).

**Result:** On-disk message IDs are missing from `seen_ids`. Future replays of those on-disk messages pass the dedup check (line 2248) and are re-inserted into the conversation. The `LoadedMessages` merge filters duplicates by ID (line 830), so the conversation doesn't grow unboundedly — but each replay is processed (decrypted, inserted, acked) before the merge catches it.

**Attack scenario:**
1. `seen_ids` kv load fails (device locked, file corruption).
2. `LoadedContacts` triggers `LoadedMessages` for peer P.
3. A poll arrives before `LoadedMessages` for P. P's conversation is empty. `seen_ids[P]` is seeded as empty.
4. Poll stores new messages, adds their IDs to `seen_ids[P]`.
5. `LoadedMessages` for P arrives. On-disk messages are merged into the conversation. Their IDs are NOT added to `seen_ids[P]`.
6. A replay of an on-disk message arrives. Its ID is not in `seen_ids[P]`. It passes dedup. It's inserted and acked.

**Impact:** Weakened dedup — replays of on-disk messages are re-processed (decrypted, stored, acked). No permanent data corruption (the merge prevents duplicate conversation entries), but the recipient sends spurious delivery acks for old messages, and the sender receives false "delivered" confirmations.

**Suggested fix:** In the `LoadedMessages` merge, add the on-disk message IDs to `seen_ids`:
```rust
if let Some(id_set) = model.seen_ids.get_mut(&peer) {
    id_set.extend(list.iter().map(|m| m.id.clone()));
}
```

---

## 4. Protocol Deviations

### ⚪ D6. `ingest_poll` doesn't send profile to stranger on first contact — protocol "SHOULD" not followed

**Type:** Protocol deviation (UX)
**File:** `core/src/app.rs:2221-2230, 2400-2412`

PROTOCOL.md §4: "Clients SHOULD send a `profile` message to a contact on first interaction and whenever the user updates their name, bio, or photo."

When a stranger sends us a text, `ingest_poll` auto-creates a contact (line 2225-2229) and queues a `delivery.ack` (line 2400-2412). But it does **not** queue a `profile` broadcast back to the stranger. The stranger's client has our pubkey (they sent us a message) but no profile — they see our truncated @p but not our display name or avatar.

`send_text` handles this correctly: on first contact (line 1858-1873), it queues a profile broadcast after the text. But `ingest_poll` doesn't.

**Impact:** Minor UX issue — a stranger who initiates conversation doesn't see our profile until we manually send them a text or update our profile. Not a security vulnerability.

**Suggested fix:** After auto-creating a contact in `ingest_poll`, queue a profile broadcast:
```rust
if !known {
    // ... auto-create contact ...
    let profile = Payload::Profile { /* ... */ };
    model.outbox.push_back(OutboxItem::profile(
        sender.clone(),
        Arc::new(protocol::serialize_payload(&profile, ts)),
    ));
    outbox_dirty = true;
}
```

---

## Summary of New Findings

| # | Severity | Type | Title |
|---|----------|------|-------|
| D1 | 🟡 medium | Livelock | `events_stored` doesn't count decrypted-but-non-stored events — livelock on budget exhaustion |
| D2 | 🔵 low | Stale state | `SetServerUrl` doesn't reset `poll_retries` — new relay inherits old poll backoff |
| D3 | 🔵 low | Write guard gap | `SendResult` pops items when `kv_load_failed` — duplicate sends on relaunch |
| D4 | 🔵 low | Robustness | `now_ms()` returns 0 on clock failure — outbox TTL disabled |
| D5 | 🔵 low | Dedup gap | `LoadedMessages` merge doesn't update `seen_ids` — weakened dedup after load failure |
| D6 | ⚪ info | Protocol deviation | `ingest_poll` doesn't send profile to stranger on first contact |

**Medium (1):** D1
**Low (4):** D2, D3, D4, D5
**Info (1):** D6

---

## Priorities

1. **D1 (medium):** Fix `events_stored` to count all successfully decrypted events. This closes a livelock variant that the N9 fix doesn't cover — a hostile relay can permanently wedge the client by re-serving large duplicate/stale/stranger blobs.

2. **D2 (low):** Add `model.poll_retries = 0;` to `SetServerUrl`. One-line fix, prevents stale backoff on relay switch.

3. **D5 (low):** Update `seen_ids` in the `LoadedMessages` merge. Closes a dedup gap when `seen_ids` kv load fails.

4. **D3 (low):** Guard `SendResult` pop with `kv_load_failed` check. Prevents duplicate sends on relaunch.

5. **D4 (low):** Change `unwrap_or(0)` to `unwrap_or(1)` in `now_ms()`. Prevents TTL disablement on clock failure.