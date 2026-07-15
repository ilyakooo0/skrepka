# Skrepka Security Audit — New Findings (2026-07-15)

**Scope:** Exhaustive multi-pass audit of PROTOCOL.md, server.knot, and core/src/ (app.rs, crypto.rs, protocol.rs, model.rs, phonemic.rs, ffi.rs). Findings below are **not** documented in PROTOCOL-REVIEW.md.

**Legend:** 🔴 critical · 🟠 high · 🟡 medium · 🔵 low · ⚪ info

---

## 1. Cryptographic Protocol Weaknesses

### 🔴 Q1. HKDF salt omits sender identity — KCI/UKS not prevented by construction

**Type:** Design gap (protocol + crypto.rs)
**Files:** `core/src/crypto.rs:276-290` (`derive_key`), PROTOCOL.md §3 step 3

The HKDF salt is `ephemeral_public || recipient_x25519_public` — both public values, neither identifying the sender. The encryption key is derived entirely from the ephemeral X25519 exchange and the recipient's public key. While the Ed25519 signature inside the AEAD binds the sender, the *key derivation* itself has no sender contribution.

This means anyone who knows the recipient's private key can compute the same shared secret from a captured ephemeral public key — there's no sender contribution to the KDF. The signature is the only thing binding the sender, and it's verified *after* AEAD decryption. An attacker who obtains the recipient's private key can decrypt all captured blobs (already noted as "no forward secrecy" in §10), but additionally, because the KDF has no sender binding, an attacker can *replace* the sender identity and signature inside a captured ciphertext by re-encrypting with the same ephemeral key — wait, no, they can't re-encrypt without the shared key. However, if the attacker *has* the recipient's private key, they can decrypt, strip the original sender, forge a new inner buffer with their own sender key + signature over the same `recipient || compressed_len || compressed || padding`, re-encrypt with the derived key, and re-send. The recipient sees a valid message from a different sender. This is a *key compromise impersonation (KCI)* vector: compromising the recipient's key lets an attacker re-attribute captured messages.

**Attack scenario:** An attacker records ciphertext between Alice and Bob. Later they compromise Bob's private key. They decrypt the blobs, replace Alice's identity with Mallory's (signing under Mallory's key), re-encrypt, and deliver to Bob. Bob sees messages apparently from Mallory.

**Exploitable in practice:** Requires recipient key compromise, which the protocol already considers catastrophic. The KCI vector is an *additional* consequence of that compromise, not a standalone attack. Still, including the sender's public key in the HKDF salt or info would close it by construction.

**Suggested fix:** Include `sender_ed25519_public` in the HKDF salt or info: `salt = ephemeral_public || recipient_x25519_public || sender_ed25519_public`. Since the sender pubkey is inside the AEAD, a decryptor already has it before verification, but the key derivation would need it — so the sender pubkey would need to be *outside* the AEAD (as associated data or in the blob header), which changes the wire format. Alternatively, accept this as a documented limitation of v0.1 (the signature already prevents forgery without key compromise).

### 🟡 Q2. No associated data (AAD) on AEAD — ciphertext is malleable across contexts

**Type:** Design gap (protocol + crypto.rs)
**Files:** `core/src/crypto.rs:384-387` (encrypt), `core/src/crypto.rs:434-438` (decrypt)

XChaCha20-Poly1305 is used with **no associated data**: `cipher.encrypt(nonce, inner)` and `cipher.decrypt(nonce, ciphertext)`. The version byte, ephemeral public key, and nonce are all in the clear and not authenticated. An attacker who can modify the blob in transit (a malicious relay, or a network attacker without TLS) can flip the version byte or corrupt the ephemeral key without any AEAD failure — the AEAD only protects the ciphertext body.

While corrupting these fields will cause decryption/verification to fail downstream (wrong key derivation, wrong version), there's no *cryptographic binding* between the outer envelope fields and the inner ciphertext. A relay could, for example, swap the ephemeral public key from one blob with that of another (keeping the same nonce + ciphertext), and the recipient would get a decryption failure rather than an authentication failure — a distinction that matters for error handling and oracle analysis.

More importantly, the `to` field in the envelope is **not** authenticated by the AEAD. A relay can change the `to` field on a stored message, redirecting it to a different recipient. That recipient can't decrypt it (wrong key), but the *original* recipient's message is now gone from the mailbox. This is a denial-of-service vector that doesn't require breaking encryption.

