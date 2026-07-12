//! Byte-exact port of the skrepka message crypto (see PROTOCOL.md §3).
//!
//! Per-message: ephemeral X25519, HKDF-SHA256, XChaCha20-Poly1305, Ed25519
//! signature bound to the recipient, zstd-compressed plaintext.
//!
//! The Ed25519 secret key is the 64-byte libsodium form: `seed(32) || pub(32)`.
//! The X25519 keys are derived from Ed25519 the same way libsodium's
//! `crypto_sign_ed25519_{pk,sk}_to_curve25519` do, so blobs interoperate with
//! any client following the spec.
//!
//! Everything an attacker controls is bounded here, because this is the first
//! code a hostile relay or peer reaches: the blob is length-capped before any
//! work is done on it, and the zstd frame inside is decompressed through a
//! limited reader so a compression bomb cannot exhaust memory.

use std::io::Read;

use chacha20poly1305::aead::Aead;
use chacha20poly1305::{Key, KeyInit, XChaCha20Poly1305, XNonce};
use curve25519_dalek::edwards::CompressedEdwardsY;
use ed25519_dalek::{Signer, SigningKey, Verifier, VerifyingKey};
use hkdf::Hkdf;
use rand_core::{CryptoRng, RngCore};
use sha2::{Digest, Sha256, Sha512};
use zeroize::{Zeroize, ZeroizeOnDrop, Zeroizing};

/// HKDF `info` string (PROTOCOL.md §3 / Constants.hkdfInfo). Fixed.
const HKDF_INFO: &[u8] = b"skrepka-v1";
/// Domain-separation tag for the auth challenge signature (PROTOCOL.md §6).
const AUTH_TAG: &str = "skrepka-auth-v1:";

/// Wire-format version byte prepended to every encrypted blob (PROTOCOL.md §3).
const WIRE_VERSION: u8 = 1;

pub const ED25519_SECRET_LEN: usize = 64;
pub const ED25519_PUBLIC_LEN: usize = 32;
pub const NONCE_LEN: usize = 24;
/// 1 (version) + 32 (eph) + 24 (nonce) + 32 (sender pub) + 64 (sig) + 4 (compressed_len)
/// + 16 (AEAD tag). The 4-byte compressed_len field sits inside the AEAD ciphertext.
pub const MIN_BLOB_LEN: usize = 1 + 32 + NONCE_LEN + 32 + 64 + 4 + 16;

/// Blob sizes are padded up to these boundaries so the on-wire length does not
/// reveal the exact plaintext (compressed) size to relays and network observers.
/// Below 65536 we round up to the nearest bucket; above it we round to the next
/// multiple of 65536 (MAX_BLOB_LEN is exactly 672 × 65536, so we never exceed it).
const PADDING_BUCKETS: [usize; 9] = [256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536];

/// Round `actual` up to the nearest padding boundary.
fn padded_len(actual: usize) -> usize {
    if actual == 0 {
        return PADDING_BUCKETS[0];
    }
    for &bucket in &PADDING_BUCKETS {
        if actual <= bucket {
            return bucket;
        }
    }
    // Above 65536: round to the next multiple of 65536.
    let remainder = actual % 65536;
    if remainder == 0 {
        actual
    } else {
        actual + 65536 - remainder
    }
}
/// Upper bound on a blob we will even attempt to decrypt, in *decoded* bytes —
/// rejected on length before it costs us a scalar mult or an AEAD pass.
///
/// Deliberately looser than the reference relay rather than equal to it: that
/// relay's `maxBlobLen` (41943040) bounds the *hex* string, i.e. ~20 MiB decoded,
/// so no blob it serves comes close to this. Sizing the client's ceiling to one
/// relay's would make us reject blobs a differently-configured relay may legally
/// deliver, and it buys no safety — the real bounds on attacker-controlled work
/// are `MAX_POLL_TOTAL_BYTES` (the page) and `MAX_PLAINTEXT_LEN` (the
/// decompression), both of which hold whatever this is set to.
pub const MAX_BLOB_LEN: usize = 42 * 1024 * 1024;
/// Upper bound on the *decompressed* plaintext inside a blob.
///
/// `zstd` frames advertise their content size, but a hostile peer can lie or
/// simply craft a small frame that expands to gigabytes. Without a cap the
/// decoder happily allocates all of it and iOS jetsams the app. Payloads are
/// JSON (text bodies, a base64 avatar at worst), so 1 MiB is generous.
pub const MAX_PLAINTEXT_LEN: usize = 1 << 20;
/// Upper bound on a server-supplied auth challenge we are willing to sign.
/// We sign whatever the relay hands us, so it must not be able to make us sign
/// an arbitrarily large blob of its choosing.
pub const MAX_CHALLENGE_LEN: usize = 256;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CryptoError {
    BadKeyLength,
    BlobTooShort,
    BlobTooLong,
    /// A 32-byte key that is not a valid curve point.
    InvalidPublicKey,
    /// The X25519 exchange produced an all-zero shared secret (low-order point).
    InvalidEphemeralKey,
    Encrypt,
    Decrypt,
    BadSignature,
    Decompress,
    ChallengeTooLong,
}

