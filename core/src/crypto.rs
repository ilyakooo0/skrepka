//! Byte-exact port of the skrepka message crypto (see PROTOCOL.md §3).
//!
//! Per-message: ephemeral X25519, HKDF-SHA256, XChaCha20-Poly1305, Ed25519
//! signature bound to the recipient, zstd-compressed plaintext.
//!
//! The Ed25519 secret key is the 64-byte libsodium form: `seed(32) || pub(32)`.
//! The X25519 keys are derived from Ed25519 the same way libsodium's
//! `crypto_sign_ed25519_{pk,sk}_to_curve25519` do, so blobs interoperate with
//! any client following the spec.

use chacha20poly1305::aead::Aead;
use chacha20poly1305::{KeyInit, XChaCha20Poly1305, XNonce};
use curve25519_dalek::edwards::CompressedEdwardsY;
use ed25519_dalek::{Signer, SigningKey, Verifier, VerifyingKey};
use hkdf::Hkdf;
use rand_core::{CryptoRng, RngCore};
use sha2::{Digest, Sha256, Sha512};

/// HKDF `info` string (PROTOCOL.md §3 / Constants.hkdfInfo). Fixed.
const HKDF_INFO: &[u8] = b"skrepka-v1";
/// Domain-separation tag for the auth challenge signature (PROTOCOL.md §6).
const AUTH_TAG: &str = "skrepka-auth-v1:";

pub const ED25519_SECRET_LEN: usize = 64;
pub const ED25519_PUBLIC_LEN: usize = 32;
pub const NONCE_LEN: usize = 24;
/// 32 (eph) + 24 (nonce) + 32 (sender pub) + 64 (sig) + 16 (AEAD tag).
pub const MIN_BLOB_LEN: usize = 32 + NONCE_LEN + 32 + 64 + 16;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CryptoError {
    BadKeyLength,
    BlobTooShort,
    Decrypt,
    BadSignature,
    Decompress,
}

impl std::fmt::Display for CryptoError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            CryptoError::BadKeyLength => "bad key length",
            CryptoError::BlobTooShort => "blob too short",
            CryptoError::Decrypt => "decryption failed",
            CryptoError::BadSignature => "signature verification failed",
            CryptoError::Decompress => "decompression failed",
        };
        f.write_str(s)
    }
}

impl std::error::Error for CryptoError {}

/// A generated identity: the 64-byte libsodium-form secret key. The public key
/// is the last 32 bytes.
#[derive(Clone)]
pub struct Identity {
    pub secret_key: [u8; ED25519_SECRET_LEN],
}

impl Identity {
    /// Build from a 64-byte secret key (e.g. loaded from the Keychain).
    pub fn from_secret_bytes(bytes: &[u8]) -> Result<Self, CryptoError> {
        if bytes.len() != ED25519_SECRET_LEN {
            return Err(CryptoError::BadKeyLength);
        }
        let mut secret_key = [0u8; ED25519_SECRET_LEN];
        secret_key.copy_from_slice(bytes);
        Ok(Identity { secret_key })
    }

    /// Generate a fresh identity from a CSPRNG.
    pub fn generate(rng: &mut (impl RngCore + CryptoRng)) -> Self {
        let mut seed = [0u8; 32];
        rng.fill_bytes(&mut seed);
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
        let mut seed = [0u8; 32];
        seed.copy_from_slice(&self.secret_key[..32]);
        SigningKey::from_bytes(&seed)
    }

    /// Sign the auth challenge: `ed25519(sk, "skrepka-auth-v1:" + host + ":" + challenge)`.
    /// `server_host` must already be the bare lowercased hostname.
    pub fn sign_challenge(&self, server_host: &str, challenge: &str) -> String {
        let message = format!("{AUTH_TAG}{server_host}:{challenge}");
        let sig = self.signing_key().sign(message.as_bytes());
        hex::encode(sig.to_bytes())
    }
}

/// libsodium `crypto_sign_ed25519_pk_to_curve25519`: Edwards Y -> Montgomery u.
fn ed25519_pk_to_x25519(ed_pub: &[u8; 32]) -> Result<[u8; 32], CryptoError> {
    let compressed = CompressedEdwardsY(*ed_pub);
    let point = compressed.decompress().ok_or(CryptoError::Decrypt)?;
    Ok(point.to_montgomery().to_bytes())
}

/// libsodium `crypto_sign_ed25519_sk_to_curve25519`: clamp(SHA-512(seed)[..32]).
fn ed25519_sk_to_x25519(secret_key: &[u8; 64]) -> [u8; 32] {
    let mut h = Sha512::new();
    h.update(&secret_key[..32]);
    let digest = h.finalize();
    let mut scalar = [0u8; 32];
    scalar.copy_from_slice(&digest[..32]);
    // X25519 clamp.
    scalar[0] &= 248;
    scalar[31] &= 127;
    scalar[31] |= 64;
    scalar
}

/// Raw X25519 scalar multiplication (no hashing), as libsodium `crypto_scalarmult`.
fn x25519(scalar: &[u8; 32], point: &[u8; 32]) -> [u8; 32] {
    x25519_dalek::x25519(*scalar, *point)
}

