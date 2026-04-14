namespace Skrepka

open System
open System.Text
open System.Security.Cryptography

module Crypto =

    type Identity = { PrivKey: byte[]; PubKeyHex: string }

    let toHex (bytes: byte[]) : string =
        Convert.ToHexString(bytes).ToLowerInvariant()

    let fromHex (hex: string) : byte[] =
        Convert.FromHexString(hex)

    let tryFromHex (hex: string) : byte[] option =
        try Some(Convert.FromHexString(hex))
        with :? FormatException -> None

#if MOBILE
    open System.Runtime.InteropServices

    [<DllImport("__Internal", CallingConvention = CallingConvention.Cdecl)>]
    extern int private sodium_init()

    [<DllImport("__Internal", CallingConvention = CallingConvention.Cdecl)>]
    extern void private randombytes_buf(byte[] buf, unativeint size)

    [<DllImport("__Internal", CallingConvention = CallingConvention.Cdecl)>]
    extern int private crypto_sign_keypair(byte[] pk, byte[] sk)

    [<DllImport("__Internal", CallingConvention = CallingConvention.Cdecl)>]
    extern int private crypto_sign_detached(byte[] out, nativeint& siglen, byte[] m, uint64 mlen, byte[] sk)

    [<DllImport("__Internal", CallingConvention = CallingConvention.Cdecl)>]
    extern int private crypto_sign_verify_detached(byte[] s, byte[] m, uint64 mlen, byte[] pk)

    [<DllImport("__Internal", CallingConvention = CallingConvention.Cdecl)>]
    extern int private crypto_sign_ed25519_pk_to_curve25519(byte[] x25519_pk, byte[] ed25519_pk)

    [<DllImport("__Internal", CallingConvention = CallingConvention.Cdecl)>]
    extern int private crypto_sign_ed25519_sk_to_curve25519(byte[] x25519_sk, byte[] ed25519_sk)

    [<DllImport("__Internal", CallingConvention = CallingConvention.Cdecl)>]
    extern int private crypto_box_keypair(byte[] pk, byte[] sk)

    [<DllImport("__Internal", CallingConvention = CallingConvention.Cdecl)>]
    extern int private crypto_scalarmult(byte[] q, byte[] n, byte[] p)

    [<DllImport("__Internal", CallingConvention = CallingConvention.Cdecl)>]
    extern int private crypto_aead_xchacha20poly1305_ietf_encrypt(byte[] c, nativeint& clen, byte[] m, uint64 mlen, byte[] ad, uint64 adlen, nativeint nsec, byte[] npub, byte[] k)

    [<DllImport("__Internal", CallingConvention = CallingConvention.Cdecl)>]
    extern int private crypto_aead_xchacha20poly1305_ietf_decrypt(byte[] m, nativeint& mlen, nativeint nsec, byte[] c, uint64 clen, byte[] ad, uint64 adlen, byte[] npub, byte[] k)

    do
        if sodium_init() < 0 then
            failwith "sodium_init() failed"

    let private getRandomBytes n =
        let buf = Array.zeroCreate n
        randombytes_buf(buf, unativeint n)
        buf

    let private generateSignKeyPair () =
        let pk = Array.zeroCreate 32
        let sk = Array.zeroCreate 64
        if crypto_sign_keypair(pk, sk) <> 0 then failwith "crypto_sign_keypair failed"
        pk, sk

    let private signDetached (message: byte[]) (sk: byte[]) =
        let out = Array.zeroCreate 64
        let mutable siglen = 0n
        if crypto_sign_detached(out, &siglen, message, uint64 message.Length, sk) <> 0 then
            failwith "crypto_sign_detached failed"
        out

    let private verifyDetached (signature: byte[]) (message: byte[]) (pk: byte[]) =
        crypto_sign_verify_detached(signature, message, uint64 message.Length, pk) = 0

    let private ed25519PkToCurve25519 (ed: byte[]) =
        let x = Array.zeroCreate 32
        if crypto_sign_ed25519_pk_to_curve25519(x, ed) <> 0 then failwith "pk_to_curve25519 failed"
        x

    let private ed25519SkToCurve25519 (ed: byte[]) =
        let x = Array.zeroCreate 32
        if crypto_sign_ed25519_sk_to_curve25519(x, ed) <> 0 then failwith "sk_to_curve25519 failed"
        x

    let private generateBoxKeyPair () =
        let pk = Array.zeroCreate 32
        let sk = Array.zeroCreate 32
        if crypto_box_keypair(pk, sk) <> 0 then failwith "crypto_box_keypair failed"
        pk, sk

    let private scalarMult (n: byte[]) (p: byte[]) =
        let q = Array.zeroCreate 32
        if crypto_scalarmult(q, n, p) <> 0 then failwith "crypto_scalarmult failed"
        q

    let private aeadEncrypt (pt: byte[]) (nonce: byte[]) (key: byte[]) =
        let ct = Array.zeroCreate (pt.Length + 16)
        let mutable ctlen = 0n
        if crypto_aead_xchacha20poly1305_ietf_encrypt(ct, &ctlen, pt, uint64 pt.Length, null, 0UL, 0n, nonce, key) <> 0 then
            failwith "aead encrypt failed"
        ct.[.. int ctlen - 1]

    let private aeadDecrypt (ct: byte[]) (nonce: byte[]) (key: byte[]) =
        let pt = Array.zeroCreate ct.Length
        let mutable ptlen = 0n
        if crypto_aead_xchacha20poly1305_ietf_decrypt(pt, &ptlen, 0n, ct, uint64 ct.Length, null, 0UL, nonce, key) <> 0 then
            failwith "aead decrypt failed"
        pt.[.. int ptlen - 1]

