# PROTOCOL.md Review — Holes vs. Implementation

**Date:** 2026-06-20 (revised 2026-07-11 against the Rust core)
**Scope:** Cross-check of gaps found in `PROTOCOL.md` against the actual code
(`server.knot`, `core/` — the Rust/Crux shared core). Each item records whether
the implementation already handles it, partially handles it, or leaves it open.

> The original review was written against the F# client, which has since been
> replaced by the Rust core in `core/` (logic) plus a logic-free SwiftUI shell in
> `apple/`. Citations below point at the Rust code; findings that the rewrite
> closed are marked as such.

Legend: ✅ fixed · 🟡 partial / mitigated · ❌ open · ⚪ not-a-bug (spec wording only)

---

## ✅ 1. Auth challenge is not bound to the server (session relay) — fixed

**Severity: high — fixed.**

The client signed the bare challenge string and the server verified the bare
challenge string. Nothing bound the signed material to a server identity, so a
relay could forward another server's challenge and replay the signature.

**Attack (historical):** a malicious/relay server the client connects to fetched
a challenge for the client's pubkey from a legit server A, handed it to the
client, collected the signature, and replayed it to A's `/auth/verify` —
obtaining a session **as the client** on A (could `/poll` the client's mailbox
and send as them). The challenge's IP-binding (`matchIp`) did not help, because
the relay server was the client-of-record to A throughout.

**Fix (applied):** the client now signs
`"skrepka-auth-v1:" + server_host + ":" + challenge` where `server_host` is the
bare lowercased hostname it dialed (`Identity::sign_challenge`,
`core/src/crypto.rs`; the tag is `AUTH_TAG`), and the server verifies against
`"skrepka-auth-v1:" ++ beforeColon serverHost ++ ":" ++ challenge` using its own
configured `serverHost` (`server.knot` `handleVerifyAuth`). The `skrepka-auth-v1:`
prefix is a domain-separation tag so an auth signature can never be confused with
a message signature (which is over `recipientPub || compressed`). Breaking change:
client and server must be upgraded together.

Operational corollary: a relay's `serverHost` **must** be the public hostname
clients dial, or every signature fails to verify. It defaults to `"localhost"`,
so `install.sh` passes `--serverHost=${DOMAIN}` in the systemd unit it writes.

---

## ❌ 2. Gossip presence spoofing redirects a victim's mail to the attacker

**Severity: high — open (consequence of open federation).**

`/federation/gossip` is unauthenticated. On a newly-`online` event the origin
forwards the recipient's queued messages **to the announcing `fromServer`**
(`handleRecvGossip` → `forwardQueuedToServer pk fromServer`, `server.knot`).

**Attack:** a hostile peer announces `{eventType:"online", pubkey:<victim>,
fromServer:<attacker>}`. The origin forwards all of the victim's queued
ciphertext to the attacker, who harvests ciphertext copies + recipient/timing/size
metadata. The receiver-side "recipient must be locally online" gate is checked by
the attacker's own server, so it is not a real gate.

**Existing partial defense:** the `isBadServerName` SSRF deny-list blocks
internal targets, and gossip is rate-limited per peer IP. Neither authenticates
the peer, and the deny-list is purely lexical — a public-looking hostname under
attacker DNS control still passes (documented at `isBadServerName`).

`PROTOCOL.md` §10 understates this as "a hostile server can observe gossip" — it
can actively **redirect delivery**. At minimum the spec should say so; a real fix
needs signed/authenticated presence or peer allow-listing.

---

## ✅ 3. Replay protection is narrower than §10 claims — closed in the Rust core

**Severity: medium — fixed.**

§10 claimed "Replay protection"; the underlying mechanism is the
recipient-bound signature, which stops replay to a *different* recipient, not
re-delivery of the same blob to the same recipient. Per-type status, all in
`ingest_poll` (`core/src/app.rs`):