/// HKDF-SHA256(ikm=raw_secret, salt=eph_pub || recip_x_pub, info="skrepka-v1", 32).
fn derive_key(raw_secret: &[u8; 32], eph_pub: &[u8; 32], recip_x_pub: &[u8; 32]) -> [u8; 32] {
    let mut salt = [0u8; 64];
    salt[..32].copy_from_slice(eph_pub);
    salt[32..].copy_from_slice(recip_x_pub);
    let hk = Hkdf::<Sha256>::new(Some(&salt), raw_secret);
    let mut okm = [0u8; 32];
    hk.expand(HKDF_INFO, &mut okm).expect("32 is a valid length");
    okm
}

fn compress(plaintext: &[u8]) -> Vec<u8> {
    // zstd frame with embedded content size; decodable without a capacity hint.
    zstd::encode_all(plaintext, 0).expect("zstd compression is infallible for in-memory input")
}

fn decompress(data: &[u8]) -> Result<Vec<u8>, CryptoError> {
    zstd::decode_all(data).map_err(|_| CryptoError::Decompress)
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
    let mut eph_priv = [0u8; 32];
    rng.fill_bytes(&mut eph_priv);
    let eph_pub = x25519_dalek::x25519(eph_priv, x25519_dalek::X25519_BASEPOINT_BYTES);

    let recip_x = ed25519_pk_to_x25519(recipient_ed_pub)?;
    let raw_secret = x25519(&eph_priv, &recip_x);
    let key = derive_key(&raw_secret, &eph_pub, &recip_x);

    let compressed = compress(plaintext);

    // Sign recipient_pub || compressed (binds the blob to the recipient).
    let mut signed = Vec::with_capacity(32 + compressed.len());
    signed.extend_from_slice(recipient_ed_pub);
    signed.extend_from_slice(&compressed);
    let signature = sender.signing_key().sign(&signed);

    // inner = sender_pub(32) || sig(64) || compressed
    let mut inner = Vec::with_capacity(32 + 64 + compressed.len());
    inner.extend_from_slice(&sender_pub);
    inner.extend_from_slice(&signature.to_bytes());
    inner.extend_from_slice(&compressed);

    let mut nonce = [0u8; NONCE_LEN];
    rng.fill_bytes(&mut nonce);
    let cipher = XChaCha20Poly1305::new(&key.into());
    let ciphertext = cipher
        .encrypt(XNonce::from_slice(&nonce), inner.as_ref())
        .map_err(|_| CryptoError::Decrypt)?;

    let mut blob = Vec::with_capacity(32 + NONCE_LEN + ciphertext.len());
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
    let mut eph_pub = [0u8; 32];
    eph_pub.copy_from_slice(&blob[..32]);
    let mut nonce = [0u8; NONCE_LEN];
    nonce.copy_from_slice(&blob[32..32 + NONCE_LEN]);
    let ciphertext = &blob[32 + NONCE_LEN..];

    let recip_x_priv = ed25519_sk_to_x25519(&recipient.secret_key);
    let raw_secret = x25519(&recip_x_priv, &eph_pub);
    let recip_x_pub = ed25519_pk_to_x25519(&recipient.public_key())?;
    let key = derive_key(&raw_secret, &eph_pub, &recip_x_pub);

    let cipher = XChaCha20Poly1305::new(&key.into());
    let inner = cipher
        .decrypt(XNonce::from_slice(&nonce), ciphertext)
        .map_err(|_| CryptoError::Decrypt)?;

    if inner.len() < 32 + 64 {
        return Err(CryptoError::BlobTooShort);
    }
    let mut sender_pub = [0u8; 32];
    sender_pub.copy_from_slice(&inner[..32]);
    let mut sig_bytes = [0u8; 64];
    sig_bytes.copy_from_slice(&inner[32..96]);
    let compressed = &inner[96..];

    // Verify signature over recipient_pub || compressed.
    let verifying = VerifyingKey::from_bytes(&sender_pub).map_err(|_| CryptoError::BadSignature)?;
    let signature = ed25519_dalek::Signature::from_bytes(&sig_bytes);
    let mut signed = Vec::with_capacity(32 + compressed.len());
    signed.extend_from_slice(&recipient.public_key());
    signed.extend_from_slice(compressed);
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
        // eph_pub occupies the first 32 bytes and equals x25519 basepoint * eph_priv;
        // we can't recompute eph_priv, but the nonce region must differ run-to-run.
        let blob2 = encrypt(&mut rng(8), &alice, &bob.public_key(), b"x").unwrap();
        assert_ne!(&blob[..32], &blob2[..32], "ephemeral pubkey must be random");
        assert_ne!(
            &blob[32..32 + NONCE_LEN],
            &blob2[32..32 + NONCE_LEN],
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
        let a = id.sign_challenge("relay.example.com", "deadbeef");
        let b = id.sign_challenge("relay.example.com", "deadbeef");
        let c = id.sign_challenge("other.example.com", "deadbeef");
        assert_eq!(a, b, "Ed25519 is deterministic");
        assert_ne!(a, c, "signature is bound to the host");
        assert_eq!(a.len(), 128, "64-byte sig in hex");
    }
}
