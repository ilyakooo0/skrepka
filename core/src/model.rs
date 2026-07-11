//! Domain types: persisted state (stored in the kv capability as JSON) and the
//! `ViewModel` types the Swift shell renders.

use facet::Facet;
use serde::{Deserialize, Serialize};

use crate::phonemic;

// ---------------------------------------------------------------------------
// Persisted state (serialized to the kv store as JSON)
// ---------------------------------------------------------------------------

pub const DEFAULT_SERVER_URL: &str = "http://localhost:8080";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Settings {
    pub server_url: String,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            server_url: DEFAULT_SERVER_URL.to_string(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct OwnProfile {
    pub display_name: String,
    pub bio: String,
    /// base64-encoded image, or `None`.
    pub photo: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Contact {
    pub pubkey: String,
    pub nickname: String,
    pub display_name: String,
    pub bio: String,
    pub photo: Option<String>,
    pub blocked: bool,
    /// `ts` of the last applied profile message (drop older replays).
    pub last_profile_ts: i64,
    pub added_at: i64,
}

impl Contact {
    pub fn new(pubkey: String, nickname: String, added_at: i64) -> Self {
        Contact {
            pubkey,
            nickname,
            display_name: String::new(),
            bio: String::new(),
            photo: None,
            blocked: false,
            last_profile_ts: 0,
            added_at,
        }
    }

    /// Best human label: nickname, else shared display name, else truncated @p.
    pub fn label(&self) -> String {
        if !self.nickname.is_empty() {
            self.nickname.clone()
        } else if !self.display_name.is_empty() {
            self.display_name.clone()
        } else {
            trunc_ob(&self.pubkey)
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct StoredMessage {
    pub id: String,
    pub body: String,
    pub ts: i64,
    pub outgoing: bool,
    /// Only meaningful for outgoing messages.
    pub delivered: bool,
}

/// A queued outbound payload awaiting encryption + send.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OutboxItem {
    pub recipient: String,
    /// The serialized plaintext payload JSON (encrypted only at send time).
    pub envelope_json: String,
}

// ---------------------------------------------------------------------------
// @p helpers
// ---------------------------------------------------------------------------

/// Full @p rendering of a hex pubkey.
pub fn hex_to_ob(hex_key: &str) -> String {
    match hex::decode(hex_key) {
        Ok(bytes) => phonemic::to_ob(&bytes),
        Err(_) => hex_key.to_string(),
    }
}

/// Truncated @p: first two and last two syllables (`a-b-…-y-z`).
pub fn trunc_ob(hex_key: &str) -> String {
    let ob = hex_to_ob(hex_key);
    let parts: Vec<&str> = ob.split('-').collect();
    if parts.len() > 4 {
        format!(
            "{}-{}-…-{}-{}",
            parts[0],
            parts[1],
            parts[parts.len() - 2],
            parts[parts.len() - 1]
        )
    } else {
        ob
    }
}

// ---------------------------------------------------------------------------
// ViewModel (rendered by the shell)
// ---------------------------------------------------------------------------

#[derive(Facet, Serialize, Deserialize, Clone, Default, Debug)]
pub struct ProfileVM {
    pub display_name: String,
    pub bio: String,
    /// base64 image or empty.
    pub photo: String,
}

#[derive(Facet, Serialize, Deserialize, Clone, Default, Debug)]
pub struct ContactVM {
    pub pubkey: String,
    pub name: String,
    pub ob: String,
    pub photo: String,
    pub blocked: bool,
    pub last_message: String,
    pub last_ts: i64,
}

#[derive(Facet, Serialize, Deserialize, Clone, Default, Debug)]
pub struct MessageVM {
    pub id: String,
    pub body: String,
    pub ts: i64,
    pub outgoing: bool,
    pub delivered: bool,
}

#[derive(Facet, Serialize, Deserialize, Clone, Default, Debug)]
pub struct ViewModel {
    /// "conversations" | "chat" | "add_contact" | "settings" | "edit_profile"
    pub page: String,
    pub has_identity: bool,
    pub my_pubkey_hex: String,
    pub my_pubkey_ob: String,
    /// "offline" | "connecting" | "online"
    pub conn_status: String,
    pub server_url: String,
    pub profile: ProfileVM,
    pub contacts: Vec<ContactVM>,
    pub active_peer: String,
    pub active_peer_name: String,
    pub active_peer_ob: String,
    pub active_peer_blocked: bool,
    pub messages: Vec<MessageVM>,
    pub compose: String,
    pub error: String,
}
