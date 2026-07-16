//! Plaintext payload (de)serialization and the wire envelope (PROTOCOL.md §4).
//!
//! Plaintext payloads are UTF-8 JSON with a `type` discriminator and an int64
//! millisecond `ts`. Unknown types are ignored (return `None`).

use serde::{Deserialize, Serialize};
use base64::prelude::*;
use base64::Engine;

/// Caps on the attacker-chosen fields of an incoming payload.
///
/// The AEAD proves the blob came from *someone*, not that they are polite: a
/// peer can put a 40 MiB string in `body` or `bio` and we would store it, render
/// it, and write it back to disk on every subsequent message. Anything over the
/// cap is treated like any other malformed payload — dropped silently
/// (PROTOCOL.md §4).
pub const MAX_BODY_LEN: usize = 64 * 1024;
pub const MAX_DISPLAY_NAME_LEN: usize = 128;
pub const MAX_BIO_LEN: usize = 1024;
pub const MAX_PHOTO_LEN: usize = 64 * 1024;
/// Message ids are UUIDs; they are stored, compared, and echoed back in acks.
pub const MAX_ID_LEN: usize = 128;
/// Ids in one `delivery.ack`. We scan the conversation once per id, so an
/// unbounded list is O(n·m) work a peer can dictate for free.
pub const MAX_ACK_IDS: usize = 1024;

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
        display_name: Option<String>,
        bio: Option<String>,
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
        } => {
            let mut obj = serde_json::json!({
                "type": "profile",
                "ts": ts,
            });
            // D13: Only include the field when present — absent means
            // "don't change", while present (even empty) means "set to this".
            if let Some(name) = display_name {
                obj["display_name"] = serde_json::Value::String(name.clone());
            }
            if let Some(b) = bio {
                obj["bio"] = serde_json::Value::String(b.clone());
            }
            // Omit `photo` entirely when there isn't one, rather than sending an
            // explicit null: "no photo" and "field absent" mean the same thing to
            // a reader, and the null costs bytes in every broadcast.
            if let Some(photo) = photo {
                obj["photo"] = serde_json::Value::String(photo.clone());
            }
            obj
        }
    };
    value.to_string()
}