impl std::fmt::Display for CryptoError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            CryptoError::BadKeyLength => "bad key length",
            CryptoError::BlobTooShort => "blob too short",
            CryptoError::BlobTooLong => "blob too long",
            CryptoError::InvalidPublicKey => "invalid public key",
            CryptoError::InvalidEphemeralKey => "invalid ephemeral key",
            CryptoError::Encrypt => "encryption failed",
            CryptoError::Decrypt => "decryption failed",
            CryptoError::BadSignature => "signature verification failed",
            CryptoError::Decompress => "decompression failed",
            CryptoError::ChallengeTooLong => "auth challenge too long",
        };
        f.write_str(s)
    }
}

impl std::error::Error for CryptoError {}

/// A generated identity: the 64-byte libsodium-form secret key. The public key
/// is the last 32 bytes.
///
/// `ZeroizeOnDrop` wipes the seed when the value goes away. `Identity` is cloned
/// freely (once per encrypt/decrypt), so each of those copies is wiped too.
#[derive(Clone, ZeroizeOnDrop)]
pub struct Identity {
    pub secret_key: [u8; ED25519_SECRET_LEN],
}

impl Identity {
    /// Build from a 64-byte secret key (e.g. loaded from the Keychain).
    ///
    /// The trailing 32 bytes are *claimed* to be the public key; we re-derive it
    /// from the seed and check. A mismatched pair would otherwise sign under one
    /// key while advertising another — every message we send would be silently
    /// unverifiable at the recipient.
    pub fn from_secret_bytes(bytes: &[u8]) -> Result<Self, CryptoError> {
        if bytes.len() != ED25519_SECRET_LEN {
            return Err(CryptoError::BadKeyLength);
        }
        let mut secret_key = [0u8; ED25519_SECRET_LEN];
        secret_key.copy_from_slice(bytes);

        let mut seed = Zeroizing::new([0u8; 32]);
        seed.copy_from_slice(&secret_key[..32]);
        let derived = SigningKey::from_bytes(&seed);
        if derived.verifying_key().as_bytes() != &secret_key[32..] {
            secret_key.zeroize();
            return Err(CryptoError::BadKeyLength);
        }

        Ok(Identity { secret_key })
    }

    /// Generate a fresh identity from a CSPRNG.
    pub fn generate(rng: &mut (impl RngCore + CryptoRng)) -> Self {
        let mut seed = Zeroizing::new([0u8; 32]);
        rng.fill_bytes(&mut *seed);
        Self::from_seed(&seed)
    }

    /// Build the 64-byte secret key (`seed || pub`) from a 32-byte seed.
    pub fn from_seed(seed: &[u8; 32]) -> Self {
        let signing = SigningKey::from_bytes(seed);
        let public = signing.verifying_key();
        let mut secret_key = [0u8; ED25519_SECRET_LEN];
        secret_key[..32].copy_from_slice(seed);
        secret_key[32..].copy_from_slice(public.as_bytes());
        Identity { secret_key }
    }