- `text` — ✅ deduplicated by `id` before it is appended to a conversation.
- `delivery.ack` — ✅ harmless: it only flips `Sent → Delivered`, idempotent.
- `profile` — ✅ **fixed** (was open in the F# client): each `Contact` carries
  `last_profile_ts` (`core/src/model.rs`), and an incoming `profile` whose `ts`
  predates it is dropped instead of applied, so a replayed *older* profile can no
  longer roll a contact's name/bio/photo back.

`PROTOCOL.md` §4 and §10 have been updated to say the reference client enforces
the staleness check. §10's replay wording should still be read as "replay against
a *different* recipient" — re-delivery to the same recipient is prevented by the
per-type guards above, not by the crypto.

---

## 🟡 4. Open `/federation/forward` allows mailbox injection

**Severity: medium — mitigated, not closed.**

Any host can POST a blob for any locally-online `toKey`; the endpoint is
unauthenticated.

- Mitigations present: per-IP rate limit (`forwardRateLimit`, `server.knot`),
  the SSRF filter on origins, and the `no_presence` gate.
- Residual: junk blobs still reach an online recipient's poll stream; the spec
  never says what a client does with an undecryptable blob. The core drops it
  silently — `crypto::decrypt` returning `Err` just `continue`s the ingest loop
  (`ingest_poll`, `core/src/app.rs`). Worth documenting as an accepted,
  rate-limited spam surface.

---

## ⚪ 5. `receivedAt` "millisecond timestamp" vs "monotonic" — wording only

**Not a bug.** `appendMessage` assigns `seqTs = max t (currentSeq seqRows + 1)`
(`server.knot`), which is **strictly monotonic**, so no two messages share a
`receivedAt` and the `cursor >= receivedAt` implicit-ack cannot drop an unseen
message. The spec just describes the same value as both a "millisecond timestamp"
and "monotonic," which reads as ambiguous. Recommend: describe it as "a
monotonic sequence seeded from millisecond wall-clock; treat as an opaque
checkpoint, not a clock."

---

## ✅ 6. Total request-body cap — fixed in deployment, undocumented in spec

The per-blob cap is `maxBlobLen` (40 MiB hex) enforced by the `BlobHex` type, and
a batch is capped at `maxBatchSize = 100` (`server.knot`). The naive reading
"100 × 40 MiB = 4 GiB request" is **prevented** by a runtime body cap set in
deployment:

- `install.sh` — `ExecStart=… --http-max-body-bytes=42M` caps the *entire*
  request body (chosen just above `maxBlobLen` + envelope; the runtime default is
  16 MiB, which would reject a legitimate max-size blob with a bare 413).

So a batch can carry one max-size blob or many small ones, but total ≤ 42 MiB.
`PROTOCOL.md` §5 should state this total-body cap (and that operators must keep
`--http-max-body-bytes` > `maxBlobLen`).

---

## ✅ 7. No crypto / wire-format version negotiation — fixed

**Severity: low — fixed.**

`HKDF_INFO = "skrepka-v1"` is hardcoded (`core/src/crypto.rs`), and the plaintext payload carries no version field. The wire format now carries a leading version byte (`WIRE_VERSION = 0x01`, `core/src/crypto.rs`): `encrypt` prepends it, and `decrypt` reads and checks it before any other processing, returning `CryptoError::Decrypt` on mismatch. `MIN_BLOB_LEN` includes the extra byte (169 bytes). "Ignore unknown `type`" (`protocol::parse_payload`) gives payload-type agility; the version byte gives the same for the wire format, AEAD, KDF, and curve choices. A future revision that changes crypto primitives should bump both the version byte and the HKDF `info` string.

---

## ⚪ 8. X-Forwarded-For trust is spoofable without a proxy — by design

`trustForwardedFor = True` by default (`server.knot`); the session/rate-limit IP
is the last XFF hop (`pickClientIp`), and `matchIp` treats an empty bound IP as a
wildcard. This is correct **behind a trusted proxy** (the `install.sh` topology,
Caddy in front) but spoofable when the server is directly exposed — a client could
forge the header to mint fresh rate-limit buckets. The flag and its
`--trustForwardedFor=False` override exist; the spec presents IP-binding as a
protection without the proxy caveat. Recommend documenting it.

---

## Minor / noted

- The SSRF deny-list (`isBadServerName`) is **lexical only**: it filters the
  hostname string, never the address it resolves to, so an attacker-controlled
  name that resolves to a private IP passes. Closing it requires resolve-then-pin,
  which the runtime's `fetch` does not expose. Documented in place.
- HKDF salt is `ephemeral_pub || recipient_x25519_pub` (both public), binds no
  sender — fine for confidentiality, no KCI/UKS guarantee beyond the signature.
- Presence TTL (90 min, `onlineGossipTtl`) outlives the 1 h session, so location
  metadata and stale forwards can persist ~90 min after disconnect.
- `/auth/challenge` is unauthenticated; fillable by anyone but capped
  (`maxChallenges = 10000`, `maxChallengesPerKey = 5`) and rate-limited per
  client IP. It is deliberately **not** limited per submitted pubkey: keypairs are
  free, so a pubkey-keyed bucket refills on every rotation (Sybil), and it would
  also let an attacker exhaust a victim's login budget.

---

## 🟡 9. Federation retry loop can starve the prune sweep

**Severity: low — design tradeoff, not a code bug.**

`backgroundRetryForwards` runs `retryPendingForwards` inline (not via `fork`),
so a sweep that hits many slow or timing-out peers blocks until every
`fetch` in the batch resolves. Each `fetch` has no explicit timeout — the
runtime's HTTP client holds the connection — so a sweep over N unreachable
peers can take N × (TCP connect timeout) before returning. During that time
`backgroundPrune` (on its own `fork`) is free to run, but its writes to
`*messages` and `*forwardFailures` conflict with `retryPendingForwards`'s
`atomic` blocks, so `pruneExpired`'s atomic retries lose to the retry loop
and are effectively starved: expired messages, sessions, and challenges
pile up until the retry sweep finishes.

In practice this only matters under federation with many dead peers and a
low `retryBackoffMax` — the `shouldRetryServer` gate skips peers in backoff,
so after one failed sweep most peers are gated out of the next one. The
first sweep after a network partition is the worst case.

**No fix applied.** The deliberate design (inline, not forked) prevents two
concurrent `retryPendingForwards` from seeing the same `*forwards` snapshot
and double-counting `recordFailure`. Forking it would reintroduce that race.
A real fix would either (a) give `fetch` a deadline and bound the sweep
time, or (b) run `retryPendingForwards` in a transaction that yields
`*messages`/`*forwardFailures` to `pruneExpired` between per-peer batches.
Both need runtime support the current `fetch` does not expose.

---

## Suggested follow-ups

1. **Spec edits (safe, no behavior change):** fold #2, #4, #6, #8 caveats into
   `PROTOCOL.md` (§6 auth, §7 federation, §5 size, §10 security). #3's spec text
   is already updated.
2. **Code fixes:** #1 (bind challenge to server) and #3 (profile `ts` staleness
   guard) are **done**.
