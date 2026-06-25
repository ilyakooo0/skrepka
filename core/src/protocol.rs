//! Plaintext payload (de)serialization and the wire envelope (PROTOCOL.md §4).
//!
//! Plaintext payloads are UTF-8 JSON with a `type` discriminator and an int64
//! millisecond `ts`. Unknown types are ignored (return `None`).

use serde::{Deserialize, Serialize};

/// A decrypted plaintext payload. `photo` stays base64 (as on the wire).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Payload {
    Text {
        id: String,
        body: String,
    },
    DeliveryAck {
        ack_ids: Vec<String>,
    },
    Profile {
        display_name: String,
        bio: String,
        photo: Option<String>,
    },
}

/// A parsed payload plus its sender-supplied timestamp (ms).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedPayload {
    pub ts: i64,
    pub payload: Payload,
}

/// The server-visible envelope: only the recipient and the opaque blob.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Envelope {
    pub to: String,
    #[serde(rename = "encryptedBlob")]
    pub encrypted_blob: String,
}

/// Serialize a payload to the plaintext JSON sent inside the AEAD ciphertext.
pub fn serialize_payload(payload: &Payload, ts: i64) -> String {
    let value = match payload {
        Payload::Text { id, body } => serde_json::json!({
            "type": "text",
            "id": id,
            "body": body,
            "ts": ts,
        }),
        Payload::DeliveryAck { ack_ids } => serde_json::json!({
            "type": "delivery.ack",
            "ack_ids": ack_ids,
            "ts": ts,
        }),
        Payload::Profile {
            display_name,
            bio,
            photo,
        } => serde_json::json!({
            "type": "profile",
            "display_name": display_name,
            "bio": bio,
            "photo": photo,
            "ts": ts,
        }),
    };
    value.to_string()
}

/// Parse a plaintext payload. Returns `None` for unknown/malformed types so the
/// caller silently ignores them (forward compatibility, PROTOCOL.md §4).
pub fn parse_payload(bytes: &[u8]) -> Option<ParsedPayload> {
    let v: serde_json::Value = serde_json::from_slice(bytes).ok()?;
    let ts = v.get("ts").and_then(|t| t.as_i64()).unwrap_or(0);
    let ty = v.get("type")?.as_str()?;
    let payload = match ty {
        "text" => {
            let id = v.get("id")?.as_str()?.to_string();
            let body = v.get("body")?.as_str()?.to_string();
            Payload::Text { id, body }
        }
        "delivery.ack" => {
            let ack_ids = v
                .get("ack_ids")?
                .as_array()?
                .iter()
                .filter_map(|x| x.as_str().map(str::to_string))
                .collect();
            Payload::DeliveryAck { ack_ids }
        }
        "profile" => {
            let display_name = v
                .get("display_name")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string();
            let bio = v
                .get("bio")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string();
            let photo = v
                .get("photo")
                .and_then(|x| x.as_str())
                .map(str::to_string);
            Payload::Profile {
                display_name,
                bio,
                photo,
            }
        }
        _ => return None,
    };
    Some(ParsedPayload { ts, payload })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reparse(p: &Payload, ts: i64) -> ParsedPayload {
        let json = serialize_payload(p, ts);
        parse_payload(json.as_bytes()).unwrap()
    }

    #[test]
    fn text_round_trip() {
        let p = Payload::Text {
            id: "id-1".into(),
            body: "hello".into(),
        };
        let out = reparse(&p, 1700000000000);
        assert_eq!(out.ts, 1700000000000);
        assert_eq!(out.payload, p);
    }

    #[test]
    fn ack_round_trip() {
        let p = Payload::DeliveryAck {
            ack_ids: vec!["a".into(), "b".into()],
        };
        assert_eq!(reparse(&p, 42).payload, p);
    }

    #[test]
    fn profile_round_trip_with_and_without_photo() {
        let with = Payload::Profile {
            display_name: "Alice".into(),
            bio: "writing".into(),
            photo: Some("aGVsbG8=".into()),
        };
        assert_eq!(reparse(&with, 1).payload, with);
        let without = Payload::Profile {
            display_name: "Bob".into(),
            bio: "".into(),
            photo: None,
        };
        assert_eq!(reparse(&without, 1).payload, without);
    }

    #[test]
    fn unknown_type_is_ignored() {
        let json = r#"{"type":"read.receipt","ts":1}"#;
        assert!(parse_payload(json.as_bytes()).is_none());
    }

    #[test]
    fn text_missing_field_is_rejected() {
        let json = r#"{"type":"text","id":"x","ts":1}"#;
        assert!(parse_payload(json.as_bytes()).is_none());
    }

    #[test]
    fn missing_ts_defaults_to_zero() {
        let json = r#"{"type":"text","id":"x","body":"y"}"#;
        assert_eq!(parse_payload(json.as_bytes()).unwrap().ts, 0);
    }

    #[test]
    fn snake_case_field_names_on_wire() {
        let p = Payload::Profile {
            display_name: "A".into(),
            bio: "B".into(),
            photo: None,
        };
        let json = serialize_payload(&p, 1);
        assert!(json.contains("\"display_name\""));
        let ack = serialize_payload(&Payload::DeliveryAck { ack_ids: vec![] }, 1);
        assert!(ack.contains("\"ack_ids\""));
        assert!(ack.contains("\"delivery.ack\""));
    }
}