    pub fn public_key(&self) -> [u8; ED25519_PUBLIC_LEN] {
        let mut pk = [0u8; ED25519_PUBLIC_LEN];
        pk.copy_from_slice(&self.secret_key[32..]);
        pk
    }

    pub fn public_key_hex(&self) -> String {
        hex::encode(self.public_key())
    }

    fn signing_key(&self) -> SigningKey {
        let mut seed = Zeroizing::new([0u8; 32]);
        seed.copy_from_slice(&self.secret_key[..32]);
        SigningKey::from_bytes(&seed)
    }

    /// Sign the auth challenge: `ed25519(sk, "skrepka-auth-v1:" + host + ":" + challenge)`.
    /// `server_host` must already be the bare lowercased hostname.
    ///
    /// The challenge comes straight off the wire from a relay we have not
    /// authenticated, so its length is bounded before it goes into the hash.
    pub fn sign_challenge(&self, server_host: &str, challenge: &str) -> Result<String, CryptoError> {
        if challenge.len() > MAX_CHALLENGE_LEN {
            return Err(CryptoError::ChallengeTooLong);
        }
        let message = format!("{AUTH_TAG}{server_host}:{challenge}");
        let sig = self.signing_key().sign(message.as_bytes());
        Ok(hex::encode(sig.to_bytes()))
    }
}

/// libsodium `crypto_sign_ed25519_pk_to_curve25519`: Edwards Y -> Montgomery u.
fn ed25519_pk_to_x25519(ed_pub: &[u8; 32]) -> Result<[u8; 32], CryptoError> {
    let compressed = CompressedEdwardsY(*ed_pub);
    let point = compressed
        .decompress()
        .ok_or(CryptoError::InvalidPublicKey)?;
    Ok(point.to_montgomery().to_bytes())
}

/// libsodium `crypto_sign_ed25519_sk_to_curve25519`: clamp(SHA-512(seed)[..32]).
fn ed25519_sk_to_x25519(secret_key: &[u8; 64]) -> Zeroizing<[u8; 32]> {
    let mut h = Sha512::new();
    h.update(&secret_key[..32]);
    let mut digest = h.finalize();
    let mut scalar = Zeroizing::new([0u8; 32]);
    scalar.copy_from_slice(&digest[..32]);
    digest.as_mut_slice().zeroize();
    // X25519 clamp.
    scalar[0] &= 248;
    scalar[31] &= 127;
    scalar[31] |= 64;
    scalar
}

/// Raw X25519 scalar multiplication (no hashing), as libsodium `crypto_scalarmult`.
///
/// An all-zero output means the peer supplied a low-order point: every scalar
/// then yields the same shared secret, so the "encryption" would be forgeable by
/// anyone. libsodium's `crypto_scalarmult` rejects this and so do we.
fn x25519(scalar: &[u8; 32], point: &[u8; 32]) -> Result<Zeroizing<[u8; 32]>, CryptoError> {
    let shared = Zeroizing::new(x25519_dalek::x25519(*scalar, *point));
    if shared.iter().all(|b| *b == 0) {
        return Err(CryptoError::InvalidEphemeralKey);
    }
    Ok(shared)
}

/// HKDF-SHA256(ikm=raw_secret, salt=eph_pub || recip_x_pub, info="skrepka-v1", 32).
fn derive_key(
    raw_secret: &[u8; 32],
    eph_pub: &[u8; 32],
    recip_x_pub: &[u8; 32],
) -> Zeroizing<[u8; 32]> {
    let mut salt = [0u8; 64];
    salt[..32].copy_from_slice(eph_pub);
    salt[32..].copy_from_slice(recip_x_pub);
    let hk = Hkdf::<Sha256>::new(Some(&salt), raw_secret);
    let mut okm = Zeroizing::new([0u8; 32]);
    hk.expand(HKDF_INFO, &mut *okm)
        .expect("32 is a valid length");
    okm
}

