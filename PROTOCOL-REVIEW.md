# PROTOCOL.md Review — Holes vs. Implementation

**Date:** 2026-06-20
**Scope:** Cross-check of gaps found in `PROTOCOL.md` against the actual code
(`server.knot`, `client/`). Each item records whether the implementation already
handles it, partially handles it, or leaves it open.

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
bare lowercased hostname it dialed (`client/ApiClient.fs`, `Crypto.fs`
`signChallenge`), and the server verifies against
`"skrepka-auth-v1:" ++ beforeColon serverHost ++ ":" ++ challenge` using its own
configured `serverHost` (`server.knot` `handleVerifyAuth`). The `skrepka-auth-v1:`
prefix is a domain-separation tag so an auth signature can never be confused with
a message signature (`recipientPub || compressed`, `Crypto.fs`). Breaking change:
client and server must be upgraded together.

---

## ❌ 2. Gossip presence spoofing redirects a victim's mail to the attacker

**Severity: high — open (consequence of open federation).**

`/federation/gossip` is unauthenticated. On a newly-`online` event the origin
forwards the recipient's queued messages **to the announcing `fromServer`**.

- `server.knot:1090` — `fork (forEach newlyOnline (\pk -> forwardQueuedToServer pk fromServer))`.

**Attack:** a hostile peer announces `{eventType:"online", pubkey:<victim>,
fromServer:<attacker>}`. The origin forwards all of the victim's queued
ciphertext to the attacker, who harvests ciphertext copies + recipient/timing/size
metadata. The receiver-side "recipient must be locally online" gate is checked by
the attacker's own server, so it is not a real gate.

**Existing partial defense:** `isBadServerName` SSRF deny-list (`server.knot:505`)
blocks internal targets; rate-limited 60/window/IP. Neither authenticates the peer.

`PROTOCOL.md` §10 understates this as "a hostile server can observe gossip" — it
can actively **redirect delivery**. At minimum the spec should say so; a real fix
needs signed/authenticated presence or peer allow-listing.

---

## 🟡 3. Replay protection is narrower than §10 claims

**Severity: medium — partially fixed.**

§10 claims "Replay protection"; the only mechanism is the recipient-bound
signature, which stops replay to a *different* recipient, not re-delivery of the
same blob to the same recipient. Per-type status:

- `text` — ✅ protected: deduped by `id` (`client/App.fs:38`).
- `delivery.ack` — ✅ harmless: `markDelivered` only flips `Sent → Delivered`,
  idempotent (`client/App.fs:43`).
- `profile` — ❌ **open**: `withProfile` overwrites name/bio/photo
  unconditionally (`client/App.fs:66`). The payload `ts` is parsed
  (`client/Protocol.fs:53`) but **not** propagated to `ProfileMessage` or
  compared, so a replayed *older* profile blob silently rolls a contact's
  profile back.

**Fix:** carry `ts` into `Envelope.ProfileMessage` and ignore a profile whose
`ts` is older than the last one stored for that contact. Tighten §10 wording to
"replay against a *different* recipient."

---

## 🟡 4. Open `/federation/forward` allows mailbox injection

**Severity: medium — mitigated, not closed.**

Any host can POST a blob for any locally-online `toKey`; the endpoint is
unauthenticated.

- Mitigations present: per-IP rate limit 600/window (`server.knot:140/314`),
  SSRF filter on origins, `no_presence` gate.
- Residual: junk blobs still reach an online recipient's poll stream; the spec
  never says what a client does with an undecryptable blob (it is dropped at
  `Crypto.decrypt`, `client/Protocol.fs:88`). Worth documenting as an accepted,
  rate-limited spam surface.

---

## ⚪ 5. `receivedAt` "millisecond timestamp" vs "monotonic" — wording only

**Not a bug.** `appendMessage` assigns `seqTs = max t (currentSeq seqRows + 1)`
(`server.knot:653`), which is **strictly monotonic**, so no two messages share a
`receivedAt` and the `cursor >= receivedAt` implicit-ack cannot drop an unseen
message. The spec just describes the same value as both a "millisecond timestamp"
and "monotonic," which reads as ambiguous. Recommend: describe it as "a
monotonic sequence seeded from millisecond wall-clock; treat as an opaque
checkpoint, not a clock."

---

## ✅ 6. Total request-body cap — fixed in deployment, undocumented in spec

The per-blob cap is `maxBlobLen = 41943040` (40 MiB hex) enforced by the
`BlobHex` type (`server.knot:53/198`), and `maxBatchSize = 100`
(`server.knot:56`). The naive reading "100 × 40 MiB = 4 GiB request" is
**prevented** by a runtime body cap set in deployment:

- `install.sh` — `ExecStart=… --http-max-body-bytes=42M` caps the *entire*
  request body (chosen just above `maxBlobLen` + envelope; the runtime default is
  16 MiB).

So a batch can carry one max-size blob or many small ones, but total ≤ 42 MiB.
`PROTOCOL.md` §5 should state this total-body cap (and that operators must keep
`--http-max-body-bytes` > `maxBlobLen`).

---

## ❌ 7. No crypto / wire-format version negotiation

**Severity: low — open.**

`info = "skrepka-v1"` is hardcoded (`client/Crypto.fs:178` / `Constants`), and
neither the envelope nor the plaintext payload carries a version field. "Ignore
unknown `type`" gives payload-type agility but no path to rotate the
AEAD/KDF/curve. Recommend a stated version field or an explicit "no crypto
agility in v0.1" note.

---

## ⚪ 8. X-Forwarded-For trust is spoofable without a proxy — by design

`trustForwardedFor = True` by default (`server.knot:148`); the session/rate-limit
IP is the last XFF hop (`pickClientIp`, `server.knot:302`), and `matchIp` treats
an empty bound IP as a wildcard (`server.knot:546`). This is correct **behind a
trusted proxy** but spoofable when the server is directly exposed. The flag and
its `--trustForwardedFor=False` override exist; the spec presents IP-binding as a
protection without the proxy caveat. Recommend documenting it.

---

## Minor / noted

- HKDF salt is `ephemeral_pub || recipient_x25519_pub` (both public), binds no
  sender — fine for confidentiality, no KCI/UKS guarantee beyond the signature.
- Presence TTL (90 min, `onlineGossipTtl`) outlives the 1 h session, so location
  metadata and stale forwards can persist ~90 min after disconnect.
- `/auth/challenge` is unauthenticated; fillable by anyone but capped
  (`maxChallenges = 10000`, `maxChallengesPerKey = 5`).

---

## Suggested follow-ups

1. **Spec edits (safe, no behavior change):** fold #2, #3, #6, #8 caveats into
   `PROTOCOL.md` (§6 auth, §7 federation, §5 size, §10 security).
2. **Code fixes worth doing:** #1 (bind challenge to server) is **done**;
   #3-profile (`ts` staleness guard) remains a genuine, fixable defect.
3. #2 and #4 are inherent to open, unauthenticated federation — decide whether to
   document-as-accepted or add peer authentication.