3. #2 and #4 are inherent to open, unauthenticated federation — decide whether to
   document-as-accepted or add peer authentication.
4. **#9** is a design tradeoff; document as accepted until `fetch` supports a
   deadline.

---

## Findings blocked on runtime/protocol support (2026-07-13 audit)

These findings are documented here for tracking. Each is blocked on a capability
the current runtime or protocol does not expose, so no code fix is possible
today.

### ❌ A. `now_ms()` impurity breaks MVU replayability

**Severity: medium — blocked on `crux_time` refactor.**

`now_ms()` reads the system clock from inside `update()` (app.rs:427), which is
supposed to be a pure function of `(Event, Model)`. This affects `SendText`,
`SaveProfile`, `ingest_poll`, `flush_next` (first_attempt stamping), and ack
timestamping. The state machine cannot be replayed deterministically, and tests
cannot pin "now".

The fix is to take the time as a `crux_time` effect and feed it back as an
event — but every timestamped path would become a two-step round-trip through
the shell. A TODO comment is in place at the call site. This refactor is worth
doing but is not a drive-by fix.

### ❌ B. Token comparison timing side-channel

**Severity: medium — blocked on Knot runtime.**

`s.token == token` is plain string equality, which short-circuits on the first
differing byte (server.knot:761). An attacker who can time the response learns
how many leading characters of a guess were correct. Bounded by the 192-bit
token and per-IP rate limit. The correct fix is a `constantTimeEquals` primitive
in the Knot runtime. Documented in PROTOCOL.md §6 and in-code comments.