fn compress(plaintext: &[u8]) -> Vec<u8> {
    // zstd frame with embedded content size; decodable without a capacity hint.
    zstd::encode_all(plaintext, 0).expect("zstd compression is infallible for in-memory input")
}

/// Decompress a zstd frame, refusing to produce more than `MAX_PLAINTEXT_LEN`.
///
/// `zstd::decode_all` grows its output buffer to whatever the frame expands to,
/// which is attacker-chosen. Streaming through a `take`-limited reader bounds
/// the allocation instead: we read one byte past the cap so that a frame which
/// *would* overrun is detected rather than silently truncated.
fn decompress(data: &[u8]) -> Result<Vec<u8>, CryptoError> {
    let mut decoder = zstd::stream::Decoder::new(data).map_err(|_| CryptoError::Decompress)?;
    let mut out = Vec::new();
    (&mut decoder)
        .take(MAX_PLAINTEXT_LEN as u64 + 1)
        .read_to_end(&mut out)
        .map_err(|_| CryptoError::Decompress)?;
    if out.len() > MAX_PLAINTEXT_LEN {
        return Err(CryptoError::Decompress);
    }
    Ok(out)
}

/// Encrypt `plaintext` for `recipient_ed_pub` (32-byte Ed25519 pubkey).
/// Returns the on-wire blob: `eph_pub(32) || nonce(24) || ciphertext`.
pub fn encrypt(
    rng: &mut (impl RngCore + CryptoRng),
    sender: &Identity,
    recipient_ed_pub: &[u8; 32],
    plaintext: &[u8],
) -> Result<Vec<u8>, CryptoError> {
    let sender_pub = sender.public_key();

    // Ephemeral raw X25519 keypair (libsodium crypto_box_keypair).
    let mut eph_priv = Zeroizing::new([0u8; 32]);
    rng.fill_bytes(&mut *eph_priv);
    let eph_pub = x25519_dalek::x25519(*eph_priv, x25519_dalek::X25519_BASEPOINT_BYTES);

    let recip_x = ed25519_pk_to_x25519(recipient_ed_pub)?;
    let raw_secret = x25519(&eph_priv, &recip_x)?;
    let key = derive_key(&raw_secret, &eph_pub, &recip_x);

    let compressed = compress(plaintext);

    // Compute padding: round the full on-wire blob size up to a bucket boundary
    // so relays and network observers cannot tell the exact (compressed) length.
    // unpadded = 1 (version) + 32 (eph_pub) + 24 (nonce) + inner + 16 (AEAD tag)
    //          = 1 + 32 + 24 + (32 + 64 + 4 + compressed.len()) + 16
    //          = 173 + compressed.len()
    let unpadded_blob_len = 1 + 32 + NONCE_LEN + 32 + 64 + 4 + compressed.len() + 16;
    let target = padded_len(unpadded_blob_len);
    let pad_len = target - unpadded_blob_len;

    let mut padding = vec![0u8; pad_len];
    rng.fill_bytes(&mut padding);

    let compressed_len_bytes = (compressed.len() as u32).to_be_bytes();

    // Sign recipient_pub || compressed_len_bytes || compressed || padding
    // (i.e. recipient_pub || everything after the 96-byte header in inner).
    let mut signed = Vec::with_capacity(32 + 4 + compressed.len() + padding.len());
    signed.extend_from_slice(recipient_ed_pub);
    signed.extend_from_slice(&compressed_len_bytes);
    signed.extend_from_slice(&compressed);
    signed.extend_from_slice(&padding);
    let signature = sender.signing_key().sign(&signed);

    // inner = sender_pub(32) || sig(64) || compressed_len(4) || compressed || padding
    let mut inner = Vec::with_capacity(32 + 64 + 4 + compressed.len() + padding.len());
    inner.extend_from_slice(&sender_pub);
    inner.extend_from_slice(&signature.to_bytes());
    inner.extend_from_slice(&compressed_len_bytes);
    inner.extend_from_slice(&compressed);
    inner.extend_from_slice(&padding);

    let mut nonce = [0u8; NONCE_LEN];
    rng.fill_bytes(&mut nonce);
    let cipher = XChaCha20Poly1305::new(Key::from_slice(&*key));
    let ciphertext = cipher
        .encrypt(XNonce::from_slice(&nonce), inner.as_ref())
        .map_err(|_| CryptoError::Encrypt)?;
    inner.zeroize();

    let mut blob = Vec::with_capacity(1 + 32 + NONCE_LEN + ciphertext.len());
    blob.push(WIRE_VERSION);
    blob.extend_from_slice(&eph_pub);
    blob.extend_from_slice(&nonce);
    blob.extend_from_slice(&ciphertext);
    Ok(blob)
}

