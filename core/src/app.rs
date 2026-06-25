//! Crux App — the MVU state machine for the skrepka client.
//!
//! The core owns all business logic: identity, auth, the long-poll loop, the
//! outbox, contacts, profiles, and message ingest. The shell provides HTTP,
//! key-value storage, a timer, and (natively, fed back as events) the Keychain,
//! QR scanning, photo picking, and clipboard.

use std::collections::{BTreeMap, VecDeque};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crux_core::{
    macros::effect,
    render::{render, RenderOperation},
    App, Command,
};
use crux_http::protocol::HttpRequest;
use crux_kv::KeyValueOperation;
use crux_time::TimeRequest;
use facet::Facet;
use serde::{Deserialize, Serialize};

use crate::crypto::Identity;
use crate::model::{
    hex_to_ob, trunc_ob, Contact, ContactVM, MessageVM, OutboxItem, OwnProfile, ProfileVM,
    Settings, StoredMessage, ViewModel,
};
use crate::phonemic;
use crate::protocol::{self, Envelope, Payload};

type Http = crux_http::command::Http<Effect, Event>;
type KeyValue = crux_kv::KeyValue<Effect, Event>;
type Time = crux_time::Time<Effect, Event>;
type HttpResult = crux_http::Result<crux_http::Response<Vec<u8>>>;
type KvData = Result<Option<Vec<u8>>, crux_kv::error::KeyValueError>;

// kv keys
const K_SETTINGS: &str = "settings";
const K_PROFILE: &str = "profile";
const K_CONTACTS: &str = "contacts";
const K_CURSOR: &str = "cursor";
const K_OUTBOX: &str = "outbox";
fn k_messages(peer: &str) -> String {
    format!("messages:{peer}")
}

// ---------------------------------------------------------------------------
// Effect
// ---------------------------------------------------------------------------

#[effect(facet_typegen)]
#[derive(Debug)]
pub enum Effect {
    Render(RenderOperation),
    Http(HttpRequest),
    KeyValue(KeyValueOperation),
    Time(TimeRequest),
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[derive(Facet, Serialize, Deserialize, Clone, Debug)]
#[repr(C)]
pub enum Event {
    // ---- lifecycle / persistence (from the shell) ----
    /// 64-byte Ed25519 secret key loaded (or freshly generated) by the shell.
    IdentityLoaded(Vec<u8>),

    // ---- navigation (from the shell) ----
    ShowConversations,
    ShowSettings,
    ShowAddContact,
    ShowEditProfile,
    OpenChat(String),
    Back,

    // ---- user actions (from the shell) ----
    ComposeChanged(String),
    SendText,
    AddContact { input: String, nickname: String },
    SetBlocked { peer: String, blocked: bool },
    SaveProfile {
        display_name: String,
        bio: String,
        photo: Option<String>,
    },
    SetServerUrl(String),
    Connect,

