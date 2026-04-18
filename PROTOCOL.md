# Skrepka Protocol Specification

**Version:** 0.1 (Draft)

---

## 1. Overview

Skrepka is a decentralized, end-to-end encrypted messaging protocol. It has no user accounts, no home servers, and no central authority.

### Design Goals

- **No accounts.** A user's identity is their cryptographic keypair. No registration, no passwords, no servers storing credentials.
- **No home server.** Users connect to any server in the mesh and can switch freely. Servers are disposable relays.
- **End-to-end encryption.** Servers see only envelope metadata. Message content is opaque.
- **Open federation.** Any server can join the mesh. Operators may optionally blocklist specific peers.
- **Ephemeral.** All messages expire after 30 days — on servers and on devices. No permanent history.
- **Simplicity.** Plain HTTP transport, no session negotiation, no ratchets.

### Non-Goals

- Forward secrecy (per-message ephemeral keys provide partial protection, but no ratchet)
- Metadata privacy (servers see sender, recipient, and timestamp)
- Durable message storage (servers queue temporarily, not permanently)
- Peer-to-peer delivery (at least one server must be reachable)

---

## 2. Identity

### Key Generation

On first launch, a client generates an **Ed25519 keypair** (the identity key). The corresponding **X25519 public key** for key agreement is derived from the Ed25519 key using the birational map between the two curves (RFC 7748 / RFC 8032). This means a single keypair serves both signing and encryption — only the Ed25519 key needs to be stored and shared.

The user's **public key is their identity**. There are no usernames, no global namespace, and no registration step.

Each device generates its own independent keypair and is treated as a separate identity.

### Key Format

Public keys are encoded as **base64url** (RFC 4648 §5, no padding).

### Identity URI

```
skrepka://<base64url(ed25519_pubkey)>@<server_host>
```

Example:

```
skrepka://dGhpcyBpcyBhIHRlc3Q@relay.example.com
```

The URI contains everything needed to reach someone:

- **Public key** — who they are
- **Server host** — a server where they were last seen or any known relay

Since there is no home server, the server component is a hint, not an authority. The recipient may be connected to a different server by the time a message is sent. The gossip layer resolves current location.

Identity URIs are designed to be shared out-of-band: copied as text, embedded in links, or scanned as QR codes.

### Trust Model

**Trust-on-First-Use (TOFU).** The first time a client encounters a public key, it is accepted and cached. Optional out-of-band verification (e.g., comparing fingerprints in person) is supported but not required by the protocol.

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

### Per-Message Encryption

Each message is independently encrypted. There are no sessions, no ratchet, and no state between sender and recipient.

**Encryption flow:**

1. Generate an ephemeral X25519 keypair:
   ```
   ephemeral_private, ephemeral_public = x25519_generate()
   ```
2. Compute the raw shared secret using the ephemeral private key and the recipient's long-term X25519 public key:
   ```
   raw_secret = x25519(ephemeral_private, recipient_x25519_public)
   ```
3. Derive the encryption key using HKDF-SHA256:
   ```
   key = hkdf_sha256(
     ikm  = raw_secret,
     salt  = ephemeral_public || recipient_x25519_public,
     info  = "skrepka-v1",
     len   = 32
   )
   ```
4. Generate a random 24-byte nonce:
   ```
   nonce = random_bytes(24)
   ```
5. Encrypt the plaintext message:
   ```
   ciphertext = xchacha20_poly1305_encrypt(key, nonce, plaintext)
   ```
6. Sign the ciphertext with the sender's Ed25519 private key:
   ```
   signature = ed25519_sign(sender_ed25519_private, ciphertext)
   ```

**Decryption flow:**

1. Verify the signature against the sender's Ed25519 public key.
2. Compute the raw shared secret using the recipient's long-term X25519 private key and the ephemeral public key from the message.
3. Derive the encryption key using HKDF-SHA256 with the same parameters.
4. Decrypt the ciphertext using the derived key and nonce.

### Encrypted Blob Format

```
ephemeral_x25519_pubkey  (32 bytes)
nonce                    (24 bytes)
ciphertext               (variable)
sender_ed25519_pubkey    (32 bytes)
signature                (64 bytes)
```