### ❌ C. Open federation — gossip redirect & forward injection

**Severity: high — accepted v0.1 limitation, blocked on peer authentication.**

Both `/federation/*` endpoints are unauthenticated. An attacker can redirect a
victim's queued ciphertext or inject blobs into an online recipient's mailbox.
Fully documented in PROTOCOL-REVIEW.md #2, #4 and PROTOCOL.md §10. The fix
requires signed presence gossip and authenticated forward requests, which needs
a key-to-home-server binding the protocol does not yet define.

### ❌ D. SSRF deny-list is lexical only

**Severity: medium — blocked on `fetch` exposing DNS resolution.**

`isBadServerName` inspects the hostname string, never the resolved address.
DNS-rebinding TOCTOU bypasses it. The fix needs resolve-then-pin (fuse DNS
resolution with connection), which `fetch` does not expose. Documented in
PROTOCOL-REVIEW.md and in-code comments at `isBadServerName`.

### ❌ E. Federation retry sweep can starve the prune sweep

**Severity: low — design tradeoff, blocked on `fetch` deadline support.**

`backgroundRetryForwards` runs inline, so a sweep over many unreachable peers
blocks until every `fetch` resolves. The prune sweep's writes conflict with the
retry loop's atomic blocks. A fix needs either a `fetch` deadline or a
transaction that yields between per-peer batches, neither of which the current
`fetch` supports. Documented in PROTOCOL-REVIEW.md #9.

---

## Fixed in third-pass audit (2026-07-13)

### ✅ F. Cursor advanced before budget check — message loss on oversized poll page

**Severity: high — fixed.**

`ingest_poll` advanced `model.cursor` to `page.cursor` before the event loop.
If the `MAX_POLL_TOTAL_BYTES` budget was exhausted mid-page, the loop broke
but the cursor stayed at `page.cursor`. The next poll acked the whole page to
the relay, which deleted every event the client never processed — permanent
message loss. A relay serving 4+ large blobs (each up to 20 MiB) in a single
50-event page was enough to trigger this.

**Fix:** Save the pre-page cursor and restore it when the budget is exhausted.

### ✅ G. `send_text` did not check if peer is blocked

**Severity: medium — fixed.**

Blocking was documented as cutting a peer off in both directions, and the
ingest side correctly dropped blocked peers' messages. But `send_text` had no
block check, so a user could keep sending messages to a blocked contact. The
Swift `ChatView` composer was also not disabled for blocked peers.

**Fix:** `send_text` now refuses with an error when the active peer is blocked.
The Swift composer disables both the text field and the send button when
`activePeerBlocked` is true.

### ✅ H. `compressed` and `signed` intermediates not zeroized in `crypto::encrypt`

**Severity: low — fixed.**

The `inner` buffer was correctly `Zeroize`d after encryption, but the
`compressed` (compressed plaintext) and `signed` (signature input containing
recipient_pub + compressed + padding) intermediates were plain `Vec<u8>`s
that retained sensitive data in freed memory. Both are now `Zeroizing<Vec<u8>>`.

### ✅ I. PROTOCOL.md §10 "No cryptographic agility" contradicted §3

**Severity: spec only — fixed.**

The §10 risk table said "The wire format has no version field" but §3 had
been updated to describe a version byte (`0x01`) and a "Cryptographic
Versioning" section. The table entry now accurately reflects the version
byte's existence and its limitations.

### ✅ J. PROTOCOL.md §4 "Blocking" didn't match implementation

**Severity: spec only — fixed.**

The spec said blocked senders' messages "are still received and decrypted but
are not displayed." The implementation drops them before decryption. The spec
now accurately describes the implementation: messages are dropped without
decryption or storage, and blocking is bidirectional.
