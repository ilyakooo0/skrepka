# Skrepka Security Audit — Fresh Pass (2026-07-15)

**Scope:** Exhaustive multi-pass audit of PROTOCOL.md, server.knot, core/src/ (app.rs,
crypto.rs, protocol.rs, model.rs, phonemic.rs, ffi.rs), apple/SkrepkaApp/ (Effects.swift,
Core.swift, Views.swift, Forms.swift), install.sh. Findings below are **not** in
PROTOCOL-REVIEW.md or AUDIT-NEW.md, or are new angles on previously-noted areas.

**Legend:** 🔴 critical · 🟠 high · 🟡 medium · 🔵 low · ⚪ info

---

## 1. Cryptographic Protocol

### 🔴 N1. No AAD on AEAD — envelope `to` field is unauthenticated, enabling silent targeted censorship by any relay

**Type:** Design gap (protocol + crypto.rs)
**Files:** `core/src/crypto.rs:384-387` (encrypt), `core/src/crypto.rs:434-438` (decrypt)

AUDIT-NEW.md Q2 notes this but downgrades the impact to "equivalent to message loss, which is
an accepted limitation." That understates it. The real issue is **silent, targeted message loss
with zero detectability**:

A relay holding a victim's messages can swap the `to` field on a *specific* message (from a
sender the relay wants to censor), while leaving other messages intact. The recipient never
sees the message and gets no error. The `delivery.ack` system doesn't help because the recipient
never received the message to ack it, and the sender's UI shows the message as "sent"
indefinitely — which is the same behavior as "the recipient is offline" or "the recipient read
it but hasn't acked yet." There is **no way for either party to distinguish "the relay ate
Alice's message" from "Alice didn't send anything" or "Bob is just slow to ack."**

This is worse than the generic "relay can drop messages" case. Dropping is *eventually*
detectable — the sender sees their message stuck at "sent" and can investigate. But `to`-swapping
moves the message to a *different recipient's* mailbox, where it's undecryptable and gets
silently dropped on poll. The original recipient's cursor is unaffected (no events), so the
next poll is normal. The censorship is invisible.

**Attack scenario:**
1. Alice sends a message to Bob via relay R.
2. R swaps `to` from Bob's pubkey to Charlie's.
3. Message stored under Charlie's mailbox. Charlie can't decrypt (wrong key), drops silently.
4. Bob polls, gets nothing. Normal poll, no error.
5. Alice's UI shows "sent" — same as if Bob were merely offline.
6. No delivery.ack ever comes. Alice can't tell if Bob received it or not.

The relay can do this selectively — censor messages from specific senders, or suppress specific
content patterns (inferred from blob size), while delivering everything else normally. The
censorship is undetectable because the sender sees the same "sent" status they'd see for any
offline recipient, and the recipient sees nothing unusual.

**Suggested fix:** Include `version_byte || ephemeral_public || nonce || recipient_ed25519_public`
as AAD in the AEAD. The `to` field must match `recipient_ed25519_public` in the AAD. A relay
swapping `to` causes the wrong recipient to fail AEAD decryption (before signature check), and
the blob is dropped before cursor advancement. The *original* recipient's message stays in the
mailbox. Wire-format change (v0x02).

### ⚪ N2. HKDF info string and wire version byte are independent constants

**Type:** Code hygiene (crypto.rs)
**Files:** `core/src/crypto.rs:28` (`HKDF_INFO = b"skrepka-v1"`), `crypto.rs:33` (`WIRE_VERSION = 1`)

The spec says "A future revision that changes the crypto primitives should bump both the version
byte and the HKDF `info` string together." But there's no code-level binding between them. A
developer bumping `WIRE_VERSION` to `2` could forget to update `HKDF_INFO`, causing two different
crypto versions to derive keys with the same KDF label.

**Suggested fix:** Derive the info string from the version byte or add a compile-time assertion
linking them.

---

## 2. Server Implementation

### 🟡 N3. `appendMessage` dedup scan is O(n) — identical-blob replay amplifies to O(n × batch_size)