Total overhead: 152 bytes per message.

---

## 4. Message Format

### Envelope

The envelope is what servers see. It is transmitted in cleartext (not encrypted) so servers can route messages.

```json
{
  "to": "<base64url(recipient_ed25519_pubkey)>",
  "from": "<base64url(sender_ed25519_pubkey)>",
  "encrypted_blob": "<base64url(encrypted_blob)>",
  "timestamp": 1679000000
}
```

| Field            | Type   | Description                                      |
|------------------|--------|--------------------------------------------------|
| `to`             | string | Recipient's Ed25519 public key (base64url)       |
| `from`           | string | Sender's Ed25519 public key (base64url)          |
| `encrypted_blob` | string | The encrypted blob from §3 (base64url)           |
| `timestamp`      | number | Unix timestamp (seconds) when the message was sent |

Servers route based on `to` and `from`. They never inspect `encrypted_blob`.

### Plaintext Payload

After decryption, the plaintext is a JSON object with a `type` field:

```json
{
  "type": "<message_type>",
  "id": "<unique_message_id>",
  "timestamp": 1679000000,
  ...
}
```

The `id` field is a client-generated UUID v4. Clients MUST deduplicate incoming messages by `id` — the same message may arrive more than once due to presence fan-out (see §7).

Clients MUST silently ignore message types they do not recognize. This allows newer clients to introduce new types without breaking older ones.

### Message Types

| Type              | Description                              | Additional Fields                              |
|-------------------|------------------------------------------|-------------------------------------------------|
| `text`            | A text message                           | `body` (string)                                 |
| `media`           | An inline media attachment               | `media_type` (MIME), `filename`, `data` (base64)|
| `group.invite`    | Invite to a group (see §8)              | `group_id`, `group_name`, `members`             |
| `group.leave`     | Leave a group                            | `group_id`                                      |
| `group.update`    | Update group metadata                    | `group_id`, `group_name`, `members`             |
| `delivery.ack`    | Delivery acknowledgement                 | `ack_ids` (array of message IDs)                |
| `read`            | Read receipt                             | `read_ids` (array of message IDs)               |
| `profile`         | Share display name and/or photo          | `display_name` (string), `photo` (base64, optional) |

Media files are embedded inline in the encrypted payload as base64-encoded `data`. There is no separate media hosting or upload endpoint.

### Profiles

Users can share a display name and photo with contacts by sending a `profile` message. This is sent as a regular encrypted message — servers never see profile data.

```json
{
  "type": "profile",
  "id": "msg_456",
  "timestamp": 1679000000,
  "display_name": "Alice",
  "photo": "<base64(jpeg_data)>"
}
```

Clients SHOULD send a `profile` message to a contact on first interaction and whenever the user updates their name or photo. The recipient's client caches the profile locally. The `photo` field is optional and MAY be omitted to update only the display name.

### Blocking

Blocking is client-side only. A blocked sender's messages are still received and decrypted but are not displayed to the user. The protocol does not provide a mechanism to tell a server to reject messages from a specific pubkey.

---

## 5. Transport

All communication uses **plain HTTP**.

| Direction          | Mechanism            |
|--------------------|----------------------|
| Client → Server    | HTTP POST            |
| Server → Client    | Long polling             |
| Server → Server    | HTTP POST            |

**Why HTTP + long polling:**
- No special protocols. Works through proxies, load balancers, and CDNs.
- Long polling provides near-real-time delivery over plain HTTP request/response cycles.
- No persistent connections, no WebSocket upgrade, no gRPC toolchain, no raw TCP.

### Server Discovery

New clients discover servers via a well-known URL:

```
https://skrepka.org/servers.json
```

The response is a JSON array of server hostnames:

```json
{
  "servers": [
    { "host": "relay1.example.com", "region": "eu" },
    { "host": "relay2.example.com", "region": "us" },
    { "host": "relay3.example.com", "region": "ap" }
  ]
}
```