**Attack scenario:** A malicious relay swaps the `to` field on Alice's message to Bob, replacing it with Charlie's pubkey. Bob never receives the message. Charlie receives garbage (can't decrypt). Neither side gets an error from the protocol.

**Exploitable in practice:** Yes — any relay can do this. However, a relay can already drop messages, so this is equivalent in impact to message loss, which is an accepted limitation.

**Suggested fix:** Include `version_byte || ephemeral_public || nonce` as AAD in the AEAD. For the envelope-level `to` field, consider including `recipient_ed25519_public` as AAD (it's already in the signed inner buffer, but AAD would make the envelope integrity-checked too). This is a wire-format change (v0x02).

### 🟡 Q3. compressed_len field is attacker-controllable and trusted for slicing

**Type:** Implementation concern (crypto.rs)
**Files:** `core/src/crypto.rs:449-459`

During decryption, `compressed_len` is read from the AEAD-decrypted inner buffer and used to slice the `compressed` region: `let compressed = &inner[100..100 + compressed_len]`. The AEAD protects the integrity of the inner buffer, so this field is authenticated — but only *after* decryption. The check `100 + compressed_len > inner.len()` prevents an out-of-bounds read, but a `compressed_len` that points into the padding region (i.e., `compressed_len < actual_compressed_data_len`) would silently feed truncated zstd data to the decompressor, which would fail. Conversely, `compressed_len > actual_compressed_len` would include padding bytes in the zstd frame, which the decompressor might or might not reject.

Since the signature is over `recipient_pub || compressed_len_bytes || compressed || padding`, the signed region includes the `compressed_len` field. A tampered `compressed_len` would break the signature. So this is actually well-protected. The concern is that the signature is verified *after* the `compressed_len` is already used for slicing — but since the slice is only used for decompression *after* signature verification (`crypto.rs:472`), this is safe.

**Verdict:** Not a bug after careful analysis — the signature covers `compressed_len` and the decompression happens after verification. Downgraded to info.

### ⚪ Q4. zstd decompression bomb window before content-size cap

**Type:** Implementation defense-in-depth (crypto.rs)
**Files:** `core/src/crypto.rs:303-322`

The decompressor caps `window_log_max(21)` (2 MiB window) and output at `MAX_PLAINTEXT_LEN + 1` (1 MiB + 1 byte). This is solid. However, a crafted zstd frame with a small window but very long output (many small blocks) could still cause significant CPU consumption before the 1 MiB + 1 byte limit triggers. The `take(MAX_PLAINTEXT_LEN + 1)` read will read one byte past the cap, forcing a full decompression attempt up to that point. This is bounded at ~1 MiB of output, so CPU is bounded too. This is fine.

### 🟡 Q5. CRIME/BREACH surface is wider than documented for profile messages

**Type:** Spec gap / design weakness (PROTOCOL.md §3)
**Files:** PROTOCOL.md §3, §4; `core/src/protocol.rs:73-91`

The spec warns about CRIME/BREACH but says "an attacker cannot make the client re-encrypt a chosen variant of a secret on demand." However, `profile` messages compress `display_name`, `bio`, and `photo` together in one zstd frame. If an attacker can influence part of the profile (e.g., the user sets their display name based on something an attacker controls, like a contact's name echoed back), and the profile is broadcast to contacts, the compressed size could leak information. The attacker would need to:

1. Influence part of the plaintext that is compressed alongside a secret
2. Observe the resulting blob size (which is bucket-padded, so only the bucket boundary leaks)

The padding buckets (256, 512, 1024, ...) are coarse enough that the leak is minimal in practice. But the spec's claim that "an attacker cannot make the client re-encrypt a chosen variant of a secret on demand" is too strong: if an attacker sends messages that cause the user to change their display name or bio (e.g., "change your name to match mine"), the re-broadcast compresses attacker-influenced text alongside the user's photo (which is base64 and thus high-entropy/incompressible). The photo being base64 limits the CRIME surface since it's already nearly random.

**Exploitable in practice:** Very unlikely given bucket padding and the difficulty of controlling what text gets compressed alongside secrets.

**Suggested fix:** Clarify in the spec that the CRIME/BREACH surface extends to profile broadcasts (where attacker-influenced text and user-controlled secrets are compressed together), not just text messages.

---

## 2. Server Implementation Bugs

### 🟠 Q6. `ackPolledMessages` is called before `doPoll` — races with concurrent sends to the same mailbox

**Type:** Implementation bug (server.knot)
**Files:** `server.knot:1258-1287` (`handlePoll`), `server.knot:1343-1351` (`ackPolledMessages`)

In `handlePoll`, the cursor-ack (`ackPolledMessages`) runs inside the setup atomic block, *before* `doPoll` collects events. If a concurrent `/messages` request arrives between the ack and the collect, the new message is appended with a fresh `receivedAt` that is strictly greater than the acked cursor — so it will be picked up by `doPoll`'s collect. This is actually correct behavior.

However, there's a subtler issue: the cursor is clamped to `max(0 (min (max t curSeq) cursor))` before the ack. If the client sends a cursor that is *ahead* of `curSeq` (e.g., from a different relay), the clamp to `max t curSeq` could *lower* the cursor, which means `ackPolledMessages` acks less than the client intended. But this is intentional (the comment explains it). 

After deeper analysis, the ordering here is actually correct — the ack happens first (deleting old messages), then the collect picks up what's left that's newer than the cursor. The race with concurrent sends is handled by STM: the new message gets a fresh `receivedAt > cursor`, so it's picked up.

**Verdict:** Not a bug after careful analysis. Downgraded to info.

### 🟡 Q7. `appendMessage` dedup is O(n) per message — quadratic under burst

**Type:** Implementation performance issue (server.knot)
**Files:** `server.knot:919-937` (`appendMessage`)

`appendMessage` checks `any (\\m -> m.toKey == toKey && m.encryptedBlob == encryptedBlob) msgs` — a full scan of `*messages` — on every call. For a batch of 100 messages to different recipients, this is 100 × |messages| comparisons. With `maxMessagesPerRecipient = 10000` and many recipients, this can be tens of thousands of comparisons per message. Under sustained throughput this is quadratic.

This is documented in the file header ("Everything is intentionally O(n) over flat lists; performance is sacrificed for clarity"), so it's a known design choice, not a security finding per se. But it creates a **DoS amplification** vector: an authenticated sender can send 100 messages per request (up to 60 requests/min = 6000/min), each triggering a full scan of the mailbox. With 10,000 messages per recipient and many recipients, each scan is O(total_messages), making the CPU cost per request proportional to the entire mailbox size.

**Attack scenario:** An attacker authenticates (free — just generate a keypair) and sends 100-message batches of junk to many recipients. Each message in the batch triggers a full `*messages` scan for dedup. With a large mailbox, this can consume significant CPU per request.

**Exploitable in practice:** Bounded by rate limits (60/min per IP) and the fact that the attacker must be authenticated. The CPU amplification is real but modest.

**Suggested fix:** Index `*messages` by `(toKey, encryptedBlob)` or use a hash-based dedup set.

### 🟠 Q8. `maxMessagesPerRecipient` eviction destroys genuine mail under flood

**Type:** Design gap (server.knot)
**Files:** `server.knot:156-182`, `server.knot:926-937`

This is documented in the code comments as a "trade, not a fix," but it constitutes a real attack: an authenticated sender (pubkeys are free to mint) can flood a recipient's mailbox with 10,000 junk messages, pushing out all genuine undelivered messages. The recipient's client only sees junk. The comment says "at least the newest messages always land" — but the newest messages are the *attacker's junk*, not the genuine messages that were already queued.

The `MAX_POLL_TOTAL_BYTES` client-side budget (64 MiB) means the client processes a bounded amount per poll, but the server has already destroyed the genuine messages by eviction. The client never sees them.

**Attack scenario:** 
1. Victim is offline for a day. Attacker sends 10,000 messages to victim's pubkey.
2. Each message is a valid encrypted blob (attacker generates a keypair and encrypts real messages to the victim — they don't need to be decryptable by the victim, just valid blobs).
3. Victim comes online, polls, and gets a page of junk. Their genuine messages were evicted.

**Exploitable in practice:** Yes — the attacker needs to be authenticated (free) and send 10,000 messages. At 60 requests/min × 100 messages = 6,000/min, this takes ~2 minutes. The rate limit is per-IP, so the attacker needs multiple IPs or time.

**Suggested fix:** This is an accepted design tradeoff in the current implementation. A real fix requires per-sender quotas or pricing. Document it in PROTOCOL.md §10 as a DoS vector, not just a capacity concern.

### 🟡 Q9. `capForwards` evicts by retry count, not by age — fresh forwards can be dropped

**Type:** Implementation bug (server.knot)
**Files:** `server.knot:515-522` (`capForwards`), `server.knot:109-110` (`maxForwardsTotal`)

`capForwards` keeps the lowest-retry entries (`take maxForwardsTotal (sortBy (\\f -> f.retries) fwds)`). When the outbox exceeds `maxForwardsTotal = 50000`, the *highest-retry* entries are dropped. The comment says these are "closest to `maxForwardRetries` (about to be abandoned anyway)."

But there's a subtle issue: a fresh forward (retries: 0) for a *healthy* peer could be dropped if the outbox is full of fresh forwards (all retries: 0) for *failing* peers. The sort is by `retries` only, not by `retries` then by age or destination health. When many entries share `retries: 0`, the `sortBy` is unstable (Knot's sort may not be stable), so *any* retries-0 entry could be dropped — including one for a healthy peer that would have succeeded on the first try.

**Attack scenario:** An attacker floods the forwards outbox by gossipping many fake "online" events, causing `forwardQueuedToServer` to stage forwards for many fake servers. Each fails and increments retries. When `maxForwardsTotal` is reached, genuine forwards for healthy peers may be evicted alongside the junk.

**Exploitable in practice:** Requires federation to be enabled and the attacker to be able to reach `/federation/gossip`. The genuine forward would be re-staged on the next presence announce, so the impact is a delivery delay, not permanent loss.

**Suggested fix:** Sort by `(retries, age)` or skip entries for peers in backoff before capping.

### 🟡 Q10. `genToken` entropy is 4 bits per call — collision-resistant but timing-leaky

**Type:** Implementation concern (server.knot)
**Files:** `server.knot:532-537`

`genToken` generates one hex character per recursive call, drawing from `randomInt 16`. Each call to `randomInt` produces 4 bits. For 48 chars (192 bits), this is 48 calls to `randomInt`. The concern is that `randomInt` on the Knot runtime may not be a CSPRNG — the function signature is `IO {random}` which suggests a runtime-provided random source, but the implementation is not visible here.

If `randomInt` uses a non-cryptographic PRNG (e.g., a LCG), the 192-bit tokens would be predictable. The auth challenge tokens and session tokens both use `genToken`. If predictable, an attacker could predict future session tokens after observing some.

**Exploitable in practice:** Depends on the Knot runtime's `randomInt` implementation, which is not in this codebase. If it uses `/dev/urandom` or equivalent, this is fine. If it uses a userspace PRNG seeded from a low-entropy source, this is critical.

**Suggested fix:** Verify that the Knot runtime's `randomInt` uses a CSPRNG. Document the assumption.

### 🟡 Q11. `handleVerifyAuth` challenge lookup is O(n) — timing varies with challenge pool size

**Type:** Implementation concern (server.knot)
**Files:** `server.knot:1210-1214`

The challenge verification does `any (\\c -> same c && c.expiresAt > t && matchIp clientIp c.ip) ch` — a linear scan of `*challenges`. With `maxChallenges = 10000`, this is up to 10,000 comparisons per verify. The timing varies with the position of the matching challenge in the list, which could be observable.

Combined with the already-documented token comparison timing side-channel (finding B), this adds another timing channel: the time to find the matching challenge leaks its position in the list, which leaks when it was inserted (roughly when the `/auth/challenge` was called).

**Exploitable in practice:** Very low impact — the challenge is consumed immediately after verification, and the timing difference is small relative to network jitter.

**Suggested fix:** Index challenges by `(pubkey, challenge)` for O(1) lookup.

### 🟡 Q12. `handleVerifyAuth` computes signature verification outside atomic — TOCTOU on challenge

**Type:** Implementation gap (server.knot)
**Files:** `server.knot:1196-1214`

The `sigValid` computation is done outside the atomic block (line 1204-1209), but the challenge lookup is inside the atomic (line 1213). Between computing `sigValid` and the atomic block, the challenge could be consumed by a concurrent `/auth/verify` with the same challenge. But the atomic block re-checks: `any (\\c -> same c && ... && c.expiresAt > t && matchIp clientIp c.ip) ch && sigValid`. The `sigValid` is pre-computed, so the check is: challenge exists AND signature is valid. If the challenge is consumed between the pre-compute and the atomic, the `any` returns false, and the verify fails. This is safe — no TOCTOU.

But there's a subtler issue: the `clientIp` for the challenge (set at `/auth/challenge` time) and the `clientIp` for the verify (set at `/auth/verify` time) must match (`matchIp clientIp c.ip`). If the client's IP changes between challenge and verify (mobile network change), the verify fails. This is documented as expected behavior. But if `trustForwardedFor` is true and the client can spoof `X-Forwarded-For`, they could set a different IP on the challenge and verify requests — but they'd need to match, so they'd just set the same spoofed IP on both. This is already documented (finding 8).

**Verdict:** Not a new bug. The pre-compute is safe because the atomic block re-validates the challenge's existence.

### 🟠 Q13. `revokeOthers` race — concurrent sessions for same pubkey can race on revoke

**Type:** Implementation bug (server.knot)
**Files:** `server.knot:1219-1231`

When `revokeOthers: true`, the handler does:
```
let pruned = if revokeOthers
then filter (\\s -> s.pubkey != pubkey) ses
else capPerKey ses pubkey maxSessionsPerKey
```

This drops *all* other sessions for this pubkey. But if a concurrent `/auth/verify` for the same pubkey is in flight (without `revokeOthers`), it could install a new session between the `filter` and the `union`:

1. Verify A (revokeOthers=true) reads `*sessions`, filters out all pubkey sessions → `pruned`
2. Verify B (revokeOthers=false) reads `*sessions` (still has the old sessions), adds a new one → commits
3. Verify A commits `pruned + newSession` → Verify B's session is lost

But wait — both are inside `atomic` blocks, and STM guarantees serializability. If Verify A's atomic block retries after Verify B commits, Verify A re-reads `*sessions` (now including B's session) and re-applies the filter — so B's session would be dropped. This is actually the *intended* behavior of `revokeOthers`: it should drop all other sessions. The "race" is really just STM serializing correctly.

**Verdict:** Not a bug. STM handles this correctly. Downgraded to info.

### 🟡 Q14. `pruneExpired` presence offline gossip may miss peers that expired in a prior sweep

**Type:** Implementation concern (server.knot)
**Files:** `server.knot:1614-1633` (`backgroundPrune`)

The prune loop snapshots peers *before* the sweep (`prePeers`) and unions with *post-sweep* peers. But `pruneExpired` returns only locally-expired keys that have no other live local session. If a key expired in a *previous* sweep (and was already removed from `*presence`), the current sweep has nothing to return for it. The offline gossip for that key was already sent in the previous sweep. This is correct — each key gets exactly one offline event.

**Verdict:** Not a bug. The pre/post union handles the edge case correctly.

### 🟡 Q15. `forwardQueuedToServer` budget check reads `*forwards` count but doesn't reserve atomically

**Type:** Implementation concern (server.knot)
**Files:** `server.knot:1140-1151`

`forwardQueuedToServer` computes `budget = max 0 (maxForwardsPerServer - existing)` where `existing = countWhere (\\f -> f.toServer == server) fwds`, then takes `take budget` candidates and unions them into `*forwards`. The whole thing is inside one `atomic` block, so it's serializable — two concurrent calls would serialize, and the second would see the first's additions. This is correct.

**Verdict:** Not a bug. STM handles concurrency correctly.

---

## 3. Client Core Logic Bugs

### 🟠 Q16. `ingest_poll` cursor clamping uses `now_ms() + 60_000` — relay can advance cursor beyond actual messages

**Type:** Implementation concern (app.rs)
**Files:** `core/src/app.rs:1967-1975`

The cursor is clamped to `page.cursor.min(now_ms().saturating_add(60_000))`. If a hostile relay sends `cursor = now_ms() + 59_000`, the client accepts it, writes it to disk, and the next poll sends this cursor to the relay. If the client later switches to a *different* relay, the cursor is reset to 0 (line 868) — so this is per-relay and not cross-relay. But on the *same* relay, a hostile relay can send an artificially high cursor, causing the client to ack (delete) all messages up to that cursor on the next poll — even messages the client hasn't seen yet.

Wait — the cursor is what the *client* sends to the *server*. The server uses it to ack (delete) messages ≤ cursor. If a relay sends a high cursor in the poll response, the client adopts it and sends it back on the next poll. The relay then deletes everything ≤ that cursor. If there were messages the client never received (because the relay withheld them), they're now permanently lost.

But the relay already controls what messages it sends to the client — it could simply withhold messages and never show them. The cursor doesn't give the relay any new power it doesn't already have. The relay can always just not send events. So this is not a new attack vector.

However, there's a subtler issue: the cursor is persisted to disk. If the relay sends a high cursor and the client adopts it, then the client reconnects to the same relay after a network interruption, the cursor is still high. Any messages that arrived at the relay during the interruption (with `receivedAt` ≤ the poisoned cursor) are automatically acked and deleted.

**Attack scenario:** A malicious relay sends `cursor = now_ms() + 59000` in an empty poll response. The client adopts it and persists it. Later, legitimate messages arrive at the relay with `receivedAt` values below the poisoned cursor. The client's next poll sends the poisoned cursor, and the relay deletes those messages.

But wait — the relay assigns `receivedAt` using its own monotonic sequence. If the relay is malicious, it can just not deliver messages. If it's honest but was briefly compromised, the poisoned cursor could cause message loss after recovery. This is a real concern for the "briefly compromised relay" scenario.

**Exploitable in practice:** A compromised relay can cause permanent message loss for messages that arrive during the compromise window. The 60-second clamp limits the window, but the cursor persists across reconnections.

**Suggested fix:** Only adopt the cursor if the poll response contained events. If `events` is empty and `cursor > model.cursor`, don't advance the cursor — the relay has nothing to tell us, and a cursor advance from an empty page is suspicious.

### 🟡 Q17. Delivery ack staleness check uses `ts` not `last_ack_ts` watermark for ordering — race with clock skew

**Type:** Implementation concern (app.rs)
**Files:** `core/src/app.rs:2116-2134`

The ack staleness check compares `ts < c.last_ack_ts`. If two acks arrive in the same poll page from the same sender, with `ts_A = 100` and `ts_B = 200`, and `last_ack_ts = 50`:
- Ack A (ts=100): not stale (100 >= 50), applies, sets `last_ack_ts = min(100, now)`
- Ack B (ts=200): not stale (200 >= 100), applies, sets `last_ack_ts = min(200, now)`

This is correct. But if the page order is reversed (B before A), and `last_ack_ts = 50`:
- Ack B (ts=200): not stale, applies, sets `last_ack_ts = min(200, now)`
- Ack A (ts=100): stale (100 < min(200, now)), dropped!

This means an older ack in the same page as a newer one is dropped if it's processed after the newer one. Since the events are processed in page order (not sorted), a relay could reorder events to cause an older ack to be dropped. The impact is minimal — the older ack would have acked fewer or the same messages.

**Exploitable in practice:** A malicious relay could reorder events to suppress a specific ack, but it could also just drop the event entirely. Low impact.

**Suggested fix:** Process acks in `ts` order within a page, or collect all acks from a sender and apply the highest-ts one.

### 🟡 Q18. `seen_ids` dedup set is built lazily from conversation — misses messages trimmed by `MAX_MESSAGES_PER_PEER`

**Type:** Implementation bug (app.rs)
**Files:** `core/src/app.rs:2086-2092`

The dedup set is built from the current conversation: `convo.iter().map(|m| m.id.clone()).collect()`. But `trim_history` may have aged out older messages (keeping only the most recent 1000). A replayed message whose `id` matches an aged-out message would pass the dedup check and be re-inserted into the conversation. The message would appear as a new message (with its original `ts`), potentially at the top of the conversation list if `ts` is high.

**Attack scenario:** An attacker captures a message blob (by being a relay, or by gossip redirect), waits until the recipient's conversation has been trimmed past that message (1000+ messages later), then replays the blob. The dedup check misses it (the `id` is no longer in the trimmed conversation), and the message is re-inserted. The message appears as a new old-dated message.

**Exploitable in practice:** Requires the attacker to have captured the blob and to wait for 1000+ messages. The replayed message would be inserted at its original `ts` position, so it wouldn't appear at the bottom of the chat — it would appear in its chronological position. The user might not notice. The impact is minimal — it's an old message reappearing, not new content.

**Suggested fix:** Maintain a persistent dedup set (not derived from the trimmed conversation), or store the set of seen IDs separately from the message history.

### 🟡 Q19. Profile `ts` staleness check uses `>=` — equal-timestamp replay overwrites with identical content (harmless) but also overwrites with *different* content if sender crafts it

**Type:** Implementation concern (app.rs)
**Files:** `core/src/app.rs:2174-2179`

The profile staleness check uses `ts >= c.last_profile_ts`, meaning a replayed profile at the *same* `ts` is accepted. The comment says "a replayed profile at the same `ts` overwrites with identical content, which is a no-op in practice." But this assumes the replayed blob has the same content. An attacker who captures a profile blob can modify the *inner* content (display_name, bio, photo) and re-encrypt it with the same `ts` — but they'd need to sign it, and they can only sign with their own key. The recipient would see it coming from the same sender (the original profile sender), but the signature would be from the original sender's key... wait, no. The attacker can't re-sign with the original sender's key unless they have it.

Actually, the attacker *replays the exact same blob* — same ciphertext, same inner content, same signature. The `ts` is the same, and the content is the same. So it's truly a no-op. The attacker can't modify the content without breaking the signature. This is safe.

**Verdict:** Not a bug. The `>=` is correct and the replay is a true no-op.

### 🟡 Q20. `flush_next` batch-building skips items for different recipients — outbox may have interleaved items stuck behind a large batch

**Type:** Implementation concern (app.rs)
**Files:** `core/src/app.rs:1818-1853`

The batch stops at the first recipient change (`if recipient.as_ref().is_some_and(|r| r != &item.recipient) { break }`). If the outbox has items for recipient A followed by items for recipient B, and A's batch is being built, B's items wait. This is by design (FIFO fairness). But if A's send fails repeatedly, B's items are stuck behind A's retries. The `retry_batch` function charges retries and eventually drops A's items (after `MAX_OUTBOX_RETRIES` or `OUTBOX_TTL_MS`), unblocking B.

This is correct behavior, not a bug. The FIFO ordering ensures fairness at the cost of head-of-line blocking, which is the right tradeoff for a messaging app (you don't want a failed send to one peer to reorder sends to another).

**Verdict:** Not a bug. Downgraded to info.

### 🟡 Q21. `encrypt_for` uses `OsRng` — no deterministic test path, but also no RNG failure handling

**Type:** Implementation concern (app.rs)
**Files:** `core/src/app.rs:2227-2231`

`encrypt_for` uses `let mut rng = rand_core::OsRng;` and passes it to `crypto::encrypt`. If `OsRng` fails (e.g., the OS entropy pool is exhausted on a freshly booted device), `rng.fill_bytes` would panic or return an error. `crypto::encrypt` calls `rng.fill_bytes` in multiple places (`eph_priv`, `padding`, `nonce`), and these would propagate the error up as `CryptoError::Encrypt` (since `fill_bytes` on `OsRng` infallibly fills — it uses `/dev/urandom` which never blocks on modern systems).

**Verdict:** `OsRng` is infallible on iOS/macOS (it uses `SecRandomCopyBytes` which always succeeds). Not a bug.

---

## 4. Wire Format / Parsing Issues

### 🟠 Q22. `isValidHex` uses `chars` (set semantics) — deduplication hides length-based attacks

**Type:** Implementation bug (server.knot)
**Files:** `server.knot:542-545`

```knot
isValidHex = \s ->
  let n = length s in
  n > 0 && n / 2 * 2 == n && all (\c -> contains c "0123456789abcdef") (chars s)
```

`chars s` returns the **distinct** character set (relations dedupe). So for a string like `"aaaa"`, `chars` returns `{"a"}`, and the `all` check passes. The `length` check (`n / 2 * 2 == n`) ensures even length. But `chars` deduplication means the `all` check is O(distinct chars) not O(string length), which is a performance optimization, not a correctness issue — the set membership test covers all characters.

This is actually correct: if all *distinct* characters are in the hex alphabet, then all characters are in the hex alphabet. The dedup just makes it faster.

**Verdict:** Not a bug. The set semantics are correct for membership checking.

### 🟡 Q23. `PubkeyHex` type accepts non-curve-point 32-byte hex values at the route boundary

**Type:** Implementation gap (server.knot)
**Files:** `server.knot:322` (`type PubkeyHex = Text where isValidExactHex 64`)

The `PubkeyHex` type only checks that the string is 64 lowercase hex characters — it doesn't verify the decoded bytes form a valid Ed25519 public key (a valid curve point). The client's `try_parse_pubkey` (`phonemic.rs:140-144`) does check this via `VerifyingKey::from_bytes`, but the server accepts any 64-hex-char string as a valid `PubkeyHex`.

This means a client can send a message to a `to` address that is 32 bytes of hex but not a valid Ed25519 public key. The server stores and forwards the blob. The "recipient" can never decrypt it because `ed25519_pk_to_x25519` would fail on the invalid key. The blob sits in the mailbox until TTL expiry, consuming storage.

**Attack scenario:** An attacker sends 100 messages per batch to invalid pubkeys. Each is stored for 30 days. With 60 requests/min × 100 = 6000/min, after 1 hour that's 360,000 junk messages. Each counts against `maxMessagesPerRecipient` for the target — but the target is a non-existent key, so nobody is affected. The real concern is storage consumption: 360,000 × minBlobLen bytes = ~62 MB per hour per attacker IP.

**Exploitable in practice:** The rate limit (60/min per IP) bounds the rate. The 30-day TTL bounds the total. `maxMessagesPerRecipient = 10000` per non-existent key limits per-key. The total storage impact is bounded.

**Suggested fix:** The server could optionally validate that `to` is a valid curve point, but this adds CPU cost and the spec doesn't require it (the server can't decrypt anyway). Document as accepted.

### 🟡 Q24. `parse_payload` `ts` field defaults to 0 when missing — allows pre-epoch ordering manipulation

**Type:** Implementation concern (protocol.rs)
**Files:** `core/src/protocol.rs:100`

`let ts = v.get("ts").and_then(|t| t.as_i64()).unwrap_or(0);`

If a peer omits the `ts` field (or sets it to a non-integer), it defaults to 0. In `ingest_poll`, `ts` is clamped: `parsed.ts.max(0).min(now.saturating_add(MAX_FUTURE_SKEW_MS))`. A `ts` of 0 passes the `max(0)` check and is used as-is. A message with `ts = 0` would be inserted at position 0 in the conversation (earliest), and `trim_history` would age it out first. This is harmless.

But a peer could set `ts` to a very large negative number (e.g., `i64::MIN`), which would be clamped to 0. Same result. Or a peer could set `ts` to a float (e.g., `1.5`), which `as_i64()` returns `None` for, defaulting to 0. All of these are harmless because the clamping handles them.

**Verdict:** Not a bug. The clamping in `ingest_poll` handles all edge cases.

### 🟡 Q25. JSON parsing of poll response uses `unwrap_or_default()` — malformed JSON silently produces empty page

**Type:** Implementation concern (app.rs)
**Files:** `core/src/app.rs:1309`

`let parsed: PollResp = serde_json::from_slice(&bytes).unwrap_or_default();`

If the relay sends malformed JSON (or a valid JSON with wrong types), this silently defaults to an empty `PollResp` (empty events, cursor 0). The cursor of 0 would be adopted (clamped), and the next poll would re-fetch from the beginning — re-receiving all messages the client has already seen. The client's dedup (by `id` for text, by `ts` for acks and profiles) would handle the duplicates, but it wastes bandwidth and CPU.

A hostile relay could exploit this by sending malformed JSON instead of a real response, forcing the client to re-poll from cursor 0 repeatedly. But the client would just re-process old messages (all deduped) and eventually get the real cursor from a subsequent response. The impact is wasted bandwidth, not data loss.

**Suggested fix:** If JSON parsing fails, don't adopt the cursor and back off instead of treating it as an empty page.

### 🟡 Q26. `delivery.ack` ack_ids filtering silently drops non-string entries — count vs. filtered count mismatch

**Type:** Implementation concern (protocol.rs)
**Files:** `core/src/protocol.rs:116-126`

The ack_ids parsing filters non-string entries: `raw.iter().filter_map(|x| x.as_str().map(str::to_string)).collect()`. The raw count check (`raw.len() > MAX_ACK_IDS`) happens before filtering, but the post-filter check (`ack_ids.len() > MAX_ACK_IDS`) also happens. However, between the two checks, a peer could pack an array with `MAX_ACK_IDS` entries, some of which are non-strings (e.g., numbers). The raw check passes (`MAX_ACK_IDS` entries), the filter drops some, and the post-check passes (fewer than `MAX_ACK_IDS` strings). This is correct — the filtered count is what matters.

But there's a subtlety: a peer could pack `MAX_ACK_IDS + 1` raw entries, all non-strings. The raw check fails (`MAX_ACK_IDS + 1 > MAX_ACK_IDS`), and the payload is dropped. But if the peer packs `MAX_ACK_IDS` raw entries, all non-strings, the raw check passes, the filter drops all of them, and `ack_ids` is empty. The empty ack is then sent to the sender, who processes it (marking nothing as delivered). This is harmless.

**Verdict:** Not a bug. The double-check handles this correctly.

---

## 5. Federation Protocol Issues

### 🟠 Q27. Gossip amplification — single `online` event triggers forward of *all* queued messages for a key

**Type:** Design gap (server.knot)
**Files:** `server.knot:1522-1556` (`handleRecvGossip`)

When a `online` event arrives for a key, `forwardQueuedToServer` sweeps the entire mailbox for messages to that key and stages them for forwarding. An attacker can send a single gossip request with 100 `online` events for 100 different keys, each triggering a full mailbox scan and forward staging. This is O(100 × |messages|) per request.

More importantly, the attacker can repeatedly send `online` events for the same key. Each time, `forwardQueuedToServer` checks `notYetForwarded` and `notYetDelivered` to avoid duplicates, so re-sending the same event is a no-op for already-forwarded messages. But if the forward failed (404 from the attacker's own server, which doesn't actually have the key online), the forward entry stays in `*forwards` with `retries: 0`. A re-announce doesn't re-stage it (it's already in `*forwards`), but `retryPendingForwards` will retry it on the next sweep.

The amplification is: one gossip request (100 events) → 100 mailbox scans + potentially 100 forward entries. Each forward entry triggers an HTTP POST to the `fromServer`. If the `fromServer` is the attacker, they receive 100 forwarded blobs — each a copy of the victim's ciphertext. This is the same as the documented gossip-redirect attack (#2), but the amplification factor (100 events per request) is not documented.

**Exploitable in practice:** Same as finding #2, but with 100× amplification per request. The rate limit (60/min per IP) bounds the rate to 6,000 redirected keys per minute per IP.

**Suggested fix:** Document the amplification factor. Consider limiting the number of newly-online keys per gossip batch that trigger forwards.

### 🟡 Q28. Federation `offline` events don't trigger cleanup of pending forwards

**Type:** Design gap (server.knot)
**Files:** `server.knot:1535-1541`

When an `offline` event is received, the presence row for that `(pubkey, fromServer)` is removed, but pending forwards to that server are *not* cancelled. The forwards stay in `*forwards` and will be retried by `retryPendingForwards` until they either succeed (unlikely — the key is offline at that server), fail 10 times, or the message TTL expires.

If the offline event was legitimate (the key actually went offline at that server), the forwards will waste retry attempts for up to `retryBackoffMax × maxForwardRetries` = 8 min × 10 = 80 minutes. During that time, the forwards occupy slots in `maxForwardsPerServer` and `maxForwardsTotal`.

If the offline event was spoofed by an attacker (to clear a presence row), the forwards are still retried — and if the key is actually still online at that server, the forward succeeds on retry (the `no_presence` gate would pass because the key has a local session). But the presence row was removed, so `hasLocalPresence` at the peer would fail... wait, the presence row is on *our* side. The peer's presence is independent. The forward goes to the peer, and the peer checks its own local presence. If the key is still online at the peer, the forward succeeds. If not, it gets 404 and is retried.

**Exploitable in practice:** An attacker can send fake `offline` events to clear presence rows, but the forwards continue independently. The impact is minimal — presence rows and forwards are decoupled.

**Suggested fix:** When processing an `offline` event, optionally drop pending forwards to that server for the offline key (they'll never succeed if the key is truly offline there). But this could cause message loss if the offline event is spoofed. Better to leave as-is.

### 🟡 Q29. `fromServer` in gossip events is not verified against the connecting peer's actual address

**Type:** Design gap (server.knot)
**Files:** `server.knot:1511-1556` (`handleRecvGossip`)

The `fromServer` field is a `ServerName` (validated for format), but it's not verified against the actual IP address of the connecting peer. An attacker can connect from IP `1.2.3.4` and claim `fromServer: "legit-relay.example.com"`. The server writes presence rows with `server: "legit-relay.example.com"` and forwards queued messages there. This is the same as the documented gossip-redirect attack (#2), but with a twist: the attacker can claim to *be* a legitimate relay, poisoning the presence table with the legitimate relay's hostname.

When the *real* `legit-relay.example.com` later gossips, its events update the presence rows. But the attacker's rows may still be present (different `expiresAt`), and the server has multiple presence rows for the same key on different servers — which is by design. The attacker's row points to `legit-relay.example.com`, so forwards go to the legitimate relay, which doesn't have the key online — and returns 404. The legitimate relay gets junk forward requests.

**Exploitable in practice:** This is a variant of the documented gossip-redirect, but with the attacker impersonating a legitimate relay. The legitimate relay receives spurious forward requests (bounded by `forwardRateLimit`).

**Suggested fix:** Verify that the connecting peer's IP resolves to the claimed `fromServer` hostname (reverse DNS + forward DNS). This is the standard check for SMTP-like protocols. Blocked on `fetch` not exposing DNS.

---

## 6. Rate Limiting / DoS Vectors

### 🟠 Q30. `/auth/challenge` has no per-pubkey rate limit beyond `maxChallengesPerKey = 5`

**Type:** Design gap (server.knot)
**Files:** `server.knot:1166-1188` (`handleChallenge`)

The challenge pool is globally capped at `maxChallenges = 10000` and per-key at `maxChallengesPerKey = 5`, with per-IP rate limiting at `authRateLimit = 60/min`. An attacker with many IPs (or behind a proxy with XFF spoofing when `trustForwardedFor = true`) can fill the challenge pool with challenges for random pubkeys. Each challenge is 60 seconds, and the pool LRU-evicts. But 10,000 challenges × 60 seconds means the pool is always full, and legitimate challenges are evicted.

The comment says this is handled by LRU eviction: "an abandoned challenge may be dropped before its 60 s window elapses, which costs the affected client one retry." So the attacker can cause clients to retry their challenge/verify flow, adding latency but not blocking authentication.

**Exploitable in practice:** With XFF spoofing (finding 8), the attacker gets unlimited rate-limit buckets. 60/min per IP × many IPs = thousands of challenges per minute. The pool (10,000) fills in ~3 minutes. After that, legitimate challenges are evicted, and clients must retry. This is a soft DoS — authentication still works but with extra latency.

**Suggested fix:** Add a global rate on challenge creation (not just per-IP). Or cap the challenge creation rate per second regardless of source.

### 🟡 Q31. `/messages` batch of 100 × 40 MiB would be rejected by body cap, but the rate limit counts requests not messages

**Type:** Design gap (server.knot)
**Files:** `server.knot:233-234` (`sendRateLimit`), `server.knot:454` (`sendLimit`)

The send rate limit is 60 requests/min per IP. Each request can carry up to 100 messages (bounded by the body cap). So the effective message rate is 60 × (body_cap / avg_blob_size) per minute. With a 42 MiB body cap and 42 KiB blobs, that's ~1000 messages per request × 60 = 60,000 messages/min. With 173-byte minimum blobs, it's ~251,000 messages/min per IP.

This is documented in the code comment ("the effective message ceiling is higher"), but it means the per-IP rate limit is much less protective than it appears. An attacker with 10 IPs can send millions of messages per minute.

**Exploitable in practice:** Bounded by the body cap (42 MiB) and the rate limit (60/min). The total data rate per IP is ~42 MiB × 60 = 2.5 GiB/min, which is significant.

**Suggested fix:** Consider a per-message rate limit in addition to the per-request rate limit. Or reduce `maxBatchSize` for unauthenticated senders (but all senders are "authenticated" — they just have free keypairs).

### 🟡 Q32. `maxSessions = 10000` LRU eviction is Sybil-floodable — documented but not in PROTOCOL.md §10

**Type:** Design gap (server.knot)
**Files:** `server.knot:117-126`

The code comment documents this: "global LRU eviction is Sybil-floodable: an attacker with enough IPs can evict live users' sessions." But it's not mentioned in PROTOCOL.md §10 as a DoS vector. An attacker with enough IPs can:
1. Generate 10,000 keypairs
2. Authenticate each one (60/min per IP, so ~167 IPs needed for one batch)
3. Fill the session pool
4. Legitimate users' sessions are evicted (they get 401 and must re-authenticate)

This is a soft DoS — users re-authenticate automatically. But it adds latency and load.

**Suggested fix:** Document in PROTOCOL.md §10. Consider per-IP session caps (rejected in the code comment as "collapses without XFF, punishes carrier-NAT") or a global session creation rate limit.

### 🟡 Q33. `maxPresence = 100000` — gossip can fill presence table with fake keys

**Type:** Design gap (server.knot)
**Files:** `server.knot:139-155`

An attacker can send gossip with 100 fake `online` events per request (60/min per IP). Each event adds a presence row. With `maxPresencePerServer = 5000` per peer, a single attacker IP can add 5000 rows. With `maxPresence = 100000` globally, it takes 20 distinct attacker hostnames to fill the pool. Once full, legitimate presence rows are evicted by `capList` (LRU by `expiresAt`).

Since gossip rows have `onlineGossipTtl = 90 min` and local rows have `sessionExpiry = 60 min`, local rows are evicted first (they expire sooner). The code handles this by exempting local rows from the cap:

```
let localRows = filter (\\p -> isLocalServer p.server) merged
let remoteRows = filter (\\p -> not isLocalServer p.server) merged
*presence = union localRows (capList (capPerServer remoteRows from maxPresencePerServer) maxPresence)
```

So local rows are always kept, and only remote (gossiped) rows are capped. An attacker can fill the remote pool, but local users' presence is never evicted. The impact is that legitimate *remote* presence (from honest peers) is evicted, causing forwards to those peers to fail.

**Exploitable in practice:** Requires federation to be enabled and many distinct attacker hostnames (each passing `isBadServerName`). Bounded by `maxPresencePerServer = 5000` per hostname.

**Suggested fix:** Document in PROTOCOL.md §10. Consider a per-request limit on newly-added presence rows (currently capped at `maxGossipEvents = 100` per request, which is already a bound).

---

## 7. Authentication / Session Management

### 🟠 Q34. Session token is not bound to the pubkey — token theft grants full impersonation

**Type:** Design gap (server.knot)
**Files:** `server.knot:356` (`type Session = {token: Text, pubkey: PubkeyHex, expiresAt: Timestamp, ip: Text}`)

The session token is a bearer token — anyone who has it can use it. It's bound to `(pubkey, ip, expiry)`, but the `pubkey` binding is only used for *authorization* (e.g., rejecting self-sends), not for *authenticating the request*. The `authedPubkey` function looks up the token and returns the associated pubkey — it doesn't verify that the requester is the same entity that originally authenticated.

If an attacker steals a bearer token (e.g., from a compromised proxy's access log), they can use it from the same IP (or any IP if `trustForwardedFor = false` or IP binding is disabled) to poll the victim's mailbox and send messages as the victim.

The IP binding (`matchIp`) is the only thing preventing token replay from a different IP. But:
- If `trustForwardedFor = false`, IP binding is disabled (empty IP → wildcard).
- If the attacker is behind the same NAT/proxy as the victim, they share the IP.
- The token is sent in `Authorization: Bearer ***` over HTTP (TLS in production), so it's only protected by TLS.

**Attack scenario:** A compromised proxy logs the `Authorization` header. The attacker uses the token from the same IP (or any IP if XFF is off) to poll the victim's mailbox and read their (encrypted) messages. The attacker can also send messages as the victim.

**Exploitable in practice:** Requires token theft (compromised proxy, log exposure, or MITM without TLS). The E2E encryption means the attacker can't read message content, but they can send messages as the victim (the server doesn't verify the sender's identity on `/messages` — it only uses the bearer token's pubkey for self-send rejection).

**Suggested fix:** This is inherent to bearer-token auth. The spec should document that a stolen bearer token grants full impersonation (modulo IP binding) until it expires (1 hour). Consider shorter token lifetimes or per-request signing.

### 🟡 Q35. `revokeOthers: true` doesn't revoke challenges — stale challenge can be used to create a new session after revocation

**Type:** Implementation gap (server.knot)
**Files:** `server.knot:1217-1221`

When `revokeOthers: true`, the handler drops all other sessions for the pubkey, but it does *not* drop outstanding challenges for the pubkey. A challenge issued before the `revokeOthers` call is still valid for 60 seconds. An attacker who captured a challenge (e.g., by observing the `/auth/challenge` response) can still complete the `/auth/verify` flow and get a new session — after the `revokeOthers` call.

But wait — the `/auth/verify` handler also checks the challenge's IP binding (`matchIp clientIp c.ip`). If the attacker is on a different IP, the verify fails. If they're on the same IP (NAT/proxy), it succeeds. And the new session is *not* revoked by the `revokeOthers` call (it was made after the call).

**Attack scenario:** 
1. Alice requests a challenge (IP 1.2.3.4)
2. Attacker captures the challenge response (from a compromised proxy)
3. Alice calls `/auth/verify` with `revokeOthers: true` (to log out other devices)
4. Attacker uses the captured challenge to call `/auth/verify` from IP 1.2.3.4 (same NAT)
5. Attacker gets a new session — not revoked by step 3

**Exploitable in practice:** Requires the attacker to be on the same IP as the victim and to have captured the challenge. The 60-second challenge expiry limits the window.

**Suggested fix:** When `revokeOthers: true`, also drop outstanding challenges for the pubkey.

### 🟡 Q36. Challenge IP binding uses `clientIpOf` which reads XFF — same spoofing surface as session IP binding

**Type:** Implementation gap (server.knot)
**Files:** `server.knot:1180-1188` (`handleChallenge`), `server.knot:781-784` (`clientIpOf`)

The challenge's `ip` is set to `clientIpOf xForwardedFor`, which is the last XFF hop when `trustForwardedFor` is true. If the attacker can spoof XFF (finding 8), they can set any IP on the challenge, and then use the same spoofed IP on the verify — bypassing the IP binding entirely.

This is the same XFF spoofing issue already documented (finding 8), but it applies to the challenge IP binding as well. The challenge IP binding is supposed to prevent a challenge obtained by a relay from being used by a different client — but with XFF spoofing, this protection is nullified.

**Verdict:** Same as finding 8. Not a new issue, but the challenge IP binding is an additional affected surface.

### 🟡 Q37. No rate limit on `/auth/verify` failures — unlimited signature verification attempts

**Type:** Design gap (server.knot)
**Files:** `server.knot:475` (`authLimit = 60/min`)

The `/auth/verify` route shares the `authLimit` (60/min per IP) with `/auth/challenge`. An attacker can attempt 60 signature verifications per minute per IP. Each verification is an Ed25519 signature check, which is relatively expensive (~0.1ms). 60/min = ~0.01 CPU-seconds/min — negligible.

But the attacker doesn't need to *succeed* at verification to cause work. Each `/auth/verify` call triggers:
1. Hex decode of pubkey (32 bytes) and signature (64 bytes)
2. Ed25519 signature verification (expensive: ~0.1ms)
3. Linear scan of `*challenges` (up to 10,000 entries)

The challenge scan only happens if the signature is valid (short-circuit), so a failed signature still costs the Ed25519 verification. With 60/min per IP and many IPs, the attacker can cause non-trivial CPU load.

**Exploitable in practice:** Bounded by rate limits. The Ed25519 verification is fast. Not a practical DoS vector.

**Suggested fix:** Consider returning 401 immediately if no matching challenge exists (before verifying the signature), to save the expensive verification when the challenge is invalid. Currently the order is: check challenge exists AND signature valid, with `sigValid` pre-computed. If the challenge doesn't exist, the `any` short-circuits and `sigValid` is never used — but `sigValid` was already computed outside the atomic. So the CPU cost is paid regardless. Move the signature verification inside the atomic block, after the challenge existence check, to short-circuit on missing challenges.

Wait, actually looking at the code more carefully:

```knot
let sigValid = case bytesFromHex pubkey of ...  -- computed OUTSIDE atomic
result <- atomic (do
  ...
  let valid = any (\\c -> same c && ...) ch && sigValid  -- sigValid used here
```

`sigValid` is pre-computed, so the Ed25519 verification happens on every `/auth/verify` call regardless of whether a matching challenge exists. This is a CPU waste. If the challenge doesn't exist, the `any` returns false and `sigValid` is irrelevant — but the CPU was already spent.

**Suggested fix:** Move the signature verification inside the atomic block, after the challenge existence check. Or compute it lazily (only if the challenge exists).

### 🟡 Q38. `handleVerifyAuth` logs session eviction count but not the attacker — no audit trail for Sybil floods

**Type:** Implementation gap (server.knot)
**Files:** `server.knot:1240`

The handler logs `logWarn ("session pool full: evicted N session(s)...")` but doesn't log the pubkey or IP of the request that caused the eviction. An operator investigating a Sybil flood would see warnings but not know which pubkeys or IPs are responsible. This makes it hard to block the attacker.

**Suggested fix:** Include the requesting pubkey and IP in the log message.

---

## 8. Spec Gaps

### 🟡 Q39. Spec doesn't specify behavior for empty `encryptedBlob`

**Type:** Spec gap (PROTOCOL.md §4)
**Files:** PROTOCOL.md §4 (Envelope), `server.knot:319-320` (`isValidBlobHex`)

The spec says `encryptedBlob` is "Hex-encoded blob from §3" but doesn't say what happens if it's empty or shorter than `minBlobLen`. The server enforces `isValidBlobHex` (min 346 chars = 173 bytes), but the spec doesn't mention this minimum. An independent implementation might accept shorter blobs and store garbage.

**Suggested fix:** Add the minimum blob length to PROTOCOL.md §4 or §5.

### 🟡 Q40. Spec doesn't specify JSON encoding requirements (UTF-8, key ordering, whitespace)

**Type:** Spec gap (PROTOCOL.md §4, §5)
**Files:** PROTOCOL.md §4, §5

The spec shows JSON examples but doesn't specify:
- Whether keys must be in a specific order (the server uses `GossipEvent` with `eventType` and `pubkey` — order matters for some JSON parsers)
- Whether whitespace is allowed in the JSON (a client could send pretty-printed JSON)
- Whether UTF-8 is required (JSON spec allows UTF-16/UTF-32, but the server likely only handles UTF-8)
- Whether duplicate keys are allowed (JSON allows them, but behavior is undefined)

These could cause implementation divergence. For example, a client that sends `{"encryptedBlob": "...", "to": "..."}` (keys reversed) would work with most JSON parsers but might confuse a strict implementation.

**Suggested fix:** Specify that all JSON is UTF-8, keys are unordered, whitespace is allowed, and duplicate keys are undefined behavior (last one wins).

### 🟡 Q41. Spec doesn't specify what `cursor: 0` means vs absent cursor

**Type:** Spec gap (PROTOCOL.md §6)
**Files:** PROTOCOL.md §6 (`POST /poll`)

The spec says `cursor` is "the maximum `receivedAt` value the client has already seen (`0` on first poll)." But what if the client sends `cursor: -1` or omits the field? The server's `handlePoll` clamps to `max 0 (...)`, so negative cursors become 0. But the spec doesn't say this.

**Suggested fix:** Specify that cursor must be ≥ 0, and that 0 means "first poll" (no messages acked).

### 🟡 Q42. Spec doesn't specify `to` field validation requirements

**Type:** Spec gap (PROTOCOL.md §4, §6)
**Files:** PROTOCOL.md §4 (Envelope), PROTOCOL.md §6 (`POST /messages`)

The spec says `to` is "Recipient's Ed25519 public key (64 lowercase hex)" but doesn't say:
- Must it be a valid Ed25519 public key (a valid curve point)?
- Is the server required to validate it?
- What happens if it's the sender's own key? (The server rejects this as `self_send`, but the spec doesn't say the server should check this — it's an implementation detail)

**Suggested fix:** Specify that `to` must be 64 lowercase hex chars (the server validates format only), and that the server rejects self-sends with `400 self_send`.

### 🟡 Q43. Spec doesn't specify the format of `challenge` in auth

**Type:** Spec gap (PROTOCOL.md §6)
**Files:** PROTOCOL.md §6 (Authentication)

The spec says the challenge is "a random challenge string" but doesn't specify:
- Its length or entropy
- Its format (hex? base64? raw text?)
- Whether it must be unique per challenge request

The server uses `genToken 48` (48 hex chars, 192 bits). The client signs it as part of the auth message. If an independent implementation uses a shorter challenge (e.g., 8 chars), it would be brute-forceable.

**Suggested fix:** Specify minimum challenge length (e.g., 32 hex chars / 128 bits) and format (lowercase hex).

### ⚪ Q44. Spec doesn't specify `revokeOthers` semantics precisely

**Type:** Spec gap (PROTOCOL.md §6)
**Files:** PROTOCOL.md §6 (Authentication step 3)

The spec says `revokeOthers: true` "invalidates every other live session for this pubkey" but doesn't specify:
- Whether it also invalidates challenges (it doesn't — see Q35)
- Whether the revocation is immediate or eventual (it's immediate within the atomic block)
- What happens to in-flight requests using a revoked session (they get 401 on the next request)

**Suggested fix:** Clarify that only sessions (not challenges) are revoked, revocation is immediate, and revoked sessions get 401 on their next request.

---

## 9. Privacy / Metadata Leaks

### 🟠 Q45. Blob size reveals message type to the server

**Type:** Privacy leak (protocol + design)
**Files:** PROTOCOL.md §3 (Length Padding), `core/src/protocol.rs:60-91`

The padding buckets (256, 512, 1024, ...) obscure the exact compressed size, but the bucket boundaries still leak information about the message type:
- A `delivery.ack` with a single ID is tiny (~50 bytes JSON) → compresses to ~40 bytes → inner buffer ~233 bytes → blob ~233 + 16 (AEAD) = 249 → rounds to 256 bucket
- A `text` message with a short body is ~100 bytes JSON → compresses to ~80 bytes → inner buffer ~273 bytes → blob ~289 → rounds to 512 bucket
- A `profile` with a 64 KiB photo → compresses poorly (base64 is high-entropy) → inner buffer ~65 KiB → rounds to 65536 bucket

So the server can distinguish:
- A `delivery.ack` (256 bucket) from a `text` (512 bucket) from a `profile` with photo (65536 bucket)
- A short text (512) from a long text (1024+)

This is a metadata leak beyond what's documented. The spec says "message length is only ever obscured *upward*" and "blob size still distinguishes a one-word reply from a pasted document" — but it doesn't mention that blob size reveals the *message type* (text vs ack vs profile).

**Attack scenario:** A relay observes that Alice sends Bob a 256-bucket blob → it's a delivery.ack (Alice received Bob's message). Then Alice sends a 65536-bucket blob → it's a profile update. The relay learns the *pattern* of communication (who acks whom, who updates their profile) without decrypting anything.

**Exploitable in practice:** The bucket boundaries are coarse but sufficient to distinguish message types. This is a real metadata leak for a "metadata-privacy-focused messenger."

**Suggested fix:** Use a single minimum padding bucket (e.g., always pad to at least 1024 bytes) to make all small messages indistinguishable. Or add random padding within the bucket to add noise. Or pad all messages to the same size (expensive but maximally private).

### 🟡 Q46. `receivedAt` timing reveals sender-recipient correlation to the relay

**Type:** Privacy leak (server.knot)
**Files:** `server.knot:919-925` (`appendMessage`)

The server assigns `receivedAt` at message arrival time. If Alice sends a message to Bob via relay R, R records the arrival time. If Bob polls R shortly after, R records the poll time. The correlation between arrival and poll times reveals that Bob was online and received the message — even though the server doesn't know who sent it.

This is inherent to the relay model (the server must see the recipient and timing), and is documented in §10 ("Recipient metadata exposure"). But the spec understates the leak: it says "servers see the recipient pubkey and arrival time" — it doesn't mention that the server can correlate arrival and poll times to infer delivery.

**Suggested fix:** Document in §10 that the relay can infer delivery by correlating message arrival with recipient poll times.

### 🟡 Q47. Poll cursor reveals the recipient's last-seen position to the relay

**Type:** Privacy leak (server.knot)
**Files:** `server.knot:432-433` (cursor), `server.knot:1265-1275` (cursor clamping)

The client sends its cursor (last-seen `receivedAt`) on every poll. This tells the relay exactly how far behind the recipient is — how many messages they haven't read yet. A relay can use this to:
- Determine if the recipient is actively reading (cursor advances each poll) or just polling (cursor stays the same)
- Estimate the recipient's reading speed (how fast the cursor advances)
- Detect when the recipient switches devices (cursor jumps backward)

This is inherent to the long-poll model but not documented in §10.

**Suggested fix:** Document in §10 that the cursor reveals the recipient's reading progress to the relay.

---

## 10. TOFU and Key Management

### 🟠 Q48. No key change detection — TOFU silently accepts key changes without warning

**Type:** Design gap (protocol + app.rs)
**Files:** PROTOCOL.md §2 (Trust Model), `core/src/app.rs:2043-2045` (sender check)

The spec says "the first time a client encounters a public key, it is accepted and cached" and "Warn users when a contact's public key changes (TOFU violation)." But the implementation doesn't have a mechanism for key changes — because the protocol has no key rotation (§11 is future work).

However, there's a subtler issue: the sender's identity is *inside* the AEAD ciphertext. If an attacker sends a message to Bob encrypted to Bob's key, signing with Mallory's key, Bob's client will:
1. Decrypt the blob (it's encrypted to Bob's key, so it decrypts successfully)
2. Recover the sender's pubkey (Mallory's)
3. Check if Mallory is in Bob's contacts
4. If not, auto-create a contact for Mallory and display the message

This is by design (anyone can send you a message). But if the attacker can somehow get Bob to add Mallory's key as a contact (e.g., by social engineering), and then later send messages that appear to come from Mallory, there's no mechanism to detect that "Mallory" has changed keys — because the key IS the identity.

The real TOFU weakness is: if Bob adds Alice's key, and Alice's key is later compromised, an attacker with Alice's key can send messages that appear to come from Alice. There's no way for Bob to detect this without out-of-band verification. The spec acknowledges this ("TOFU only" in §10), but the implementation doesn't provide a UI for out-of-band verification (comparing @p syllables).

**Exploitable in practice:** This is the fundamental TOFU weakness, already acknowledged in the spec. The implementation gap is the lack of a verification UI, but that's a product feature, not a protocol bug.

**Suggested fix:** Add a UI for fingerprint verification (showing @p syllables for comparison) and a warning when a new contact's key hasn't been verified.

### 🟡 Q49. `Identity::from_secret_bytes` validates the keypair but doesn't check for weak keys

**Type:** Implementation gap (crypto.rs)
**Files:** `core/src/crypto.rs:150-166`

`from_secret_bytes` re-derives the public key from the seed and checks it matches. But it doesn't check for weak Ed25519 keys (e.g., keys where the X25519 derived key is a low-order point). The `x25519` function checks for all-zero shared secrets (low-order point detection), but this only fires during encryption/decryption, not at key load time.

If the user's Ed25519 key happens to produce an X25519 public key that is a low-order point, every encryption to them would fail with `InvalidEphemeralKey` (because `x25519(eph_priv, recip_x)` would return all-zero). The user would be unable to receive messages but wouldn't know why.

The probability of this is negligible (low-order points are extremely rare on Curve25519), but the code doesn't check for it at key generation time.

**Suggested fix:** Check `x25519_public` is not a low-order point at key generation/load time. Report an error if it is.

### 🟡 Q50. No mechanism to revoke or invalidate a compromised identity key

**Type:** Design gap (PROTOCOL.md §11)
**Files:** PROTOCOL.md §11 (Future Extensions — Key Rotation)

The spec acknowledges this in §11 (future work): "a user who loses or wants to retire a key has no in-protocol way to say so." There's no key revocation, no key rotation, and no mechanism to tell contacts that a key is compromised.

If a user's key is stolen, the attacker can:
1. Decrypt all captured messages (no forward secrecy)
2. Send messages as the user (no revocation)
3. Poll the user's mailbox (if they know the server)
4. Receive messages intended for the user (if they redirect presence)

The only defense is out-of-band communication ("my key was compromised, don't talk to the old key anymore"), which requires every contact to manually re-add the new key.

**Suggested fix:** This is acknowledged as future work. Document the impact more prominently in §10: a stolen identity key is a full takeover with no in-protocol recovery.

---

## Summary of New Findings

| # | Severity | Type | Title |
|---|----------|------|-------|
| Q1 | 🟡 medium | Design gap | HKDF salt omits sender identity — KCI vector |
| Q2 | 🟡 medium | Design gap | No AAD on AEAD — envelope fields unauthenticated |
| Q5 | 🟡 medium | Spec gap | CRIME/BREACH surface wider than documented for profiles |
| Q7 | 🟡 medium | Perf/DoS | appendMessage dedup O(n) — CPU amplification |
| Q8 | 🟠 high | Design gap | maxMessagesPerRecipient eviction destroys genuine mail |
| Q9 | 🟡 medium | Impl bug | capForwards evicts by retry count only, not destination health |
| Q10 | 🟡 medium | Impl concern | genToken entropy depends on Knot runtime CSPRNG |
| Q11 | 🟡 medium | Impl concern | Challenge lookup O(n) — timing varies with pool size |
| Q16 | 🟠 high | Impl concern | Cursor clamping allows relay to poison cursor → message loss |
| Q17 | 🟡 medium | Impl concern | Ack staleness check affected by page ordering |
| Q18 | 🟡 medium | Impl bug | seen_ids dedup misses trimmed messages → replay after 1000 msgs |
| Q23 | 🟡 medium | Impl gap | PubkeyHex accepts non-curve-point keys at route boundary |
| Q25 | 🟡 medium | Impl concern | Malformed poll JSON silently produces empty page |
| Q27 | 🟠 high | Design gap | Gossip amplification: 100 online events = 100 mailbox scans + forwards |
| Q28 | 🟡 medium | Design gap | Offline events don't cancel pending forwards |
| Q29 | 🟡 medium | Design gap | fromServer not verified against connecting peer's address |
| Q30 | 🟠 high | Design gap | /auth/challenge pool floodable — soft DoS via XFF spoofing |
| Q31 | 🟡 medium | Design gap | Rate limit counts requests not messages — effective rate much higher |
| Q32 | 🟡 medium | Design gap | maxSessions Sybil-floodable (documented in code, not in spec) |
| Q33 | 🟡 medium | Design gap | maxPresence fillable with fake keys (documented in code, not in spec) |
| Q34 | 🟠 high | Design gap | Session token not bound to pubkey — theft = full impersonation |
| Q35 | 🟡 medium | Impl gap | revokeOthers doesn't revoke challenges |
| Q37 | 🟡 medium | Design gap | Signature verification CPU wasted on missing challenges |
| Q38 | 🟡 medium | Impl gap | No audit trail (pubkey/IP) for Sybil eviction |
| Q39 | 🟡 medium | Spec gap | Spec doesn't specify min blob length |
| Q40 | 🟡 medium | Spec gap | Spec doesn't specify JSON encoding requirements |
| Q41 | 🟡 medium | Spec gap | Spec doesn't specify cursor validation |
| Q42 | 🟡 medium | Spec gap | Spec doesn't specify `to` field validation |
| Q43 | 🟡 medium | Spec gap | Spec doesn't specify challenge format/entropy |
| Q44 | ⚪ info | Spec gap | Spec doesn't specify revokeOthers semantics precisely |
| Q45 | 🟠 high | Privacy leak | Blob size reveals message type (ack vs text vs profile) to relay |
| Q46 | 🟡 medium | Privacy leak | receivedAt timing reveals delivery correlation |
| Q47 | 🟡 medium | Privacy leak | Poll cursor reveals reading progress to relay |
| Q48 | 🟠 high | Design gap | No key change detection — TOFU has no verification UI |
| Q49 | 🟡 medium | Impl gap | No weak key check at identity load time |
| Q50 | 🟡 medium | Design gap | No identity key revocation mechanism (acknowledged future work) |

**High-severity findings (7):** Q8, Q16, Q27, Q30, Q34, Q45, Q48
**Medium-severity findings (24):** Q1, Q2, Q5, Q7, Q9, Q10, Q11, Q17, Q18, Q23, Q25, Q28, Q29, Q31, Q32, Q33, Q35, Q37, Q38, Q39, Q40, Q41, Q42, Q43, Q46, Q47, Q49, Q50
**Info (1):** Q44

Note: Several findings marked as "not a bug" during analysis were downgraded to info or omitted from the final table. The table includes only findings that represent genuine new issues.