**Type:** Implementation concern / DoS amplification (server.knot)
**Files:** `server.knot:919-937`

AUDIT-NEW.md Q7 notes the O(n) dedup scan. The amplification is worse than described for
identical-blob replay: a batch of 100 identical blobs to the same recipient does 100 × O(|messages|)
scans. With |messages| = 10,000, that's 1M comparisons per request. At 60 requests/min, that's
60M comparisons/min. Each comparison is a string equality on 64-char hex pubkeys + 346+ char
hex blobs.

**Attack:** An attacker authenticates (free keypair) and sends batches of 100 identical
min-size blobs to one recipient. Each request is ~35 KB but triggers 1M comparisons. Bounded
by the 60/min rate limit, but the CPU amplification is ~1000x per request.

**Suggested fix:** Index `*messages` by `(toKey, encryptedBlob)` or use a hash-based dedup set.

### 🟡 N4. `capForwards` eviction is non-deterministic when retry counts are equal

**Type:** Implementation bug (server.knot)
**Files:** `server.knot:515-522` (`capForwards`)

AUDIT-NEW.md Q9 notes this. The sort by `retries` only (no secondary sort key) means when many
entries share `retries: 0`, the sort is unstable and any retries-0 entry can be dropped —
including a fresh forward for a healthy peer that would have succeeded on the first try.

**Impact:** Delivery delay, not permanent loss (the message stays in `*messages` and can be
re-forwarded on the next presence announce). But it's a real availability issue under
federation abuse.

**Suggested fix:** Sort by `(retries, encryptedBlob)` for determinism, or skip entries for
peers in backoff before capping.

### 🟡 N5. `handleRecvGossip` `fromServer` not verified against connecting peer's address

**Type:** Design gap (server.knot)
**Files:** `server.knot:1533-1578`

AUDIT-NEW.md Q29 notes this. The `fromServer` field is self-asserted and used to route forwarded
messages. An attacker can claim any `fromServer` hostname. The server writes presence rows with
that hostname and forwards queued messages there. This is the root cause of the gossip-redirect
attack and is already documented, but the spec's §10 should state more prominently that **the
server has no mechanism to verify that the connecting peer is who it claims to be**.

The `fromServer` field is a `ServerName` (format-validated), but format validation only checks
length, lowercase, and no trailing dot — it does not verify the peer controls that hostname.

**Suggested fix:** Document more prominently. Real fix needs reverse-DNS verification or peer
authentication (signed gossip).

### 🔵 N6. `genToken` generates one hex digit per `randomInt 16` call — entropy waste

**Type:** Implementation concern (server.knot)
**Files:** `server.knot:532-537`

AUDIT-NEW.md Q10 notes the CSPRNG dependency. Additionally, generating one hex digit at a time
is inefficient — each `randomInt 16` call should produce at least 4 bits, but if the runtime's
`randomInt` draws from a wider source (e.g., 32-bit `getrandom`), it wastes 28 bits per call.
48 calls × 28 wasted bits = 1344 bits wasted per token. Not a security issue (entropy is
abundant) but inefficient.

**Verdict:** Info.

---

## 3. Client Core Logic

### 🟡 N7. `seen_ids` dedup set is unbounded — grows without limit per peer

**Type:** Implementation concern (app.rs)
**Files:** `core/src/app.rs:325` (`seen_ids: BTreeMap<String, HashSet<String>>`)