The client picks a server from the list (e.g., by latency or region preference) and connects. This list is a bootstrap mechanism only — once connected, the client may learn about other servers through the mesh.

### Content Type

All request and response bodies use `application/json`.

### Message Size Limit

The maximum size of an encrypted blob is **20 MB**. Servers MUST reject messages exceeding this limit. This applies to the entire encrypted payload, including inline media.

---

## 6. Client ↔ Server Protocol

### Authentication (Challenge-Response)

When a client connects, it proves ownership of its keypair:

1. Client sends its public key:
   ```
   POST /auth/challenge
   { "pubkey": "<base64url(ed25519_pubkey)>" }
   ```

2. Server responds with a random challenge (valid for 60 seconds):
   ```json
   { "challenge": "<base64url(random_32_bytes)>" }
   ```

3. Client signs the challenge and sends it back:
   ```
   POST /auth/verify
   {
     "pubkey": "<base64url(ed25519_pubkey)>",
     "challenge": "<base64url(challenge)>",
     "signature": "<base64url(ed25519_sign(private_key, challenge))>"
   }
   ```

4. Server verifies the signature. On success, returns a session token valid for **1 hour**:
   ```json
   { "token": "<session_token>", "expires_at": 1679003600 }
   ```

The session token is included in all subsequent requests as a bearer token:
```
Authorization: Bearer <session_token>
```

When a token expires, the server responds with `401`. The client re-authenticates by repeating the challenge-response flow. Servers SHOULD broadcast an `offline` gossip event only if the client does not re-authenticate within a grace period (e.g., 60 seconds).

### Endpoints

#### `POST /auth/challenge` — Request auth challenge

**Request:**
```json
{ "pubkey": "<base64url(ed25519_pubkey)>" }
```

**Response:**
```json
{ "challenge": "<base64url(random_32_bytes)>" }
```

#### `POST /auth/verify` — Complete auth

**Request:**
```json
{
  "pubkey": "<base64url(ed25519_pubkey)>",
  "challenge": "<base64url(challenge)>",
  "signature": "<base64url(signature)>"
}
```

**Response:**
```json
{ "token": "<session_token>", "expires_at": 1679003600 }
```

### Error Responses

All endpoints return errors in a consistent format:

```json
{
  "error": "<error_code>",
  "message": "<human-readable description>"
}
```

| HTTP Status | Error Code           | Meaning                              |
|-------------|----------------------|--------------------------------------|
| 400         | `bad_request`        | Malformed request body               |
| 401         | `unauthorized`       | Missing, invalid, or expired token   |
| 403         | `challenge_expired`  | Auth challenge has expired (>60s)    |
| 404         | `not_found`          | Unknown pubkey or resource           |
| 413         | `payload_too_large`  | Encrypted blob exceeds 20 MB         |
| 429         | `rate_limited`       | Too many requests                    |
| 500         | `internal_error`     | Server error                         |

#### `GET /poll` — Long poll for new events

The client makes a blocking GET request. The server holds the connection open until new events are available or a timeout is reached.

**Headers:** `Authorization: Bearer <token>`

**Query parameters:**

| Parameter    | Type   | Description                                      |
|--------------|--------|--------------------------------------------------|
| `after`      | string | Cursor from the previous poll response (optional) |

**Response:**
```json
{
  "events": [
    {
      "type": "message",
      "data": { "to": "...", "from": "...", "encrypted_blob": "...", "timestamp": 1679000000 },
      "id": "evt_001"
    }
  ],
  "cursor": "evt_001"
}
```

- If events are available immediately, the server responds right away.
- If no events are available, the server holds the connection for up to 20 seconds.
- On timeout with no events, the server returns `{ "events": [], "cursor": "..." }`.
- The client should immediately issue the next poll after receiving a response.

**Event types:**

| Type       | Data                                |
|------------|-------------------------------------|
| `message`  | Envelope JSON (see §4)             |