    // ---- internal: kv load results ----
    #[serde(skip)]
    #[facet(skip)]
    LoadedSettings(#[facet(opaque)] KvData),
    #[serde(skip)]
    #[facet(skip)]
    LoadedProfile(#[facet(opaque)] KvData),
    #[serde(skip)]
    #[facet(skip)]
    LoadedContacts(#[facet(opaque)] KvData),
    #[serde(skip)]
    #[facet(skip)]
    LoadedCursor(#[facet(opaque)] KvData),
    #[serde(skip)]
    #[facet(skip)]
    LoadedOutbox(#[facet(opaque)] KvData),
    #[serde(skip)]
    #[facet(skip)]
    LoadedMessages(String, #[facet(opaque)] KvData),
    #[serde(skip)]
    #[facet(skip)]
    Saved(#[facet(opaque)] KvData),

    // ---- internal: auth / poll / send ----
    Authenticate,
    Poll,
    StartFlush,
    #[serde(skip)]
    #[facet(skip)]
    ChallengeResult(#[facet(opaque)] HttpResult),
    #[serde(skip)]
    #[facet(skip)]
    VerifyResult(#[facet(opaque)] HttpResult),
    #[serde(skip)]
    #[facet(skip)]
    PollResult(#[facet(opaque)] HttpResult),
    #[serde(skip)]
    #[facet(skip)]
    SendResult(#[facet(opaque)] HttpResult),
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ConnStatus {
    Offline,
    Connecting,
    Online,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Page {
    Setup,
    Conversations,
    Chat,
    AddContact,
    Settings,
    EditProfile,
}

pub struct Model {
    secret_key: Option<Vec<u8>>,
    my_pubkey: String,
    settings: Settings,
    profile: OwnProfile,
    contacts: BTreeMap<String, Contact>,
    messages: BTreeMap<String, Vec<StoredMessage>>,
    outbox: VecDeque<OutboxItem>,
    cursor: i64,
    token: Option<String>,
    conn: ConnStatus,
    poll_retries: u32,
    flushing: bool,
    page: Page,
    active_peer: Option<String>,
    compose: String,
    error: Option<String>,
}

impl Default for Model {
    fn default() -> Self {
        Model {
            secret_key: None,
            my_pubkey: String::new(),
            settings: Settings::default(),
            profile: OwnProfile::default(),
            contacts: BTreeMap::new(),
            messages: BTreeMap::new(),
            outbox: VecDeque::new(),
            cursor: 0,
            token: None,
            conn: ConnStatus::Offline,
            poll_retries: 0,
            flushing: false,
            page: Page::Setup,
            active_peer: None,
            compose: String::new(),
            error: None,
        }
    }
}

impl Model {
    fn identity(&self) -> Option<Identity> {
        self.secret_key
            .as_ref()
            .and_then(|sk| Identity::from_secret_bytes(sk).ok())
    }
}

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Bare lowercased hostname of a server URL (no scheme/port/trailing dot).
fn server_host(url: &str) -> String {
    let after_scheme = url.split("://").nth(1).unwrap_or(url);
    let host_port = after_scheme.split('/').next().unwrap_or("");
    let host = host_port.split('@').next_back().unwrap_or(host_port);
    let host = host.split(':').next().unwrap_or(host);
    host.trim_end_matches('.').to_lowercase()
}

fn json_bytes<T: Serialize>(value: &T) -> Vec<u8> {
    serde_json::to_vec(value).unwrap_or_default()
}

// ---------------------------------------------------------------------------
// Wire request/response shapes
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct ChallengeReq<'a> {
    pubkey: &'a str,
}
#[derive(Deserialize)]
struct ChallengeResp {
    challenge: String,
}
#[derive(Serialize)]
struct VerifyReq<'a> {
    pubkey: &'a str,
    challenge: &'a str,
    signature: &'a str,
    #[serde(rename = "revokeOthers")]
    revoke_others: bool,
}
#[derive(Deserialize)]
struct VerifyResp {
    token: String,
}
#[derive(Serialize)]
struct PollReq {
    cursor: i64,
}
#[derive(Deserialize, Default)]
struct PollResp {
    #[serde(default)]
    events: Vec<PollEvent>,
    #[serde(default)]
    cursor: i64,
}
#[derive(Deserialize)]
struct PollEvent {
    #[serde(rename = "encryptedBlob")]
    encrypted_blob: String,
}
#[derive(Serialize)]
struct SendBatch {
    messages: Vec<Envelope>,
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

#[derive(Default)]
pub struct Skrepka;

impl App for Skrepka {
    type Event = Event;
    type Model = Model;
    type ViewModel = ViewModel;
    type Effect = Effect;

    #[allow(clippy::too_many_lines)]
    fn update(&self, event: Event, model: &mut Model) -> Command<Effect, Event> {
        match event {
            // ---------------- lifecycle ----------------
            Event::IdentityLoaded(sk) => {
                let Ok(id) = Identity::from_secret_bytes(&sk) else {
                    model.error = Some("invalid identity key".into());
                    return render();
                };
                model.secret_key = Some(sk);
                model.my_pubkey = id.public_key_hex();
                model.page = Page::Conversations;
                // Fan out the startup loads.
                Command::all([
                    KeyValue::get(K_SETTINGS).then_send(Event::LoadedSettings),
                    KeyValue::get(K_PROFILE).then_send(Event::LoadedProfile),
                    KeyValue::get(K_CONTACTS).then_send(Event::LoadedContacts),
                    KeyValue::get(K_CURSOR).then_send(Event::LoadedCursor),
                    KeyValue::get(K_OUTBOX).then_send(Event::LoadedOutbox),
                ])
                .and(render())
            }

            Event::LoadedSettings(res) => {
                if let Some(s) = parse_kv::<Settings>(res) {
                    model.settings = s;
                }
                // Server URL known — connect and resume any queued sends.
                Command::event(Event::Connect)
            }
            Event::LoadedProfile(res) => {
                if let Some(p) = parse_kv::<OwnProfile>(res) {
                    model.profile = p;
                }
                render()
            }
            Event::LoadedContacts(res) => {
                if let Some(list) = parse_kv::<Vec<Contact>>(res) {
                    model.contacts = list.into_iter().map(|c| (c.pubkey.clone(), c)).collect();
                    // Lazily load each conversation's messages.
                    let loads: Vec<_> = model
                        .contacts
                        .keys()
                        .map(|peer| {
                            let peer = peer.clone();
                            KeyValue::get(k_messages(&peer))
                                .then_send(move |r| Event::LoadedMessages(peer.clone(), r))
                        })
                        .collect();
                    return Command::all(loads).and(render());
                }
                render()
            }
            Event::LoadedCursor(res) => {
                if let Some(c) = parse_kv::<i64>(res) {
                    model.cursor = c;
                }
                render()
            }
            Event::LoadedOutbox(res) => {
                if let Some(list) = parse_kv::<Vec<OutboxItem>>(res) {
                    model.outbox = list.into();
                }
                render()
            }
            Event::LoadedMessages(peer, res) => {
                if let Some(list) = parse_kv::<Vec<StoredMessage>>(res) {
                    model.messages.insert(peer, list);
                }
                render()
            }
            Event::Saved(_) => Command::done(),

            // ---------------- navigation ----------------
            Event::ShowConversations => {
                model.page = Page::Conversations;
                model.active_peer = None;
                render()
            }
            Event::ShowSettings => {
                model.page = Page::Settings;
                render()
            }
            Event::ShowAddContact => {
                model.page = Page::AddContact;
                model.error = None;
                render()
            }
            Event::ShowEditProfile => {
                model.page = Page::EditProfile;
                render()
            }
            Event::OpenChat(peer) => {
                model.active_peer = Some(peer);
                model.page = Page::Chat;
                render()
            }
            Event::Back => {
                model.page = Page::Conversations;
                model.active_peer = None;
                render()
            }

            // ---------------- user actions ----------------
            Event::ComposeChanged(s) => {
                model.compose = s;
                render()
            }
            Event::SetServerUrl(url) => {
                model.settings.server_url = url;
                model.token = None;
                model.conn = ConnStatus::Offline;
                KeyValue::set(K_SETTINGS, json_bytes(&model.settings))
                    .then_send(Event::Saved)
                    .and(Command::event(Event::Connect))
                    .and(render())
            }
            Event::Connect => {
                if model.secret_key.is_some() && model.conn != ConnStatus::Online {
                    Command::event(Event::Authenticate)
                } else {
                    render()
                }
            }
            Event::AddContact { input, nickname } => {
                match phonemic::try_parse_pubkey(&input) {
                    Some(hex) if hex != model.my_pubkey => {
                        model
                            .contacts
                            .entry(hex.clone())
                            .or_insert_with(|| Contact::new(hex.clone(), nickname.clone(), now_ms()));
                        if !nickname.is_empty() {
                            if let Some(c) = model.contacts.get_mut(&hex) {
                                c.nickname = nickname;
                            }
                        }
                        model.error = None;
                        model.page = Page::Conversations;
                        self.persist_contacts(model).and(render())
                    }
                    Some(_) => {
                        model.error = Some("that's your own key".into());
                        render()
                    }
                    None => {
                        model.error = Some("invalid public key".into());
                        render()
                    }
                }
            }
            Event::SetBlocked { peer, blocked } => {
                if let Some(c) = model.contacts.get_mut(&peer) {
                    c.blocked = blocked;
                }
                self.persist_contacts(model).and(render())
            }
            Event::SaveProfile {
                display_name,
                bio,
                photo,
            } => {
                model.profile = OwnProfile {
                    display_name,
                    bio,
                    photo,
                };
                model.page = Page::Conversations;
                let ts = now_ms();
                let payload = Payload::Profile {
                    display_name: model.profile.display_name.clone(),
                    bio: model.profile.bio.clone(),
                    photo: model.profile.photo.clone(),
                };
                // Broadcast the new profile to every contact.
                for peer in model.contacts.keys().cloned().collect::<Vec<_>>() {
                    model.outbox.push_back(OutboxItem {
                        recipient: peer,
                        envelope_json: protocol::serialize_payload(&payload, ts),
                    });
                }
                Command::all([
                    KeyValue::set(K_PROFILE, json_bytes(&model.profile)).then_send(Event::Saved),
                    self.persist_outbox(model),
                ])
                .and(Command::event(Event::StartFlush))
                .and(render())
            }
            Event::SendText => self.send_text(model),

            // ---------------- auth ----------------
            Event::Authenticate => {
                let Some(id) = model.identity() else {
                    return render();
                };
                model.conn = ConnStatus::Connecting;
                model.error = None;
                let url = format!("{}/auth/challenge", model.settings.server_url);
                let body = ChallengeReq {
                    pubkey: &id.public_key_hex(),
                };
                match Http::post(url).body_json(&body) {
                    Ok(req) => req.build().then_send(Event::ChallengeResult).and(render()),
                    Err(_) => render(),
                }
            }
            Event::ChallengeResult(Ok(mut resp)) => {
                let bytes = resp.take_body().unwrap_or_default();
                let Some(id) = model.identity() else {
                    return render();
                };
                match serde_json::from_slice::<ChallengeResp>(&bytes) {
                    Ok(c) => {
                        let host = server_host(&model.settings.server_url);
                        let signature = id.sign_challenge(&host, &c.challenge);
                        let url = format!("{}/auth/verify", model.settings.server_url);
                        let body = VerifyReq {
                            pubkey: &id.public_key_hex(),
                            challenge: &c.challenge,
                            signature: &signature,
                            revoke_others: false,
                        };
                        match Http::post(url).body_json(&body) {
                            Ok(req) => req.build().then_send(Event::VerifyResult),
                            Err(_) => render(),
                        }
                    }
                    Err(_) => {
                        model.conn = ConnStatus::Offline;
                        self.schedule_reconnect(model)
                    }
                }
            }
            Event::ChallengeResult(Err(_)) => {
                model.conn = ConnStatus::Offline;
                self.schedule_reconnect(model)
            }
            Event::VerifyResult(Ok(mut resp)) => {
                let bytes = resp.take_body().unwrap_or_default();
                match serde_json::from_slice::<VerifyResp>(&bytes) {
                    Ok(v) if !v.token.is_empty() => {
                        model.token = Some(v.token);
                        model.conn = ConnStatus::Online;
                        model.poll_retries = 0;
                        model.error = None;
                        Command::event(Event::Poll)
                            .and(Command::event(Event::StartFlush))
                            .and(render())
                    }
                    _ => {
                        model.conn = ConnStatus::Offline;
                        self.schedule_reconnect(model)
                    }
                }
            }
            Event::VerifyResult(Err(_)) => {
                model.conn = ConnStatus::Offline;
                self.schedule_reconnect(model)
            }

            // ---------------- poll ----------------
            Event::Poll => {
                let Some(token) = model.token.clone() else {
                    return Command::event(Event::Authenticate);
                };
                let url = format!("{}/poll", model.settings.server_url);
                let body = PollReq {
                    cursor: model.cursor,
                };
                match Http::post(url)
                    .header("authorization", format!("Bearer {token}"))
                    .body_json(&body)
                {
                    Ok(req) => req.build().then_send(Event::PollResult),
                    Err(_) => render(),
                }
            }
            Event::PollResult(Ok(mut resp)) => {
                let status = u16::from(resp.status());
                if status == 401 {
                    model.token = None;
                    return Command::event(Event::Authenticate);
                }
                if !(200..300).contains(&status) {
                    return self.backoff_poll(model);
                }
                model.poll_retries = 0;
                let bytes = resp.take_body().unwrap_or_default();
                let parsed: PollResp = serde_json::from_slice(&bytes).unwrap_or_default();
                let cmd = self.ingest_poll(model, parsed);
                // Persist cursor and immediately re-poll (the server long-polled 25s).
                cmd.and(KeyValue::set(K_CURSOR, json_bytes(&model.cursor)).then_send(Event::Saved))
                    .and(Command::event(Event::Poll))
                    .and(render())
            }
            Event::PollResult(Err(_)) => self.backoff_poll(model),

            // ---------------- outbox ----------------
            Event::StartFlush => self.flush_next(model),
            Event::SendResult(Ok(resp)) => {
                let status = u16::from(resp.status());
                if status == 401 {
                    model.token = None;
                    model.flushing = false;
                    return Command::event(Event::Authenticate);
                }
                if (200..300).contains(&status) || status == 400 {
                    // success, or a permanent rejection (self_send/invalid) — drop it.
                    model.outbox.pop_front();
                    return self.persist_outbox(model).and(self.flush_next(model));
                }
                // transient error — stop; will resume on next connect/poll.
                model.flushing = false;
                render()
            }
            Event::SendResult(Err(_)) => {
                model.flushing = false;
                render()
            }
        }
    }

    fn view(&self, model: &Model) -> ViewModel {
        let page = match model.page {
            Page::Setup => "setup",
            Page::Conversations => "conversations",
            Page::Chat => "chat",
            Page::AddContact => "add_contact",
            Page::Settings => "settings",
            Page::EditProfile => "edit_profile",
        };
        let conn = match model.conn {
            ConnStatus::Offline => "offline",
            ConnStatus::Connecting => "connecting",
            ConnStatus::Online => "online",
        };

        let mut contacts: Vec<ContactVM> = model
            .contacts
            .values()
            .map(|c| {
                let msgs = model.messages.get(&c.pubkey);
                let last = msgs.and_then(|m| m.last());
                ContactVM {
                    pubkey: c.pubkey.clone(),
                    name: c.label(),
                    ob: hex_to_ob(&c.pubkey),
                    photo: c.photo.clone().unwrap_or_default(),
                    blocked: c.blocked,
                    last_message: last.map(|m| m.body.clone()).unwrap_or_default(),
                    last_ts: last.map_or(0, |m| m.ts),
                }
            })
            .collect();
        contacts.sort_by(|a, b| b.last_ts.cmp(&a.last_ts).then(a.name.cmp(&b.name)));

        let active_peer = model.active_peer.clone().unwrap_or_default();
        let active_contact = model.contacts.get(&active_peer);
        let messages: Vec<MessageVM> = model
            .messages
            .get(&active_peer)
            .map(|m| {
                m.iter()
                    .map(|s| MessageVM {
                        id: s.id.clone(),
                        body: s.body.clone(),
                        ts: s.ts,
                        outgoing: s.outgoing,
                        delivered: s.delivered,
                    })
                    .collect()
            })
            .unwrap_or_default();

        ViewModel {
            page: page.to_string(),
            has_identity: model.secret_key.is_some(),
            my_pubkey_hex: model.my_pubkey.clone(),
            my_pubkey_ob: hex_to_ob(&model.my_pubkey),
            conn_status: conn.to_string(),
            server_url: model.settings.server_url.clone(),
            profile: ProfileVM {
                display_name: model.profile.display_name.clone(),
                bio: model.profile.bio.clone(),
                photo: model.profile.photo.clone().unwrap_or_default(),
            },
            contacts,
            active_peer: active_peer.clone(),
            active_peer_name: active_contact.map_or_else(
                || trunc_ob(&active_peer),
                Contact::label,
            ),
            active_peer_ob: hex_to_ob(&active_peer),
            active_peer_blocked: active_contact.is_some_and(|c| c.blocked),
            messages,
            compose: model.compose.clone(),
            error: model.error.clone().unwrap_or_default(),
        }
    }
}

impl Skrepka {
    fn persist_contacts(&self, model: &Model) -> Command<Effect, Event> {
        let list: Vec<Contact> = model.contacts.values().cloned().collect();
        KeyValue::set(K_CONTACTS, json_bytes(&list)).then_send(Event::Saved)
    }

    fn persist_outbox(&self, model: &Model) -> Command<Effect, Event> {
        let list: Vec<OutboxItem> = model.outbox.iter().cloned().collect();
        KeyValue::set(K_OUTBOX, json_bytes(&list)).then_send(Event::Saved)
    }

    fn persist_messages(&self, model: &Model, peer: &str) -> Command<Effect, Event> {
        let list = model.messages.get(peer).cloned().unwrap_or_default();
        KeyValue::set(k_messages(peer), json_bytes(&list)).then_send(Event::Saved)
    }

    fn schedule_reconnect(&self, model: &mut Model) -> Command<Effect, Event> {
        let delay = backoff_ms(model.poll_retries);
        model.poll_retries = model.poll_retries.saturating_add(1);
        Time::notify_after(Duration::from_millis(delay))
            .0
            .then_send(|_| Event::Authenticate)
            .and(render())
    }

    fn backoff_poll(&self, model: &mut Model) -> Command<Effect, Event> {
        let delay = backoff_ms(model.poll_retries);
        model.poll_retries = model.poll_retries.saturating_add(1);
        Time::notify_after(Duration::from_millis(delay))
            .0
            .then_send(|_| Event::Poll)
            .and(render())
    }

    fn send_text(&self, model: &mut Model) -> Command<Effect, Event> {
        let Some(peer) = model.active_peer.clone() else {
            return render();
        };
        let body = model.compose.trim().to_string();
        if body.is_empty() {
            return render();
        }
        model.compose.clear();
        let ts = now_ms();
        let id = uuid::Uuid::new_v4().to_string();

        let convo = model.messages.entry(peer.clone()).or_default();
        let first_to_peer = !convo.iter().any(|m| m.outgoing);
        convo.push(StoredMessage {
            id: id.clone(),
            body: body.clone(),
            ts,
            outgoing: true,
            delivered: false,
        });

        // Auto-create a bare contact if messaging a brand-new key.
        model
            .contacts
            .entry(peer.clone())
            .or_insert_with(|| Contact::new(peer.clone(), String::new(), ts));

        let text = Payload::Text { id, body };
        model.outbox.push_back(OutboxItem {
            recipient: peer.clone(),
            envelope_json: protocol::serialize_payload(&text, ts),
        });
        // On first contact, also share our profile.
        if first_to_peer {
            let profile = Payload::Profile {
                display_name: model.profile.display_name.clone(),
                bio: model.profile.bio.clone(),
                photo: model.profile.photo.clone(),
            };
            model.outbox.push_back(OutboxItem {
                recipient: peer.clone(),
                envelope_json: protocol::serialize_payload(&profile, ts),
            });
        }

        Command::all([
            self.persist_messages(model, &peer),
            self.persist_contacts(model),
            self.persist_outbox(model),
        ])
        .and(Command::event(Event::StartFlush))
        .and(render())
    }

    fn flush_next(&self, model: &mut Model) -> Command<Effect, Event> {
        if model.flushing {
            return Command::done();
        }
        let Some(item) = model.outbox.front().cloned() else {
            return Command::done();
        };
        let (Some(id), Some(token)) = (model.identity(), model.token.clone()) else {
            return Command::done();
        };
        let Ok(recipient) = hex::decode(&item.recipient) else {
            // Bad recipient — drop it.
            model.outbox.pop_front();
            return self.persist_outbox(model).and(self.flush_next(model));
        };
        let mut recip = [0u8; 32];
        if recipient.len() != 32 {
            model.outbox.pop_front();
            return self.persist_outbox(model).and(self.flush_next(model));
        }
        recip.copy_from_slice(&recipient);

        let mut rng = rand_core::OsRng;
        let blob = match crate::crypto::encrypt(&mut rng, &id, &recip, item.envelope_json.as_bytes())
        {
            Ok(b) => b,
            Err(_) => {
                model.outbox.pop_front();
                return self.persist_outbox(model).and(self.flush_next(model));
            }
        };

        model.flushing = true;
        let batch = SendBatch {
            messages: vec![Envelope {
                to: item.recipient,
                encrypted_blob: hex::encode(blob),
            }],
        };
        let url = format!("{}/messages", model.settings.server_url);
        match Http::post(url)
            .header("authorization", format!("Bearer {token}"))
            .body_json(&batch)
        {
            Ok(req) => req.build().then_send(Event::SendResult),
            Err(_) => {
                model.flushing = false;
                render()
            }
        }
    }

    /// Decrypt and fold a poll page into the model; queue delivery acks.
    fn ingest_poll(&self, model: &mut Model, page: PollResp) -> Command<Effect, Event> {
        if page.cursor > model.cursor {
            model.cursor = page.cursor;
        }
        let Some(id) = model.identity() else {
            return Command::done();
        };

        let mut touched_convos: Vec<String> = Vec::new();
        let mut contacts_dirty = false;
        // sender hex -> message ids needing acks
        let mut ack_targets: BTreeMap<String, Vec<String>> = BTreeMap::new();

        for ev in page.events {
            let Ok(blob) = hex::decode(&ev.encrypted_blob) else {
                continue;
            };
            let Ok(dec) = crate::crypto::decrypt(&id, &blob) else {
                continue;
            };
            let Some(parsed) = protocol::parse_payload(&dec.plaintext) else {
                continue;
            };
            let sender = dec.sender_hex;
            match parsed.payload {
                Payload::Text { id: msg_id, body } => {
                    // auto-create contact
                    if !model.contacts.contains_key(&sender) {
                        model
                            .contacts
                            .insert(sender.clone(), Contact::new(sender.clone(), String::new(), parsed.ts));
                        contacts_dirty = true;
                    }
                    let convo = model.messages.entry(sender.clone()).or_default();
                    // dedup by id
                    if !convo.iter().any(|m| m.id == msg_id) {
                        convo.push(StoredMessage {
                            id: msg_id.clone(),
                            body,
                            ts: parsed.ts,
                            outgoing: false,
                            delivered: false,
                        });
                        convo.sort_by_key(|m| m.ts);
                        if !touched_convos.contains(&sender) {
                            touched_convos.push(sender.clone());
                        }
                    }
                    ack_targets.entry(sender).or_default().push(msg_id);
                }
                Payload::DeliveryAck { ack_ids } => {
                    if let Some(convo) = model.messages.get_mut(&sender) {
                        let mut changed = false;
                        for m in convo.iter_mut() {
                            if m.outgoing && ack_ids.contains(&m.id) && !m.delivered {
                                m.delivered = true;
                                changed = true;
                            }
                        }
                        if changed && !touched_convos.contains(&sender) {
                            touched_convos.push(sender);
                        }
                    }
                }
                Payload::Profile {
                    display_name,
                    bio,
                    photo,
                } => {
                    let c = model
                        .contacts
                        .entry(sender.clone())
                        .or_insert_with(|| Contact::new(sender.clone(), String::new(), parsed.ts));
                    // Ignore stale profile replays (PROTOCOL.md §4).
                    if parsed.ts >= c.last_profile_ts {
                        c.display_name = display_name;
                        c.bio = bio;
                        c.photo = photo;
                        c.last_profile_ts = parsed.ts;
                        contacts_dirty = true;
                    }
                }
            }
        }

        // Queue delivery acks (one payload per sender).
        let ack_ts = now_ms();
        for (sender, ids) in ack_targets {
            let payload = Payload::DeliveryAck { ack_ids: ids };
            model.outbox.push_back(OutboxItem {
                recipient: sender,
                envelope_json: protocol::serialize_payload(&payload, ack_ts),
            });
        }

        // Persist everything touched.
        let mut cmds: Vec<Command<Effect, Event>> = Vec::new();
        for peer in &touched_convos {
            cmds.push(self.persist_messages(model, peer));
        }
        if contacts_dirty {
            cmds.push(self.persist_contacts(model));
        }
        cmds.push(self.persist_outbox(model));
        cmds.push(Command::event(Event::StartFlush));
        Command::all(cmds)
    }
}

fn backoff_ms(retries: u32) -> u64 {
    (3000u64.saturating_mul(1u64 << retries.min(4))).min(30_000)
}

/// Decode a kv `get` result into a typed value, ignoring errors / absence.
fn parse_kv<T: for<'de> Deserialize<'de>>(res: KvData) -> Option<T> {
    let bytes = res.ok().flatten()?;
    serde_json::from_slice(&bytes).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::Identity;

    fn with_identity() -> Model {
        let id = Identity::from_seed(&[3u8; 32]);
        let mut m = Model::default();
        m.secret_key = Some(id.secret_key.to_vec());
        m.my_pubkey = id.public_key_hex();
        m
    }

    fn peer_hex(seed: u8) -> String {
        Identity::from_seed(&[seed; 32]).public_key_hex()
    }

    #[test]
    fn server_host_strips_scheme_port_and_case() {
        assert_eq!(server_host("https://Relay.Example.com:8443/x"), "relay.example.com");
        assert_eq!(server_host("http://localhost:8080"), "localhost");
        assert_eq!(server_host("relay.example.com."), "relay.example.com");
    }

    #[test]
    fn backoff_is_capped() {
        assert_eq!(backoff_ms(0), 3000);
        assert_eq!(backoff_ms(1), 6000);
        assert_eq!(backoff_ms(3), 24000);
        assert_eq!(backoff_ms(10), 30000);
    }

    #[test]
    fn add_contact_accepts_hex_and_rejects_self() {
        let app = Skrepka;
        let mut m = with_identity();
        let peer = peer_hex(9);
        let _ = app.update(
            Event::AddContact {
                input: peer.clone(),
                nickname: "Bob".into(),
            },
            &mut m,
        );
        assert!(m.contacts.contains_key(&peer));
        assert_eq!(m.contacts[&peer].nickname, "Bob");

        // adding own key is rejected with an error
        let mine = m.my_pubkey.clone();
        let _ = app.update(
            Event::AddContact {
                input: mine,
                nickname: String::new(),
            },
            &mut m,
        );
        assert!(m.error.is_some());
    }

    #[test]
    fn send_text_enqueues_message_profile_and_outbox() {
        let app = Skrepka;
        let mut m = with_identity();
        let peer = peer_hex(9);
        m.active_peer = Some(peer.clone());
        m.compose = "hello".into();

        let _ = app.update(Event::SendText, &mut m);

        // one outgoing message recorded
        let convo = &m.messages[&peer];
        assert_eq!(convo.len(), 1);
        assert!(convo[0].outgoing);
        assert_eq!(convo[0].body, "hello");
        // compose cleared, contact auto-created
        assert!(m.compose.is_empty());
        assert!(m.contacts.contains_key(&peer));
        // outbox has the text + a first-contact profile
        assert_eq!(m.outbox.len(), 2);
        assert_eq!(m.outbox[0].recipient, peer);
    }

    #[test]
    fn send_text_without_peer_or_empty_is_noop() {
        let app = Skrepka;
        let mut m = with_identity();
        m.compose = "x".into();
        let _ = app.update(Event::SendText, &mut m); // no active peer
        assert!(m.outbox.is_empty());

        m.active_peer = Some(peer_hex(9));
        m.compose = "   ".into();
        let _ = app.update(Event::SendText, &mut m); // whitespace only
        assert!(m.outbox.is_empty());
    }

    #[test]
    fn set_blocked_toggles_and_view_reflects_it() {
        let app = Skrepka;
        let mut m = with_identity();
        let peer = peer_hex(9);
        m.contacts
            .insert(peer.clone(), Contact::new(peer.clone(), "Bob".into(), 0));
        let _ = app.update(
            Event::SetBlocked {
                peer: peer.clone(),
                blocked: true,
            },
            &mut m,
        );
        assert!(m.contacts[&peer].blocked);
        let vm = app.view(&m);
        assert!(vm.contacts.iter().any(|c| c.pubkey == peer && c.blocked));
    }

    #[test]
    fn view_exposes_identity_and_ob() {
        let app = Skrepka;
        let m = with_identity();
        let vm = app.view(&m);
        assert!(vm.has_identity);
        assert_eq!(vm.my_pubkey_hex, m.my_pubkey);
        assert_eq!(vm.my_pubkey_ob.split('-').count(), 16);
    }
}