/// D14: Filter out control characters, bidirectional control characters, and
/// zero-width characters from a received string. Applied on the receiving side
/// (parse_payload) so the sender's input is preserved as-is on send, but the
/// recipient is protected from invisible character tricks.
///
/// Filters:
/// - Control characters U+0000–U+001F (except U+0009 tab, U+000A newline,
///   U+000D carriage return)
/// - Bidirectional control characters (U+200E LRM, U+200F RLM, U+202A–U+202E,
///   U+2066–U+2069)
/// - Zero-width characters (U+200B, U+200C, U+200D, U+FEFF)
fn sanitize_text(s: &str) -> String {
    s.chars()
        .filter(|c| {
            let cp = *c as u32;
            // Control characters U+0000–U+001F, except tab/newline/CR
            if cp <= 0x001F && cp != 0x0009 && cp != 0x000A && cp != 0x000D {
                return false;
            }
            // Bidirectional control characters
            if matches!(cp, 0x200E | 0x200F | 0x202A..=0x202E | 0x2066..=0x2069) {
                return false;
            }
            // Zero-width characters
            if matches!(cp, 0x200B | 0x200C | 0x200D | 0xFEFF) {
                return false;
            }
            true
        })
        .collect()
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
            let body = sanitize_text(v.get("body")?.as_str()?);
            if id.len() > MAX_ID_LEN || body.len() > MAX_BODY_LEN {
                return None;
            }
            Payload::Text { id, body }
        }
        "delivery.ack" => {
            let raw = v.get("ack_ids")?.as_array()?;
            if raw.len() > MAX_ACK_IDS {
                return None;
            }
            let ack_ids: Vec<String> = raw
                .iter()
                .filter_map(|x| x.as_str().map(str::to_string))
                .collect();
            // Re-check after filtering: a peer could pack the array with
            // non-string junk that passes the raw count but leaves more
            // real ids than the cap allows after filtering. The raw check
            // above is an early out; this is the authoritative one.
            if ack_ids.len() > MAX_ACK_IDS || ack_ids.iter().any(|id| id.len() > MAX_ID_LEN) {
                return None;
            }
            Payload::DeliveryAck { ack_ids }
        }
        "profile" => {
            // D13: Use Option<String> — None when the field is absent (don't
            // change the recipient's cached value), Some(value) when present
            // (even if empty, meaning "set to this value").
            let display_name = v.get("display_name").and_then(|x| x.as_str()).map(sanitize_text);
            let bio = v.get("bio").and_then(|x| x.as_str()).map(sanitize_text);
            let photo = v
                .get("photo")
                .and_then(|x| x.as_str())
                .map(str::to_string);
            if display_name.as_ref().is_some_and(|d| d.chars().count() > MAX_DISPLAY_NAME_LEN)
                || bio.as_ref().is_some_and(|b| b.chars().count() > MAX_BIO_LEN)
                || photo.as_ref().is_some_and(|p| p.len() > MAX_PHOTO_LEN)
                || photo.as_ref().is_some_and(|p| {
                    // Reject a photo that isn't valid base64 — a peer can put
                    // any string in the field, and the shell attempts to decode
                    // it as an image on every render.
                    BASE64_STANDARD.decode(p).is_err()
                })
            {
                return None;
            }
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
            display_name: Some("Alice".into()),
            bio: Some("writing".into()),
            photo: Some("aGVsbG8=".into()),
        };
        assert_eq!(reparse(&with, 1).payload, with);
        let without = Payload::Profile {
            display_name: Some("Bob".into()),
            bio: Some("".into()),
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

    /// A peer can put anything inside the AEAD; the caps are what stop a 40 MiB
    /// `body` from being stored, rendered, and rewritten to disk forever.
    #[test]
    fn oversized_fields_are_dropped() {
        let big = "x".repeat(MAX_BODY_LEN + 1);
        let json = serialize_payload(
            &Payload::Text {
                id: "x".into(),
                body: big,
            },
            1,
        );
        assert!(parse_payload(json.as_bytes()).is_none(), "body over cap");

        let long_bio = serialize_payload(
            &Payload::Profile {
                display_name: Some("A".into()),
                bio: Some("b".repeat(MAX_BIO_LEN + 1)),
                photo: None,
            },
            1,
        );
        assert!(parse_payload(long_bio.as_bytes()).is_none(), "bio over cap");

        let long_name = serialize_payload(
            &Payload::Profile {
                display_name: Some("n".repeat(MAX_DISPLAY_NAME_LEN + 1)),
                bio: Some(String::new()),
                photo: None,
            },
            1,
        );
        assert!(parse_payload(long_name.as_bytes()).is_none(), "name over cap");

        let big_photo = serialize_payload(
            &Payload::Profile {
                display_name: Some(String::new()),
                bio: Some(String::new()),
                photo: Some("p".repeat(MAX_PHOTO_LEN + 1)),
            },
            1,
        );
        assert!(parse_payload(big_photo.as_bytes()).is_none(), "photo over cap");

        let many_acks = serialize_payload(
            &Payload::DeliveryAck {
                ack_ids: vec!["a".to_string(); MAX_ACK_IDS + 1],
            },
            1,
        );
        assert!(parse_payload(many_acks.as_bytes()).is_none(), "ack list over cap");
    }

    /// The caps are inclusive: a payload sitting exactly at the limit still works.
    #[test]
    fn fields_at_the_cap_still_parse() {
        let at_cap = serialize_payload(
            &Payload::Text {
                id: "x".into(),
                body: "x".repeat(MAX_BODY_LEN),
            },
            1,
        );
        assert!(parse_payload(at_cap.as_bytes()).is_some());
    }

    /// `"photo": null` is noise on every profile broadcast; absent means absent.
    #[test]
    fn a_photoless_profile_omits_the_field() {
        let json = serialize_payload(
            &Payload::Profile {
                display_name: Some("A".into()),
                bio: Some("B".into()),
                photo: None,
            },
            1,
        );
        assert!(!json.contains("photo"), "got: {json}");
    }

    #[test]
    fn snake_case_field_names_on_wire() {
        let p = Payload::Profile {
            display_name: Some("A".into()),
            bio: Some("B".into()),
            photo: None,
        };
        let json = serialize_payload(&p, 1);
        assert!(json.contains("\"display_name\""));
        let ack = serialize_payload(&Payload::DeliveryAck { ack_ids: vec![] }, 1);
        assert!(ack.contains("\"ack_ids\""));
        assert!(ack.contains("\"delivery.ack\""));
    }
}