The `seen_ids` map (Q18 fix) is persisted to kv and loaded at startup. It's a `BTreeMap<String,
HashSet<String>>` — one entry per peer, each a set of message IDs. The set is never trimmed.
Over time, a peer who sends thousands of messages accumulates thousands of IDs. The kv blob
(`seen_ids`) grows without bound.

With `MAX_ID_LEN` = 128 chars and UUIDs = 36 chars, 1000 messages per peer (the conversation cap)
= 36 KB per peer. With 500 contacts (`MAX_CONTACTS`), that's 18 MB. The `seen_ids` kv blob is
rewritten in full on every conversation touch (line 2316), so a large set makes every message
receipt slower. On iOS, a 18 MB JSON blob written to Application Support on every incoming
message is a real performance issue.

**Suggested fix:** Cap the `seen_ids` set per peer (e.g., keep the last 2000 IDs) and trim
periodically. Or use a time-based expiry. Or a Bloom filter with a fixed size.

### 🟡 N8. `ingest_poll` advances cursor before processing events — crash between advance and persist loses messages

**Type:** Implementation concern (app.rs)
**Files:** `core/src/app.rs:2024-2089`

The cursor is advanced to `page.cursor` on line 2038 (before the event loop), and restored to
`prev_cursor` on budget exhaustion (line 2086) or event count overflow (line 2069). The cursor
is persisted to kv AFTER `ingest_poll` returns (line 1369), via a `KeyValue::set` effect. This
means the cursor write only happens after the event loop completes successfully.

However, there's a crash window: if the app crashes between `model.cursor = clamped_cursor`
(line 2038) and the cursor persist effect (line 1369), the in-memory cursor is advanced but
the persisted cursor is still `prev_cursor`. On relaunch, the client sends `prev_cursor` to
the relay, which re-serves the events. No message loss — the persisted cursor is the safe one.

**Verdict:** Safe. The cursor is only authoritative when persisted, and the persist happens
after `ingest_poll` completes. A crash during `ingest_poll` loses no data because the persisted
cursor hasn't changed. Info.

### 🟡 N9. `ingest_poll` budget exhaustion drops remaining events — client is stuck if the relay always serves an oversized page

**Type:** Implementation concern (app.rs)
**Files:** `core/src/app.rs:2054-2089`

When the `MAX_POLL_TOTAL_BYTES` budget is exhausted mid-page, the loop breaks, the cursor is
restored to `prev_cursor`, and an error is set. The next poll sends `prev_cursor` again, and
the relay re-serves the same events. If the page always exceeds the budget (e.g., the relay
serves 50 large blobs and the budget only covers 10), the client is stuck: poll, process 10,
drop 40, re-poll, relay serves the same 50, process the same 10 (deduped, fast), drop 40, etc.

The dedup makes re-processing fast (already-seen IDs are O(1) drops), but the client never
advances past the oversized page. The relay's events are served in `receivedAt` order, so the
same 50 events come back every time. The cursor never moves. The client is stuck in a loop.

This is a **livelock**: the client polls, processes some events, but can never ack them. The
relay keeps serving the same page. The client's error message ("relay sent an oversized poll
page") is set but may not be visible in the UI.

**Attack scenario:** A malicious relay serves a page of 50 blobs, each just under `MAX_BLOB_LEN`
(42 MiB). The total page is ~2 GiB, far exceeding the 64 MiB budget. The client processes a few,
drops the rest, and is stuck. Or more subtly: the relay serves 50 blobs that are each ~1.3 MiB
(total ~65 MiB, just over the 64 MiB budget). The client processes 49, drops 1, and is stuck
because the cursor never advances past the 50th event.

**Suggested fix:** When the budget is exhausted, advance the cursor to the last *successfully
processed* event's `receivedAt` (not `page.cursor` and not `prev_cursor`). This acks the
processed events and lets the client move forward, dropping only the unprocessed tail. The
relay re-serves only the unprocessed events on the next poll. This changes the behavior from
"all-or-nothing cursor advance" to "partial ack."

### 🟡 N10. Profile `ts` staleness check uses `>=` — equal-timestamp replay is a no-op, but the check is per-contact, not per-field

**Type:** Implementation concern (app.rs)
**Files:** `core/src/app.rs:2174-2179` (approximate)

AUDIT-NEW.md Q19 analyzes this and concludes it's safe because the attacker can't modify the
content without breaking the signature. I agree — the `>=` is correct and a same-`ts` replay
is a true no-op (same ciphertext, same signature, same content). Info.

---

## 4. Wire Format / Parsing

### 🟡 N11. `protocol.rs` `parse_payload` does not validate `ts` is positive — negative `ts` clamped to 0 is harmless but surprising

**Type:** Implementation concern (protocol.rs)
**Files:** `core/src/protocol.rs:100`

AUDIT-NEW.md Q24 notes this. A `ts` of 0 or negative is clamped to `max(0, ...)` in `ingest_poll`.
A message with `ts = 0` is inserted at the earliest chronological position and trimmed first.
This is harmless. Info.

### 🟡 N12. `delivery.ack` parsing accepts non-string entries in `ack_ids` — filtered silently, no length check on individual IDs after filtering

**Type:** Implementation concern (protocol.rs)
**Files:** `core/src/protocol.rs:116-126`

AUDIT-NEW.md Q26 notes this. The double-check (raw count + post-filter count) is correct.
Non-string entries are filtered. Individual ID length is checked (`ack_ids.iter().any(|id|
id.len() > MAX_ID_LEN)`). This is correct. Info.

---

## 5. Federation

### 🟠 N13. Gossip amplification: 100 online events trigger 100 mailbox scans + forward staging — O(100 × |messages|) per request

**Type:** Design gap (server.knot)
**Files:** `server.knot:1544-1578` (`handleRecvGossip`)

AUDIT-NEW.md Q27 notes this. A single gossip request with 100 `online` events for 100 different
keys triggers `forwardQueuedToServer` for each key, which scans the entire mailbox. With
|messages| = 10,000, that's 100 × 10,000 = 1M comparisons per request. At 60/min per IP, that's
60M comparisons/min. An attacker with 10 IPs can do 600M comparisons/min.

Additionally, each `forwardQueuedToServer` call stages forward entries, which consume
`maxForwardsPerServer` slots and trigger HTTP POSTs to the attacker's server. The attacker
receives copies of the victim's ciphertext.

**Suggested fix:** Limit the number of newly-online keys per gossip batch that trigger forwards
(e.g., cap at 10). Or batch the mailbox scan across all newly-online keys in one pass.

### 🟡 N14. `offline` gossip events don't cancel pending forwards — wasted retries for up to 80 minutes

**Type:** Design gap (server.knot)
**Files:** `server.knot:1535-1541`

AUDIT-NEW.md Q28 notes this. When an `offline` event is received, pending forwards to that server
are not cancelled. They retry for up to `retryBackoffMax × maxForwardRetries` = 8 min × 10 = 80
minutes, wasting `maxForwardsPerServer` slots and generating failed HTTP requests.

If the offline event was spoofed, the forwards continue — and if the key is actually still
online at that server, the forward succeeds on retry. The impact is minimal.

**Suggested fix:** When processing an `offline` event, optionally drop pending forwards to that
server for the offline key. But this could cause message loss if the offline event is spoofed.
Better to leave as-is and document.

---

## 6. Deployment / install.sh

### 🟡 N15. `install.sh` downloads binary over HTTPS but checksum is best-effort — missing checksum silently proceeds

**Type:** Deployment concern (install.sh)
**Files:** `install.sh:150-181`

The checksum verification is best-effort: if the `.sha256` file doesn't exist (line 162 fails),
the script warns and proceeds. If `sha256sum`/`shasum` is not available, it warns and proceeds.
A checksum that exists but doesn't match is fatal (line 169-174) — correct.

The concern: a compromised release asset without a published `.sha256` file (e.g., a pre-checksum
release, or a supply-chain attack that removes the checksum file) would be installed without
verification. The script trusts GitHub's HTTPS, but HTTPS authenticates the CDN, not the
artifact. A compromised GitHub release would sail through.

**Suggested fix:** Make the checksum mandatory for all new installs. Keep the best-effort
behavior only for upgrades from pre-checksum releases, with a prominent warning.

### ⚪ N16. `install.sh` DOMAIN validation rejects uppercase but the Caddyfile interpolation is safe

**Type:** Deployment review (install.sh)
**Files:** `install.sh:34-45`

DOMAIN is lowercased and stripped of scheme/path/port before interpolation into the Caddyfile
and systemd unit. The validation rejects anything outside `[a-z0-9.-]`. This prevents config
injection (a stray quote or semicolon in the Caddyfile). Good.

**Verdict:** Safe. Info.

---

## 7. Apple Shell

### ⚪ N17. URLSession redirect cancellation is correct — bearer token exfiltration via 302 is prevented

**Type:** Implementation review (Effects.swift)
**Files:** `apple/SkrepkaApp/Effects.swift:8-30`

The `NoRedirectDelegate` cancels all HTTP redirects. This prevents a hostile relay from
answering `/poll` or `/messages` with a 302 to an attacker-controlled host, which would replay
the `Authorization: Bearer` header to the redirect target. The delegate returns `nil`, which
hands the 3xx response to the caller as a non-2xx status. The core treats it as a failed
request. Correct.

**Verdict:** Safe. Good defense.

### ⚪ N18. Keychain uses `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` — key never rides backup

**Type:** Implementation review (Effects.swift)
**Files:** `apple/SkrepkaApp/Effects.swift:352`

The identity key is stored with `ThisDeviceOnly` accessibility, meaning it never enters iCloud
or iTunes backups. The key is accessible after first unlock (not only when unlocked), so
background polling works. This is the correct accessibility class for a messaging identity key.

**Verdict:** Safe. Good practice.

---

## Summary of New Findings

| # | Severity | Type | Title |
|---|----------|------|-------|
| N1 | 🔴 critical | Design gap | No AAD — `to` field unauthenticated, silent targeted censorship |
| N2 | ⚪ info | Code hygiene | HKDF info and wire version byte are independent constants |
| N3 | 🟡 medium | DoS | appendMessage dedup O(n) — identical-blob replay amplifies to O(n × batch) |
| N4 | 🟡 medium | Impl bug | capForwards non-deterministic eviction when retry counts equal |
| N5 | 🟡 medium | Design gap | fromServer not verified against connecting peer address |
| N6 | 🔵 low | Info | genToken entropy waste (one digit per call) |
| N7 | 🟡 medium | Impl concern | seen_ids dedup set unbounded — grows without limit |
| N8 | ⚪ info | Safe | Cursor crash window — persisted cursor is safe |
| N9 | 🟡 medium | Impl concern | Budget exhaustion livelock — client stuck if relay always serves oversized page |
| N10 | ⚪ info | Safe | Profile ts >= replay is a no-op |
| N11 | ⚪ info | Safe | Negative ts clamped to 0 is harmless |
| N12 | ⚪ info | Safe | ack_ids non-string filtering is correct |
| N13 | 🟠 high | Design gap | Gossip amplification 100x — O(100 × |messages|) per request |
| N14 | 🟡 medium | Design gap | Offline events don't cancel pending forwards |
| N15 | 🟡 medium | Deploy | install.sh checksum is best-effort — missing checksum silently proceeds |
| N16 | ⚪ info | Safe | install.sh DOMAIN validation is correct |
| N17 | ⚪ info | Safe | Redirect cancellation prevents token exfiltration |
| N18 | ⚪ info | Safe | Keychain ThisDeviceOnly is correct |

**Critical (1):** N1
**High (1):** N13
**Medium (6):** N3, N4, N5, N7, N9, N14, N15
**Low (1):** N6
**Info (7):** N2, N8, N10, N11, N12, N16, N17, N18

---

## Priorities

1. **N1 (critical):** Add AAD to AEAD. This is the most impactful finding — it enables
   undetectable censorship by any relay. Requires wire-format change (v0x02).

2. **N13 (high):** Document or limit gossip amplification. A single request triggers 100
   mailbox scans. Cap newly-online keys that trigger forwards per batch.

3. **N9 (medium):** Fix budget exhaustion livelock. Advance cursor to last processed event
   instead of restoring to pre-page cursor. This prevents a malicious relay from permanently
   wedging the client with oversized poll pages.

4. **N7 (medium):** Bound `seen_ids` set. An unbounded dedup set that's rewritten on every
   message receipt will degrade performance over time.

5. **N3 (medium):** Index `*messages` for dedup. The O(n) scan is a CPU amplification vector.