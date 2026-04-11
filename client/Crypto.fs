namespace Skrepka

open System
open System.Text
open System.Security.Cryptography
open Sodium

module Crypto =

    type Identity = { PrivKey: byte[]; PubKeyHex: string }

    let toHex (bytes: byte[]) : string =
        Convert.ToHexString(bytes).ToLowerInvariant()

    let fromHex (hex: string) : byte[] =
        Convert.FromHexString(hex)

    let tryFromHex (hex: string) : byte[] option =
        try Some(Convert.FromHexString(hex))
        with :? FormatException -> None

    let identityFromPrivKey (privKey: byte[]) : Identity =
        { PrivKey = privKey; PubKeyHex = toHex privKey.[32..63] }

    let generateIdentity () : Identity =
        PublicKeyAuth.GenerateKeyPair().PrivateKey |> identityFromPrivKey

    let signChallenge (privKey: byte[]) (challenge: string) : string =
        let message = Encoding.UTF8.GetBytes(challenge)
        PublicKeyAuth.SignDetached(message, privKey) |> toHex

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
        let ephKp = PublicKeyBox.GenerateKeyPair()
        let recipientX25519Pub =
            PublicKeyAuth.ConvertEd25519PublicKeyToCurve25519PublicKey(recipientEd25519Pub)
        let rawSecret = ScalarMult.Mult(ephKp.PrivateKey, recipientX25519Pub)
        let key = deriveKey ephKp.PublicKey recipientX25519Pub rawSecret
        let nonce = SodiumCore.GetRandomBytes(24)
        let ptBytes = Encoding.UTF8.GetBytes(plaintext)
        let ciphertext = SecretAeadXChaCha20Poly1305.Encrypt(ptBytes, nonce, key)
        let signature = PublicKeyAuth.SignDetached(ciphertext, senderPrivKey)
        Array.concat [| ephKp.PublicKey; nonce; ciphertext; senderPubKey; signature |]

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

                if not (PublicKeyAuth.VerifyDetached(signature, ciphertext, senderPub)) then
                    None
                else
                    let recipientX25519Priv =
                        PublicKeyAuth.ConvertEd25519SecretKeyToCurve25519SecretKey(recipientPrivKey)
                    let rawSecret = ScalarMult.Mult(recipientX25519Priv, ephPub)
                    let recipientEd25519Pub = recipientPrivKey.[32..63]
                    let recipientX25519Pub =
                        PublicKeyAuth.ConvertEd25519PublicKeyToCurve25519PublicKey(recipientEd25519Pub)
                    let key = deriveKey ephPub recipientX25519Pub rawSecret
                    let plaintext = SecretAeadXChaCha20Poly1305.Decrypt(ciphertext, nonce, key)
                    Some(Encoding.UTF8.GetString(plaintext), toHex senderPub)
            with _ ->
                None