#endif

    let identityFromPrivKey (privKey: byte[]) : Identity =
        { PrivKey = privKey; PubKeyHex = toHex privKey.[32..63] }

    let generateIdentity () : Identity =
#if MOBILE
        let _, sk = generateSignKeyPair ()
        sk |> identityFromPrivKey
#else
        Sodium.PublicKeyAuth.GenerateKeyPair().PrivateKey |> identityFromPrivKey
#endif

    let signChallenge (privKey: byte[]) (challenge: string) : string =
        let message = Encoding.UTF8.GetBytes(challenge)
#if MOBILE
        signDetached message privKey |> toHex
#else
        Sodium.PublicKeyAuth.SignDetached(message, privKey) |> toHex
#endif

    let private deriveKey ephPub recipientX25519Pub rawSecret =
        let salt = Array.append ephPub recipientX25519Pub
        let info = Encoding.UTF8.GetBytes("skrepka-v1")
        HKDF.DeriveKey(HashAlgorithmName.SHA256, rawSecret, 32, salt, info)

    // Blob layout: [ephPub(32) | nonce(24) | ciphertext | senderPub(32) | signature(64)]
    let private ephPubLen = 32
    let private nonceLen = 24
    let private pubLen = 32
    let private sigLen = 64
    let private headerLen = ephPubLen + nonceLen
    let private trailerLen = pubLen + sigLen
    let private minBlobLen = headerLen + 16 + trailerLen // 16 = AEAD tag

    let encrypt (senderPrivKey: byte[]) (recipientEd25519Pub: byte[]) (plaintext: string) : byte[] =
        let senderPubKey = senderPrivKey.[32..63]
#if MOBILE
        let ephPub, ephPriv = generateBoxKeyPair ()
        let recipientX25519Pub = ed25519PkToCurve25519 recipientEd25519Pub
        let rawSecret = scalarMult ephPriv recipientX25519Pub
        let key = deriveKey ephPub recipientX25519Pub rawSecret
        let nonce = getRandomBytes 24
        let ptBytes = Encoding.UTF8.GetBytes(plaintext)
        let ciphertext = aeadEncrypt ptBytes nonce key
        let signature = signDetached ciphertext senderPrivKey
        Array.concat [| ephPub; nonce; ciphertext; senderPubKey; signature |]
#else
        let ephKp = Sodium.PublicKeyBox.GenerateKeyPair()
        let recipientX25519Pub =
            Sodium.PublicKeyAuth.ConvertEd25519PublicKeyToCurve25519PublicKey(recipientEd25519Pub)
        let rawSecret = Sodium.ScalarMult.Mult(ephKp.PrivateKey, recipientX25519Pub)
        let key = deriveKey ephKp.PublicKey recipientX25519Pub rawSecret
        let nonce = Sodium.SodiumCore.GetRandomBytes(24)
        let ptBytes = Encoding.UTF8.GetBytes(plaintext)
        let ciphertext = Sodium.SecretAeadXChaCha20Poly1305.Encrypt(ptBytes, nonce, key)
        let signature = Sodium.PublicKeyAuth.SignDetached(ciphertext, senderPrivKey)
        Array.concat [| ephKp.PublicKey; nonce; ciphertext; senderPubKey; signature |]
#endif

    let decrypt (recipientPrivKey: byte[]) (blob: byte[]) : (string * string) option =
        if blob.Length < minBlobLen then
            None
        else
            try
                let ephPub = blob.[.. ephPubLen - 1]
                let nonce = blob.[ephPubLen .. headerLen - 1]
                let ciphertext = blob.[headerLen .. blob.Length - trailerLen - 1]
                let senderPub = blob.[blob.Length - trailerLen .. blob.Length - sigLen - 1]
                let signature = blob.[blob.Length - sigLen ..]

#if MOBILE
                if not (verifyDetached signature ciphertext senderPub) then
                    None
                else
                    let recipientX25519Priv = ed25519SkToCurve25519 recipientPrivKey
                    let rawSecret = scalarMult recipientX25519Priv ephPub
                    let recipientEd25519Pub = recipientPrivKey.[32..63]
                    let recipientX25519Pub = ed25519PkToCurve25519 recipientEd25519Pub
                    let key = deriveKey ephPub recipientX25519Pub rawSecret
                    let plaintext = aeadDecrypt ciphertext nonce key
                    Some(Encoding.UTF8.GetString(plaintext), toHex senderPub)
#else
                if not (Sodium.PublicKeyAuth.VerifyDetached(signature, ciphertext, senderPub)) then
                    None
                else
                    let recipientX25519Priv =
                        Sodium.PublicKeyAuth.ConvertEd25519SecretKeyToCurve25519SecretKey(recipientPrivKey)
                    let rawSecret = Sodium.ScalarMult.Mult(recipientX25519Priv, ephPub)
                    let recipientEd25519Pub = recipientPrivKey.[32..63]
                    let recipientX25519Pub =
                        Sodium.PublicKeyAuth.ConvertEd25519PublicKeyToCurve25519PublicKey(recipientEd25519Pub)
                    let key = deriveKey ephPub recipientX25519Pub rawSecret
                    let plaintext = Sodium.SecretAeadXChaCha20Poly1305.Decrypt(ciphertext, nonce, key)
                    Some(Encoding.UTF8.GetString(plaintext), toHex senderPub)
#endif
            with _ ->
                None
