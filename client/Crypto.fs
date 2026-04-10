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

    let generateIdentity () : Identity =
        let kp = PublicKeyAuth.GenerateKeyPair()
        { PrivKey = kp.PrivateKey; PubKeyHex = toHex kp.PublicKey }

    let signChallenge (privKey: byte[]) (challenge: string) : string =
        let message = Encoding.UTF8.GetBytes(challenge)
        PublicKeyAuth.SignDetached(message, privKey) |> toHex

    let private deriveKey ephPub recipientX25519Pub rawSecret =
        let salt = Array.append ephPub recipientX25519Pub
        let info = Encoding.UTF8.GetBytes("skrepka-v1")
        HKDF.DeriveKey(HashAlgorithmName.SHA256, rawSecret, 32, salt, info)

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
        if blob.Length < 168 then
            None
        else
            try
                let ephPub = blob.[0..31]
                let nonce = blob.[32..55]
                let senderPub = blob.[blob.Length - 96 .. blob.Length - 65]
                let signature = blob.[blob.Length - 64 .. blob.Length - 1]
                let ciphertext = blob.[56 .. blob.Length - 97]

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