/// Result of decrypting a blob: the plaintext and the sender's Ed25519 pubkey (hex).
#[derive(Debug, Clone)]
pub struct Decrypted {
    pub plaintext: Vec<u8>,
    pub sender_hex: String,
}

/// Decrypt a blob addressed to `recipient`. Verifies the sender's signature.
pub fn decrypt(recipient: &Identity, blob: &[u8]) -> Result<Decrypted, CryptoError> {
    if blob.len() < MIN_BLOB_LEN {
        return Err(CryptoError::BlobTooShort);
    }
    if blob.len() > MAX_BLOB_LEN {
        return Err(CryptoError::BlobTooLong);
    }
    // Version byte — reject any blob we don't know how to handle.
    if blob[0] != WIRE_VERSION {
        return Err(CryptoError::Decrypt);
    }
    let mut eph_pub = [0u8; 32];
    eph_pub.copy_from_slice(&blob[1..33]);
    let mut nonce = [0u8; NONCE_LEN];
    nonce.copy_from_slice(&blob[33..33 + NONCE_LEN]);
    let ciphertext = &blob[33 + NONCE_LEN..];

    let recip_x_priv = ed25519_sk_to_x25519(&recipient.secret_key);
    let raw_secret = x25519(&recip_x_priv, &eph_pub)?;
    let recip_x_pub = ed25519_pk_to_x25519(&recipient.public_key())?;
    let key = derive_key(&raw_secret, &eph_pub, &recip_x_pub);

    let cipher = XChaCha20Poly1305::new(Key::from_slice(&*key));
    let mut inner = cipher
        .decrypt(XNonce::from_slice(&nonce), ciphertext)
        .map_err(|_| CryptoError::Decrypt)?;

    if inner.len() < 32 + 64 + 4 {
        inner.zeroize();
        return Err(CryptoError::BlobTooShort);
    }
    let mut sender_pub = [0u8; 32];
    sender_pub.copy_from_slice(&inner[..32]);
    let mut sig_bytes = [0u8; 64];
    sig_bytes.copy_from_slice(&inner[32..96]);

    let compressed_len = u32::from_be_bytes([
        inner[96],
        inner[97],
        inner[98],
        inner[99],
    ]) as usize;
    if 100 + compressed_len > inner.len() {
        inner.zeroize();
        return Err(CryptoError::Decrypt);
    }
    let compressed = &inner[100..100 + compressed_len];

    // Verify signature over recipient_pub || inner[96..]
    // (covers compressed_len_bytes || compressed || padding).
    let verifying = VerifyingKey::from_bytes(&sender_pub).map_err(|_| CryptoError::BadSignature)?;
    let signature = ed25519_dalek::Signature::from_bytes(&sig_bytes);
    let mut signed = Vec::with_capacity(32 + (inner.len() - 96));
    signed.extend_from_slice(&recipient.public_key());
    signed.extend_from_slice(&inner[96..]);
    verifying
        .verify(&signed, &signature)
        .map_err(|_| CryptoError::BadSignature)?;

    let plaintext = decompress(compressed)?;
    Ok(Decrypted {
        plaintext,
        sender_hex: hex::encode(sender_pub),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand_chacha::rand_core::SeedableRng;
    use rand_chacha::ChaCha20Rng;

    fn rng(seed: u64) -> ChaCha20Rng {
        ChaCha20Rng::seed_from_u64(seed)
    }

    #[test]
    fn identity_pub_is_last_32_bytes_and_consistent() {
        let id = Identity::generate(&mut rng(1));
        assert_eq!(&id.secret_key[32..], &id.public_key());
        // Re-deriving from the seed yields the same public key.
        let mut seed = [0u8; 32];
        seed.copy_from_slice(&id.secret_key[..32]);
        let id2 = Identity::from_seed(&seed);
        assert_eq!(id.public_key(), id2.public_key());
    }

    /// A 64-byte key whose trailing pubkey doesn't match its seed would sign
    /// under one identity while claiming another.
    #[test]
    fn from_secret_bytes_rejects_a_seed_pubkey_mismatch() {
        let id = Identity::from_seed(&[3u8; 32]);
        assert!(Identity::from_secret_bytes(&id.secret_key).is_ok());

        let mut tampered = id.secret_key;
        tampered[32] ^= 0x01; // claim a different public key
        assert!(matches!(
            Identity::from_secret_bytes(&tampered),
            Err(CryptoError::BadKeyLength)
        ));
    }

    #[test]
    fn round_trip_recovers_plaintext_and_sender() {
        let alice = Identity::generate(&mut rng(10));
        let bob = Identity::generate(&mut rng(20));
        let msg = br#"{"type":"text","id":"abc","body":"hello bob","ts":1700000000000}"#;

        let blob = encrypt(&mut rng(99), &alice, &bob.public_key(), msg).unwrap();
        assert!(blob.len() >= MIN_BLOB_LEN);

        let out = decrypt(&bob, &blob).unwrap();
        assert_eq!(out.plaintext, msg);
        assert_eq!(out.sender_hex, alice.public_key_hex());
    }

    #[test]
    fn wrong_recipient_cannot_decrypt() {
        let alice = Identity::generate(&mut rng(1));
        let bob = Identity::generate(&mut rng(2));
        let eve = Identity::generate(&mut rng(3));
        let blob = encrypt(&mut rng(4), &alice, &bob.public_key(), b"secret").unwrap();
        assert_eq!(decrypt(&eve, &blob).unwrap_err(), CryptoError::Decrypt);
    }

    #[test]
    fn tampered_ciphertext_is_rejected() {
        let alice = Identity::generate(&mut rng(1));
        let bob = Identity::generate(&mut rng(2));
        let mut blob = encrypt(&mut rng(4), &alice, &bob.public_key(), b"secret").unwrap();
        let last = blob.len() - 1;
        blob[last] ^= 0xff;
        assert!(decrypt(&bob, &blob).is_err());
    }

    #[test]
    fn blob_layout_offsets() {
        let alice = Identity::generate(&mut rng(1));
        let bob = Identity::generate(&mut rng(2));
        let blob = encrypt(&mut rng(7), &alice, &bob.public_key(), b"x").unwrap();
        // Version byte at offset 0.
        assert_eq!(blob[0], WIRE_VERSION);
        // eph_pub occupies bytes 1..33 and equals x25519 basepoint * eph_priv;
        // we can't recompute eph_priv, but the nonce region must differ run-to-run.
        let blob2 = encrypt(&mut rng(8), &alice, &bob.public_key(), b"x").unwrap();
        assert_ne!(&blob[1..33], &blob2[1..33], "ephemeral pubkey must be random");
        assert_ne!(
            &blob[33..33 + NONCE_LEN],
            &blob2[33..33 + NONCE_LEN],
            "nonce must be random"
        );
    }

    #[test]
    fn too_short_blob_errors() {
        let bob = Identity::generate(&mut rng(2));
        assert_eq!(
            decrypt(&bob, &[0u8; 10]).unwrap_err(),
            CryptoError::BlobTooShort
        );
    }

    /// An oversized blob is rejected on length alone — before it costs us a
    /// scalar mult, an AEAD pass, or a decompression.
    #[test]
    fn too_long_blob_errors() {
        let bob = Identity::generate(&mut rng(2));
        let huge = vec![0u8; MAX_BLOB_LEN + 1];
        assert_eq!(decrypt(&bob, &huge).unwrap_err(), CryptoError::BlobTooLong);
    }

    /// The decompression bomb: a small zstd frame that expands past the cap must
    /// error out rather than allocate its way to a jetsam kill.
    #[test]
    fn a_decompression_bomb_is_refused() {
        let bomb = compress(&vec![0u8; MAX_PLAINTEXT_LEN + 1]);
        assert!(
            bomb.len() < 4096,
            "the frame really is small ({} bytes)",
            bomb.len()
        );
        assert_eq!(decompress(&bomb).unwrap_err(), CryptoError::Decompress);

        // ...and the same bomb wrapped in a well-formed, correctly signed blob
        // (i.e. from a real peer) dies at the same wall.
        let alice = Identity::generate(&mut rng(1));
        let bob = Identity::generate(&mut rng(2));
        let blob = encrypt(
            &mut rng(3),
            &alice,
            &bob.public_key(),
            &vec![0u8; MAX_PLAINTEXT_LEN + 1],
        )
        .unwrap();
        assert_eq!(decrypt(&bob, &blob).unwrap_err(), CryptoError::Decompress);
    }

    /// A plaintext right at the cap still round-trips: the bound is inclusive.
    #[test]
    fn a_plaintext_at_the_cap_still_round_trips() {
        let alice = Identity::generate(&mut rng(1));
        let bob = Identity::generate(&mut rng(2));
        let msg = vec![7u8; MAX_PLAINTEXT_LEN];
        let blob = encrypt(&mut rng(3), &alice, &bob.public_key(), &msg).unwrap();
        assert_eq!(decrypt(&bob, &blob).unwrap().plaintext, msg);
    }

    /// A low-order ephemeral point makes every recipient derive the same shared
    /// secret, so the sender's "encryption" is forgeable. Reject it.
    #[test]
    fn a_low_order_ephemeral_point_is_rejected() {
        let bob = Identity::generate(&mut rng(2));
        // eph_pub = 0 is the canonical low-order point; x25519 with it yields
        // an all-zero shared secret for any scalar.
        let mut blob = vec![0u8; MIN_BLOB_LEN + 1];
        blob[0] = WIRE_VERSION;
        blob[1..33].fill(0);
        assert_eq!(
            decrypt(&bob, &blob).unwrap_err(),
            CryptoError::InvalidEphemeralKey
        );
    }

    /// A short message must be padded so the blob size lands on a bucket boundary.
    #[test]
    fn blob_is_padded_to_bucket_size() {
        let alice = Identity::generate(&mut rng(1));
        let bob = Identity::generate(&mut rng(2));

        // Short message → should round up to the smallest bucket (256).
        let blob_small = encrypt(&mut rng(7), &alice, &bob.public_key(), b"x").unwrap();
        assert!(
            PADDING_BUCKETS.contains(&blob_small.len()),
            "blob len {} is not a bucket boundary",
            blob_small.len()
        );
        assert_eq!(blob_small.len(), 256);

        // A larger message should also land on a bucket boundary.
        let large_msg = vec![0u8; 300];
        let blob_large = encrypt(&mut rng(8), &alice, &bob.public_key(), &large_msg).unwrap();
        assert!(
            PADDING_BUCKETS.contains(&blob_large.len()) || blob_large.len() % 65536 == 0,
            "blob len {} is not a bucket boundary",
            blob_large.len()
        );
    }

    /// The same plaintext encrypted with different RNG seeds must produce the
    /// same blob size (same bucket) but different blob contents (random padding).
    #[test]
    fn padding_is_random_per_message() {
        let alice = Identity::generate(&mut rng(1));
        let bob = Identity::generate(&mut rng(2));
        let msg = b"hello bob, this is a test message";

        let blob1 = encrypt(&mut rng(100), &alice, &bob.public_key(), msg).unwrap();
        let blob2 = encrypt(&mut rng(200), &alice, &bob.public_key(), msg).unwrap();

        // Same bucket → same size.
        assert_eq!(blob1.len(), blob2.len(), "same plaintext must have same blob size");

        // Different RNG → different ephemeral key, nonce, and padding → different bytes.
        assert_ne!(&blob1[..], &blob2[..], "different RNG must produce different blobs");

        // Both must decrypt correctly.
        assert_eq!(decrypt(&bob, &blob1).unwrap().plaintext, msg);
        assert_eq!(decrypt(&bob, &blob2).unwrap().plaintext, msg);
    }

    /// The compressed_len field must be parsed correctly so the decompressor
    /// never sees trailing padding bytes.
    #[test]
    fn compressed_len_field_is_parsed_correctly() {
        let alice = Identity::generate(&mut rng(1));
        let bob = Identity::generate(&mut rng(2));

        // Normal round-trip.
        let msg = b"round trip test with some content";
        let blob = encrypt(&mut rng(7), &alice, &bob.public_key(), msg).unwrap();
        assert_eq!(decrypt(&bob, &blob).unwrap().plaintext, msg);

        // A message whose compressed size happens to produce a blob that lands
        // exactly on a bucket boundary (zero padding). We can't easily engineer
        // this, but we can verify the decrypt path works with the actual data.
        // Just verify that every bucket-sized blob round-trips.
        for size in [1usize, 10, 100, 200, 500, 1000, 5000] {
            let m = vec![0xABu8; size];
            let b = encrypt(&mut rng(42), &alice, &bob.public_key(), &m).unwrap();
            assert_eq!(decrypt(&bob, &b).unwrap().plaintext, m.to_vec());
        }
    }

    /// A recipient key that isn't a curve point can't be encrypted to, and the
    /// error says so rather than blaming decryption.
    #[test]
    fn encrypting_to_an_off_curve_key_reports_an_invalid_public_key() {
        let alice = Identity::generate(&mut rng(1));
        let not_a_point = [0xabu8; 32];
        assert_eq!(
            encrypt(&mut rng(2), &alice, &not_a_point, b"x").unwrap_err(),
            CryptoError::InvalidPublicKey
        );
    }

    #[test]
    fn sk_to_x25519_clamps() {
        let id = Identity::generate(&mut rng(5));
        let scalar = ed25519_sk_to_x25519(&id.secret_key);
        assert_eq!(scalar[0] & 7, 0);
        assert_eq!(scalar[31] & 64, 64);
        assert_eq!(scalar[31] & 128, 0);
    }

    #[test]
    fn challenge_signature_is_deterministic_and_host_bound() {
        let id = Identity::from_seed(&[7u8; 32]);
        let a = id.sign_challenge("relay.example.com", "deadbeef").unwrap();
        let b = id.sign_challenge("relay.example.com", "deadbeef").unwrap();
        let c = id.sign_challenge("other.example.com", "deadbeef").unwrap();
        assert_eq!(a, b, "Ed25519 is deterministic");
        assert_ne!(a, c, "signature is bound to the host");
        assert_eq!(a.len(), 128, "64-byte sig in hex");
    }

    /// We sign whatever a not-yet-trusted relay hands us, so its size is bounded.
    #[test]
    fn an_oversized_challenge_is_not_signed() {
        let id = Identity::from_seed(&[7u8; 32]);
        let huge = "a".repeat(MAX_CHALLENGE_LEN + 1);
        assert_eq!(
            id.sign_challenge("relay.example.com", &huge).unwrap_err(),
            CryptoError::ChallengeTooLong
        );
        // The bound itself is inclusive.
        let at_cap = "a".repeat(MAX_CHALLENGE_LEN);
        assert!(id.sign_challenge("relay.example.com", &at_cap).is_ok());
    }
}