#### `POST /messages` — Send a message

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "to": "<base64url(recipient_ed25519_pubkey)>",
  "encrypted_blob": "<base64url(encrypted_blob)>",
  "timestamp": 1679000000
}
```

The server fills in `from` from the authenticated session.

**Response:**
```json
{
  "status": "delivered" | "queued",
  "message_id": "<server_assigned_id>"
}
```

- `delivered` — recipient is online, message was forwarded.
- `queued` — recipient is offline, message is queued for later delivery.

#### `POST /messages/ack` — Acknowledge receipt

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{ "message_ids": ["id1", "id2"] }
```

**Response:**
```json
{ "ok": true }
```

The server deletes acknowledged messages from its queue. If the message arrived via federation, the ACK is forwarded to the origin server so it can also clean up. This is a server-side queue management operation — delivery notification to the sender is handled by encrypted `delivery.ack` messages (see §4).

#### `GET /lookup/:pubkey` — Look up a user's presence

**Response (online):**
```json
{
  "online": true,
  "server": "other-server.example.com"
}
```

**Response (offline):**
```json
{
  "online": false
}
```

---

## 7. Server ↔ Server Protocol

### Mesh Formation

Federation is open. A server joins the mesh by connecting to one or more known peers. No approval is required.

Server operators configure a list of initial peers. When a server starts, it announces itself to its peers, which propagate the announcement. Over time, each server builds a view of the full mesh.

Operators may maintain an optional **blocklist** of server hostnames or IPs to refuse connections from.

### Gossip (Presence Announcements)

When a user connects to or disconnects from a server, the server broadcasts a presence update to all known peers:

**Online:**
```json
{
  "type": "online",
  "pubkey": "<base64url(ed25519_pubkey)>",
  "server": "this-server.example.com",
  "timestamp": 1679000000,
  "ttl": 3600
}
```

**Offline:**
```json
{
  "type": "offline",
  "pubkey": "<base64url(ed25519_pubkey)>",
  "server": "this-server.example.com",
  "timestamp": 1679000000
}
```

Each server maintains a **presence table** — a mapping of public keys to a **set of servers** where they are currently connected. A single pubkey may appear at multiple servers simultaneously (e.g., multiple devices with different keypairs connecting independently, or stale gossip). Presence entries expire after `ttl` seconds if not refreshed.

Gossip messages are forwarded to peers with a decrementing hop counter to prevent infinite propagation.

### Gossip Endpoint

```
POST /federation/gossip
```

**Request:**
```json
{
  "events": [
    { "type": "online", "pubkey": "...", "server": "...", "timestamp": ..., "ttl": ... },
    { "type": "offline", "pubkey": "...", "server": "...", "timestamp": ... }
  ],
  "hops_remaining": 3
}
```

### Message Forwarding

When a server receives a message for a recipient, it checks the presence table. If the pubkey appears at multiple servers, the message is forwarded to **all** of them. This ensures delivery even with stale gossip or multi-server presence.

```
POST /federation/forward
```

**Request:**
```json
{
  "to": "<base64url(recipient_ed25519_pubkey)>",
  "from": "<base64url(sender_ed25519_pubkey)>",
  "encrypted_blob": "<base64url(encrypted_blob)>",
  "timestamp": 1679000000,
  "origin_server": "sender-server.example.com",
  "message_id": "<id>"
}
```

The receiving server delivers the message to the connected client on its next poll.

### ACK Forwarding

When a recipient ACKs a message, the ACK is forwarded back to the origin server so it can delete the queued blob:

```
POST /federation/ack
```

**Request:**
```json
{
  "message_ids": ["id1", "id2"],
  "origin_server": "sender-server.example.com"
}
```

---

## 8. Group Messaging

Groups are a **client-side concept**. Servers are entirely unaware of groups — they see only individual messages between pairs of public keys.

### Group Structure

A group is defined locally on each member's device:

```json
{
  "group_id": "<random_uuid>",
  "group_name": "Weekend Plans",
  "members": [
    "<base64url(pubkey_alice)>",
    "<base64url(pubkey_bob)>",
    "<base64url(pubkey_carol)>"
  ]
}
```

### Sending to a Group

When a user sends a message to a group, the client **fans out** — it encrypts and sends the message individually to each group member. Each fan-out message includes the `group_id` in the plaintext payload so the recipient's client can display it in the correct conversation:

```json
{
  "type": "text",
  "id": "msg_123",
  "timestamp": 1679000000,
  "group_id": "550e8400-e29b-41d4-a716-446655440000",
  "body": "See you Saturday!"
}
```

From the server's perspective, a group message of N members is N separate 1:1 messages.

### Membership Management

- **Invite:** Send a `group.invite` message to the new member containing the group ID, name, and member list.
- **Leave:** Send a `group.leave` message to all remaining members.
- **Update:** Send a `group.update` message to all members when the name or membership changes.

All membership operations are performed by the client. There is no server-side group state, no group admin role enforced by the protocol, and no consensus mechanism. Clients trust the membership updates they receive from other members.

---

## 9. Offline Delivery

### Queuing

When a server receives a message for a recipient who is not currently online (not in the presence table), the **sender's server queues** the encrypted blob.

The sender's server continues to listen to gossip. When a presence announcement indicates the recipient is online at some server, the sender's server forwards the queued message to that server.

### TTL

All messages have a **30-day TTL**, enforced in two places:

- **Server-side:** Queued messages are deleted 30 days after their timestamp. Servers are temporary relays, not long-term storage.
- **Client-side:** Clients MUST delete messages from local storage 30 days after their timestamp. There is no permanent message history.

### Delivery Flow

```
1. Alice sends a message to Bob (offline).
2. Alice's server queues the encrypted blob.
   Returns: { "status": "queued" }

3. ...time passes...

4. Bob connects to Server C.
5. Server C gossips: ONLINE { bob_pubkey, server_c }
6. Alice's server sees the gossip, forwards the queued message to Server C.
7. Server C delivers to Bob on his next poll.
8. Bob's client sends ACK to Server C (queue cleanup).
9. Server C forwards ACK to Alice's server.
10. Alice's server deletes the blob.
11. Bob's client sends an encrypted `delivery.ack` message to Alice.
12. When Alice receives it, she marks the message as delivered.
```

Alice does not need to stay online. Her server handles delivery independently.

### Failure Modes

- If the sender's server goes down before delivering, queued messages are **lost**. This is an accepted tradeoff — servers are disposable.
- If the recipient never comes back online within 30 days, the message is deleted.
- The sender sees `queued` status until ACK is received, at which point it becomes `delivered`.

---

## 10. Security Considerations

### Threat Model

Skrepka protects message **content** from servers and network observers. It does not attempt to hide **metadata**.

### What Is Protected

| Property              | Mechanism                                    |
|-----------------------|----------------------------------------------|
| Message confidentiality | E2E encryption (X25519 + HKDF-SHA256 + XChaCha20-Poly1305) |
| Sender authenticity    | Ed25519 signature on every message           |
| Replay protection      | Unique nonce per message                     |
| Key compromise (partial) | Ephemeral keys per message — past messages whose blobs were already discarded cannot be decrypted even if the recipient's long-term key is compromised |

### What Is NOT Protected

| Risk                         | Details                                             |
|------------------------------|-----------------------------------------------------|
| **No forward secrecy**       | If a message blob is captured *and* the recipient's long-term X25519 key is later compromised, that specific message can be decrypted. No ratchet means no post-compromise recovery. |
| **Metadata exposure**        | Servers see `{to, from, timestamp}` in the envelope. They know who is talking to whom and when. Message size is also visible. |
| **Presence gossip leaks location** | All servers in the mesh learn which server a user is connected to. |
| **No durable delivery**      | If the sender's server goes down, queued messages are lost. |
| **No server authentication** | Servers are not authenticated to each other by default. A malicious server could join the mesh and observe gossip. |
| **Group membership visible to members** | Group member lists are shared in plaintext among members. A compromised member reveals the full group. |

### Recommendations for Implementers

- Store private keys in platform-secure storage (Keychain, Keystore, etc.).
- Warn users when a contact's public key changes (TOFU violation).
- Consider pinning server TLS certificates for additional transport security.
- Implement rate limiting on server endpoints to mitigate spam.
- Servers SHOULD delete message blobs immediately after successful delivery and ACK.
