//! Crux App — the MVU state machine for the skrepka client.
//!
//! The core owns all business logic: identity, auth, the long-poll loop, the
//! outbox, contacts, profiles, and message ingest. The shell provides HTTP,
//! key-value storage, a timer, and (natively, fed back as events) the Keychain,
//! QR scanning, photo picking, and clipboard.

use std::collections::{BTreeMap, HashMap, HashSet, VecDeque};
use std::sync::Arc;
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
use url::Url;
use zeroize::Zeroizing;

use crate::crypto::{Identity, MAX_BLOB_LEN};
use crate::model::{
    hex_to_ob, trunc_ob, Contact, ContactVM, MessageVM, OutboxItem, OwnProfile, ProfileVM,
    Settings, StoredMessage, ViewModel, DEFAULT_SERVER_URL, MAX_MESSAGES_PER_PEER,
};
use crate::phonemic;
use crate::protocol::{self, Envelope, Payload};

type Http = crux_http::command::Http<Effect, Event>;
type KeyValue = crux_kv::KeyValue<Effect, Event>;
type Time = crux_time::Time<Effect, Event>;
type HttpResult = crux_http::Result<crux_http::Response<Vec<u8>>>;
type KvData = Result<Option<Vec<u8>>, crux_kv::error::KeyValueError>;

/// How far into the future an incoming, sender-chosen `ts` may sit before it is
/// clamped to "now" — enough slack for honest clock skew, not enough to let a
/// peer park itself at the top of the conversation list.
const MAX_FUTURE_SKEW_MS: i64 = 60_000;

/// Cap on stored contacts.
///
/// Any stranger can create one just by sending us a message, so without a cap a
/// spammer holding a list of pubkeys can grow `contacts` (and the `contacts` kv
/// blob, rewritten in full on every change) without bound. Past the cap we drop
/// mail from unknown keys; contacts the user added by hand are never at risk,
/// because `AddContact` doesn't go through this path.
const MAX_CONTACTS: usize = 500;

/// Cap on the total blob bytes we will decrypt out of a single poll page.
///
/// A hostile relay can answer `/poll` with as many events as it likes. Each one
/// costs a hex decode, a scalar mult and an AEAD pass, all before we can tell it
/// is junk. `MAX_BLOB_LEN` bounds one blob; this bounds the page. Anything past
/// the budget is dropped exactly like an undecryptable blob would be.
const MAX_POLL_TOTAL_BYTES: usize = 64 * 1024 * 1024;

/// How long a poll may stay in flight before we assume the shell lost it.
///
/// `polling` gates the whole long-poll loop, and it is only cleared by a
/// `PollResult`. If the shell ever drops an HTTP effect (a cancelled task, a
/// backgrounded app, a bug), `polling` stays `true` and the client goes quiet
/// forever with no visible error. The watchdog re-arms the loop instead.
///
/// This **must** stay above the shell's own HTTP timeout (70 s, see
/// `Effects.swift`), or the watchdog stops being a watchdog: it would fire on
/// every poll that is merely slow rather than lost, abandoning a request the
/// shell is still going to resolve. The generation check in `PollResult` makes
/// that survivable, but each misfire still costs a redundant request to the
/// relay, so leave the margin.
const POLL_WATCHDOG_MS: u64 = 90_000;

/// Messages per `/messages` request.
///
/// The relay rejects a longer batch outright (`413 batch_too_large`,
/// PROTOCOL.md §7), so this is a hard ceiling, not a tuning knob.
const MAX_SEND_BATCH: usize = 100;

/// ...and a byte ceiling on the same batch, counted in hex characters — i.e. in
/// the units the request body is actually built from.
///
/// The count limit alone is not enough: a hundred profile broadcasts each
/// carrying a 64 KiB photo would build a request far past the 16 MiB body cap a
/// relay has by default (`--http-max-body-bytes`, PROTOCOL.md §7), and the whole
/// batch would come back `413` — which we read as a transient failure and retry,
/// forever. Bounding the body here keeps the batch inside what any conforming
/// relay accepts. A single item over the budget still goes out alone: it is the
/// relay's job to reject it, and its rejection is per-message and permanent.
const MAX_SEND_BATCH_BYTES: usize = 4 * 1024 * 1024;

/// Ceiling on a `Retry-After` we will honour from a relay.
///
/// The header is a number the relay chooses and we obey, so without a cap a
/// single `Retry-After: 999999999` — from a hostile relay, or a merely broken
/// one — parks the outbox for thirty years with nothing on screen to say why.
/// Five minutes is longer than any real rate-limit window and still recovers on
/// its own.
const MAX_RETRY_AFTER_MS: u64 = 5 * 60 * 1000;

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
    /// Forget a peer entirely: the contact, the conversation, and anything still
    /// queued for them. Blocking only silences a peer; the entry stays in the
    /// list forever, and there was no way to be rid of it.
    DeleteContact { peer: String },
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
    /// The cursor write specifically: the next poll is chained off it, so that a
    /// message is never acked to the server before it is durable locally.
    #[serde(skip)]
    #[facet(skip)]
    SavedCursor(#[facet(opaque)] KvData),

    // ---- internal: auth / poll / send ----
    // These drive the core's own loops and are never sent by the shell, so they
    // are kept off the FFI surface entirely.
    //
    // The auth and poll results carry the *generation* of the round-trip that
    // produced them. An in-flight effect is never cancelled — it can only be
    // superseded — so without a generation a result belonging to an attempt we
    // already abandoned lands in the handler for the attempt that replaced it.
    // See `Model::poll_gen`.
    #[serde(skip)]
    #[facet(skip)]
    Authenticate,
    #[serde(skip)]
    #[facet(skip)]
    Poll,
    /// Fires `POLL_WATCHDOG_MS` after generation `n`'s poll is issued; a no-op
    /// unless that exact poll is somehow still in flight.
    #[serde(skip)]
    #[facet(skip)]
    PollWatchdog(u64),
    #[serde(skip)]
    #[facet(skip)]
    StartFlush,
    #[serde(skip)]
    #[facet(skip)]
    ChallengeResult(u64, #[facet(opaque)] HttpResult),
    #[serde(skip)]
    #[facet(skip)]
    VerifyResult(u64, #[facet(opaque)] HttpResult),
    #[serde(skip)]
    #[facet(skip)]
    PollResult(u64, #[facet(opaque)] HttpResult),
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

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum Page {
    /// The shell renders a spinner until `IdentityLoaded` arrives, so there is
    /// no distinct pre-identity page — conversations is the landing page.
    #[default]
    Conversations,
    Chat,
    AddContact,
    Settings,
    EditProfile,
}

/// The five kv keys loaded at startup (`settings`, `profile`, `contacts`,
/// `cursor`, `outbox`). `Connect` waits for all of them.
const STARTUP_LOADS: u8 = 5;

/// The batch a live `/messages` request is carrying: the first `count` items of
/// the outbox, all bound for `recipient`.
///
/// `SendResult` needs all three. The count is what it pops on success and what it
/// charges a retry against on a transient failure; the recipient is what tells
/// `SetBlocked` and `DeleteContact` whether the items they are about to remove
/// are the very ones this send is going to pop; and `bytes` — the size of the
/// body we actually built — is what a `413` halves to find a batch this relay
/// will accept (see `Model::send_batch_budget`).
struct InFlight {
    recipient: String,
    count: usize,
    bytes: usize,
}

pub struct Model {
    /// Zeroized on drop: this is the Ed25519 seed, the one secret whose leak
    /// costs the user their identity.
    secret_key: Option<Zeroizing<Vec<u8>>>,
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
    /// The send loop's own backoff counter, spent when a `429` arrives with no
    /// `Retry-After` to obey. Kept apart from `poll_retries` because the poll loop
    /// resets that one on every page it takes: a client polling happily while the
    /// relay rate-limits its sends would restart the send backoff at 3 s forever,
    /// which is not a backoff.
    send_retries: u32,
    /// A poll request is in flight. Guards against stacking concurrent long-poll
    /// loops (every extra loop re-polls itself forever and never terminates).
    polling: bool,
    /// Which poll the in-flight `PollResult` is allowed to belong to.
    ///
    /// Bumped every time a poll is issued, and every time one is *abandoned* (the
    /// watchdog gives up on it; a relay switch invalidates it). A `PollResult`
    /// whose generation no longer matches is dropped on the floor.
    ///
    /// A wall-clock "has it been long enough?" test cannot do this job. An HTTP
    /// effect stays pending across an iOS suspension while `now_ms()` runs on, so
    /// on resume *every* in-flight poll looks stuck — the watchdog abandons a
    /// request the shell is still about to resolve, and that resolution then
    /// clears the guard belonging to its replacement. Two poll loops, each
    /// re-polling itself forever. The generation is what makes abandoning safe.
    poll_gen: u64,
    /// An auth round-trip is in flight. `Connect` is fired from several places
    /// (startup, a 401, a reconnect timer, a server change); without this guard
    /// they stack, and each one that lands installs a token and starts its own
    /// poll loop.
    authenticating: bool,
    /// The same idea for the auth round-trip, which spans two legs (challenge →
    /// verify) and is restarted by `Connect` — which the shell fires on *every*
    /// return to the foreground (`SkrepkaApp.swift`). The challenge still in
    /// flight from before the app was backgrounded must not install a token or
    /// overwrite `conn` on top of the attempt that replaced it.
    auth_gen: u64,
    /// A `/messages` request is in flight. One at a time: `SendResult` pops the
    /// items it sent off the head of the outbox, so two overlapping sends would
    /// pop each other's messages.
    flushing: bool,
    /// What the in-flight send will pop off the head of the outbox when it
    /// succeeds — see `InFlight`. `None` while nothing is in flight, and also
    /// while a send is in flight whose items have since been removed from under
    /// it (`SetBlocked`, `DeleteContact`): there is then nothing left to pop, and
    /// popping by count anyway would eat whichever messages slid into their place.
    in_flight: Option<InFlight>,
    /// What this relay will actually accept as a request body, in hex characters,
    /// once it has told us. `None` until then — meaning "assume
    /// `MAX_SEND_BATCH_BYTES`", which is a guess at a cap the protocol never
    /// publishes.
    ///
    /// A relay configured below our guess answers `413`, and a `413` read as a
    /// transient failure is a batch that is rebuilt identically, rejected
    /// identically, and retried until every item in it has burned its retry budget
    /// and been dropped — the outbox drains into the void without a single message
    /// leaving. So a `413` *measures* the cap instead: halve what we just tried and
    /// rebuild smaller. It is deliberately not reset on success — the batch that
    /// worked is evidence about the relay, and the relay's cap does not grow — only
    /// on a server change, where the evidence no longer applies.
    send_batch_budget: Option<usize>,
    /// Startup kv loads still outstanding. `Connect` only fires at 0, so a poll
    /// can't land and be persisted against a half-loaded model — which would
    /// then be clobbered by the loads still in flight.
    loads_pending: u8,
    /// A startup kv *read* failed — as opposed to finding the key absent.
    ///
    /// The distinction is the whole point of `parse_kv`'s `Result<Option<T>, ()>`:
    /// an absent key is a fresh install and defaulting is right, but a failed read
    /// leaves a hole in the model over data that is still on disk, and writing that
    /// hole back destroys it. The outbox is the sharpest case — `ingest_poll`
    /// persists it on *every* poll page, so a single failed read followed by one
    /// empty poll writes `[]` over a queue of real, unsent messages.
    ///
    /// So this latches the model as untrustworthy, and every write path checks it:
    /// no persist, no ingest, no flush. Nothing is lost, because nothing is
    /// written — the data stays on disk for the next launch, which re-runs the
    /// loads (`IdentityLoaded` fires on every boot) and clears the flag if they
    /// succeed. It is deliberately one flag and not a per-key set: a read that
    /// fails because the device is locked fails for every key, and a model that is
    /// wrong about its outbox is not one to be trusted about its contacts either.
    kv_load_failed: bool,
    /// `now_ms()` before which `flush_next` must not send.
    ///
    /// A `429` schedules a `StartFlush` for the far side of the relay's
    /// `Retry-After`, but that timer is not the only thing that fires one — a poll
    /// page and a fresh `SendText` both do. Without a pause the wait is decorative:
    /// the next poll page walks straight through it and hammers the relay that just
    /// asked us to stop.
    flush_paused_until: i64,
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
            send_retries: 0,
            polling: false,
            poll_gen: 0,
            authenticating: false,
            auth_gen: 0,
            flushing: false,
            in_flight: None,
            send_batch_budget: None,
            loads_pending: 0,
            kv_load_failed: false,
            flush_paused_until: 0,
            page: Page::default(),
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

    /// Tick off one startup load. Returns `true` exactly once — when the last of
    /// the five lands — so `Connect` is emitted a single time.
    fn startup_load_done(&mut self) -> bool {
        if self.loads_pending == 0 {
            return false;
        }
        self.loads_pending -= 1;
        self.loads_pending == 0
    }

    /// Open a new poll generation and return it. Any `PollResult` still in flight
    /// under the old generation is now dead to us.
    fn next_poll_gen(&mut self) -> u64 {
        self.poll_gen = self.poll_gen.wrapping_add(1);
        self.poll_gen
    }

    /// Abandon the in-flight poll, if any: release the loop guard and retire the
    /// generation so a late `PollResult` cannot clear the *replacement* poll's
    /// guard or fold a stale page (and a stale cursor) into the model.
    fn abandon_poll(&mut self) {
        self.polling = false;
        self.poll_gen = self.poll_gen.wrapping_add(1);
    }

    /// Open a new auth generation and return it.
    fn next_auth_gen(&mut self) -> u64 {
        self.auth_gen = self.auth_gen.wrapping_add(1);
        self.auth_gen
    }

    /// Abandon the in-flight auth round-trip (either leg).
    fn abandon_auth(&mut self) {
        self.authenticating = false;
        self.auth_gen = self.auth_gen.wrapping_add(1);
    }

    /// Every item bound for `peer` is about to be removed from the outbox. If the
    /// send in flight is the one carrying them, forget what it was going to pop:
    /// those items will not be there when it lands, and popping by count anyway
    /// would take whatever slid into their place — another peer's mail.
    ///
    /// The `flushing` guard stays up. Nothing can cancel the request; it is still
    /// out there, and a second send started underneath it would have its own items
    /// popped by the first one's result.
    fn detach_in_flight(&mut self, peer: &str) {
        if self.in_flight.as_ref().is_some_and(|f| f.recipient == peer) {
            self.in_flight = None;
        }
    }

    /// How many items at the head of the outbox are already on the wire, and so
    /// must not be rewritten in place (their ciphertext is built and gone).
    fn in_flight_count(&self) -> usize {
        self.in_flight.as_ref().map_or(0, |f| f.count)
    }
}

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

/// Wall-clock milliseconds.
///
/// This reads the system clock from inside `update()`, which is supposed to be a
/// pure function of `(Event, Model)`. It isn't, and that has real costs: the
/// state machine can't be replayed deterministically, and tests can't pin "now".
/// The clean fix is to take the time as a `crux_time` effect and feed it back in
/// as an event — but every timestamped path (`SendText`, `SaveProfile`,
/// `ingest_poll`) would have to become a two-step round-trip through the shell.
/// That refactor is worth doing; it is not worth folding into a bug-fix pass, so
/// the impurity is documented rather than hidden.
// TODO: replace with crux_time effect for deterministic timestamps
fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Bare lowercased hostname of a server URL (no scheme/port/trailing dot).
///
/// This feeds the auth signature, which is bound to the host (PROTOCOL.md §6),
/// so it must agree with what the relay itself computes. Splitting on `:` by hand
/// mangles an IPv6 literal (`http://[::1]:8080` → `[`), producing a signature the
/// server rejects; `Url` gets the bracket rules right.
fn server_host(url: &str) -> String {
    Url::parse(url)
        .ok()
        .and_then(|u| u.host_str().map(str::to_string))
        .map(|h| h.trim_end_matches('.').to_lowercase())
        .unwrap_or_default()
}

/// Validate and canonicalize a user-entered relay URL.
///
/// The shell hands us raw text-field contents and `crux_http` unwraps the parse,
/// so anything the real parser rejects must be rejected *here* or it panics the
/// core. That means validating with the same parser rather than a lookalike: the
/// hand-rolled check this replaces accepted `http://[bad` and `http://ho^st`,
/// both of which `Url::parse` refuses.
///
/// A query or fragment is rejected too. Every request appends a path
/// (`{url}/poll`), so `http://x?y` would yield `http://x?y/poll` — the path
/// swallowed into the query string, pointing at nothing.
///
/// Returns the normalized URL (no trailing slash) or `None`.
fn normalize_server_url(input: &str) -> Option<String> {
    let url = Url::parse(input.trim()).ok()?;
    if !matches!(url.scheme(), "http" | "https") {
        return None;
    }
    if url.host_str().is_none_or(str::is_empty) {
        return None;
    }
    if url.query().is_some() || url.fragment().is_some() {
        return None;
    }
    Some(url.as_str().trim_end_matches('/').to_string())
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
                model.secret_key = Some(Zeroizing::new(sk));
                model.my_pubkey = id.public_key_hex();
                model.page = Page::Conversations;
                // Fan out the startup loads. `Connect` waits until the last of
                // them lands (see `startup_load_done`).
                model.loads_pending = STARTUP_LOADS;
                // A fresh round of loads: whatever a previous one failed to read,
                // this one gets to answer for. Clearing it here is what lets a
                // relaunch recover from a locked-device read failure.
                model.kv_load_failed = false;
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
                match parse_kv::<Settings>(res) {
                    Ok(Some(s)) => {
                        // Re-validate on the way in. The URL was normalized when the
                        // user typed it, but the blob on disk is not trustworthy: an
                        // older build wrote URLs this parser rejects, and a corrupted
                        // or hand-edited file would reach `Http::post`, which unwraps
                        // the parse. That is a panic on every launch — a boot loop
                        // with no way out from inside the app.
                        model.settings.server_url = normalize_server_url(&s.server_url)
                            .unwrap_or_else(|| DEFAULT_SERVER_URL.to_string());
                    }
                    Ok(None) => {}
                    Err(()) => {
                        model.kv_load_failed = true;
                        model.error = Some("could not read settings from storage".into());
                    }
                }
                self.startup_done(model).and(render())
            }
            Event::LoadedProfile(res) => {
                match parse_kv::<OwnProfile>(res) {
                    Ok(Some(p)) => model.profile = p,
                    Ok(None) => {}
                    Err(()) => {
                        model.kv_load_failed = true;
                        model.error = Some("could not read profile from storage".into());
                    }
                }
                self.startup_done(model).and(render())
            }
            Event::LoadedContacts(res) => {
                let mut cmds = vec![self.startup_done(model)];
                match parse_kv::<Vec<Contact>>(res) {
                    Ok(Some(list)) => {
                        model.contacts = list.into_iter().map(|c| (c.pubkey.clone(), c)).collect();
                        // Lazily load each conversation's messages.
                        cmds.extend(model.contacts.keys().map(|peer| {
                            let peer = peer.clone();
                            KeyValue::get(k_messages(&peer))
                                .then_send(move |r| Event::LoadedMessages(peer.clone(), r))
                        }));
                    }
                    Ok(None) => {}
                    Err(()) => {
                        model.kv_load_failed = true;
                        model.error = Some("could not read contacts from storage".into());
                    }
                }
                Command::all(cmds).and(render())
            }
            Event::LoadedCursor(res) => {
                match parse_kv::<i64>(res) {
                    Ok(Some(c)) => model.cursor = c,
                    Ok(None) => {}
                    Err(()) => {
                        model.kv_load_failed = true;
                        model.error = Some("could not read cursor from storage".into());
                    }
                }
                self.startup_done(model).and(render())
            }
            Event::LoadedOutbox(res) => {
                match parse_kv::<Vec<OutboxItem>>(res) {
                    Ok(Some(list)) => model.outbox = list.into(),
                    Ok(None) => {}
                    Err(()) => {
                        model.kv_load_failed = true;
                        model.error = Some("could not read outbox from storage".into());
                    }
                }
                self.startup_done(model).and(render())
            }
            Event::LoadedMessages(peer, res) => {
                match parse_kv::<Vec<StoredMessage>>(res) {
                    Ok(Some(list)) => {
                        model.messages.insert(peer, list);
                    }
                    Ok(None) => {}
                    Err(()) => {
                        // Leaving the conversation absent is not enough on its own.
                        // An absent conversation is an *empty* one to everything
                        // downstream, so the next message from this peer would be
                        // appended to nothing and `persist_messages` would write
                        // that one message over the whole history still on disk.
                        // Latch the model as untrustworthy instead — same reasoning
                        // as the outbox, same fix.
                        model.kv_load_failed = true;
                        model.error = Some("could not read messages from storage".into());
                    }
                }
                render()
            }
            Event::Saved(res) => {
                // A dropped write silently loses data (a message, a contact, the
                // cursor), so surface it rather than swallowing the result.
                if let Err(e) = res {
                    model.error = Some(format!("could not save data: {e}"));
                    return render();
                }
                Command::done()
            }
            Event::SavedCursor(res) => {
                // The cursor write is what tells the relay it may delete the mail
                // we just took (it acks up to `cursor` on the next poll). Only
                // re-poll once it has actually landed: if we polled in parallel
                // and the write failed, the messages would be gone from the
                // server and absent from disk.
                if let Err(e) = res {
                    model.error = Some(format!("could not save data: {e}"));
                    return self.backoff_poll(model);
                }
                Command::event(Event::Poll)
            }

            // ---------------- navigation ----------------
            // `error` is about the thing the user was just doing. Leaving it set
            // across a page change strands a stale message ("invalid public key")
            // on an unrelated screen, so every navigation clears it.
            Event::ShowConversations => {
                model.page = Page::Conversations;
                model.active_peer = None;
                model.error = None;
                render()
            }
            Event::ShowSettings => {
                model.page = Page::Settings;
                model.error = None;
                render()
            }
            Event::ShowAddContact => {
                model.page = Page::AddContact;
                model.error = None;
                render()
            }
            Event::ShowEditProfile => {
                model.page = Page::EditProfile;
                model.error = None;
                render()
            }
            Event::OpenChat(peer) => {
                model.active_peer = Some(peer);
                model.page = Page::Chat;
                model.error = None;
                render()
            }
            Event::Back => {
                model.page = Page::Conversations;
                model.active_peer = None;
                model.error = None;
                render()
            }

            // ---------------- user actions ----------------
            Event::ComposeChanged(s) => {
                model.compose = s;
                render()
            }
            Event::SetServerUrl(url) => {
                let Some(url) = normalize_server_url(&url) else {
                    model.error = Some("server URL must be an http(s) address".into());
                    return render();
                };
                model.error = None;
                model.settings.server_url = url;
                model.token = None;
                model.conn = ConnStatus::Offline;
                // Whatever we learned about the old relay's body cap was about *it*.
                // A new relay is entitled to a bigger one, and carrying a shrunken
                // budget over would cap our batches against a limit that no longer
                // exists — with no `413` left to correct it, since the new relay has
                // no reason to send one.
                model.send_batch_budget = None;
                // The cursor is *per relay*: it is that server's own sequence
                // number, and the next poll acks everything up to it. Carrying
                // relay A's cursor (roughly `now_ms()`) over to relay B tells B
                // to delete every message queued for us before it hands any of
                // them over. Start B from the beginning.
                model.cursor = 0;
                // ...and retire the poll that is still in flight *to relay A*, or
                // resetting the cursor achieves nothing: A's answer is already on
                // its way, it carries A's cursor, and `ingest_poll` would write it
                // straight back over the zero we just set. The next poll — to B —
                // would then ack a sequence number B never issued, and B would
                // drop every message waiting for us.
                model.abandon_poll();
                // The old relay's rate limit was the old relay's opinion. A new one is
                // entitled to take our sends immediately, and carrying the pause over
                // would park the outbox against a limit that no longer applies.
                model.flush_paused_until = 0;
                model.send_retries = 0;
                let writes = if self.refuse_write(model) {
                    Command::done()
                } else {
                    Command::all([
                        KeyValue::set(K_SETTINGS, json_bytes(&model.settings))
                            .then_send(Event::Saved),
                        KeyValue::set(K_CURSOR, json_bytes(&0i64)).then_send(Event::Saved),
                    ])
                };
                writes.and(Command::event(Event::Connect)).and(render())
            }
            Event::Connect => {
                // Connect restarts the auth flow, so whatever challenge/verify was
                // in flight is now stale and its guard must come off. Retiring the
                // generation as we do it is what makes that safe: the shell fires
                // Connect on every return to the foreground, so the round-trip we
                // are dropping here is usually one that is still very much alive
                // and about to resolve. Clearing the guard alone would let it land
                // and install its token on top of the attempt replacing it.
                model.abandon_auth();
                // The shell fires `Connect` on every return to the foreground. A model
                // that failed a startup read must not take that invitation: connecting
                // leads to polling, and polling into a hole acks mail to the relay that
                // we cannot store. Staying offline is what keeps the disk intact until
                // a relaunch re-runs the loads.
                if model.kv_load_failed {
                    return render();
                }
                if model.secret_key.is_some() && model.conn != ConnStatus::Online {
                    Command::event(Event::Authenticate)
                } else if model.secret_key.is_some()
                    && model.conn == ConnStatus::Online
                    && !model.polling
                {
                    // The poll loop can die without `conn` going offline: after
                    // `PollResult` clears `polling`, the re-poll is chained off
                    // `SavedCursor`. If the shell drops that effect (backgrounded
                    // app, bug), `polling` stays `false` with no pending re-poll
                    // and the watchdog sees `!polling` and does nothing. The
                    // status shows "online" but no polling ever happens. Restart
                    // the loop here — `Connect` is fired on every foreground return.
                    Command::event(Event::Poll)
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
                if blocked {
                    // Gating *ingest* on the block only stops the acks we have not
                    // queued yet. Anything already sitting in the outbox for this
                    // peer — an ack for the very message that made the user block
                    // them, a profile from the last broadcast — still flushes, and
                    // an ack is precisely the "we are online and reading you"
                    // signal the block is supposed to cut off. Drop it all: once
                    // blocked, nothing more goes to this peer.
                    model.outbox.retain(|item| item.recipient != peer);
                    model.detach_in_flight(&peer);
                    return Command::all([self.persist_contacts(model), self.persist_outbox(model)])
                        .and(render());
                }
                self.persist_contacts(model).and(render())
            }
            Event::DeleteContact { peer } => {
                model.contacts.remove(&peer);
                model.messages.remove(&peer);
                model.outbox.retain(|item| item.recipient != peer);
                // The send in flight may be carrying the very items we just
                // dropped; if so its result must pop nothing.
                model.detach_in_flight(&peer);
                if model.active_peer.as_deref() == Some(peer.as_str()) {
                    model.active_peer = None;
                    model.page = Page::Conversations;
                }
                model.error = None;
                Command::all([
                    self.persist_contacts(model),
                    // The conversation is gone from the model, but `persist_messages`
                    // would leave a `messages:<peer>` blob behind holding every
                    // message the user just asked us to forget. Delete the key.
                    KeyValue::delete(k_messages(&peer)).then_send(Event::Saved),
                    self.persist_outbox(model),
                ])
                .and(render())
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
                // Broadcast the new profile to every contact we haven't blocked.
                // Blocking is meant to cut the peer off in both directions; a
                // profile broadcast would keep feeding them our display name,
                // avatar, and a liveness signal.
                //
                // One `Arc<String>` for the whole fan-out: the payload carries a
                // base64 photo, and a copy per contact would be megabytes in memory
                // for a list of any size. (The `outbox` kv blob still serializes the
                // string once per item — serde has no idea the `Arc`s are shared —
                // but the supersede-in-place below caps that at one pending profile
                // per contact, which is the bound that actually matters.)
                let recipients: Vec<String> = model
                    .contacts
                    .values()
                    .filter(|c| !c.blocked)
                    .map(|c| c.pubkey.clone())
                    .collect();
                let payload_json = Arc::new(protocol::serialize_payload(&payload, ts));
                // Items already on the wire cannot be rewritten: their ciphertext is
                // built and gone, and `SendResult` will pop them on success — so a
                // payload swapped into one now would be dropped having never been
                // sent. Supersede only what is still behind them.
                let live = model.in_flight_count();
                for peer in recipients {
                    // A profile is state, not an event: only the newest one means
                    // anything. Overwrite the pending one for this peer instead of
                    // queueing a second — five quick edits to a profile with a photo
                    // would otherwise be five payloads per contact, each of which we
                    // then encrypt and send.
                    match model
                        .outbox
                        .iter_mut()
                        .skip(live)
                        .find(|i| i.is_profile() && i.recipient == peer)
                    {
                        Some(pending) => pending.envelope_json = Arc::clone(&payload_json),
                        None => model
                            .outbox
                            .push_back(OutboxItem::profile(peer, Arc::clone(&payload_json))),
                    }
                }
                Command::all([
                    self.persist_profile(model),
                    self.persist_outbox(model),
                ])
                .and(Command::event(Event::StartFlush))
                .and(render())
            }
            Event::SendText => self.send_text(model),

            // ---------------- auth ----------------
            Event::Authenticate => {
                // Exactly one auth round-trip at a time. `Authenticate` is reached
                // from startup, a 401 on poll, a 401 on send, a reconnect timer
                // and a server change — all of which can fire at once after a
                // network blip. Each one that got through would hit
                // `/auth/challenge`, and each token that came back would install
                // itself and kick off another poll loop.
                if model.authenticating {
                    return Command::done();
                }
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
                    Ok(req) => {
                        model.authenticating = true;
                        let gen = model.next_auth_gen();
                        req.build()
                            .then_send(move |r| Event::ChallengeResult(gen, r))
                            .and(render())
                    }
                    Err(_) => {
                        model.conn = ConnStatus::Offline;
                        model.error = Some("could not build auth request".into());
                        self.schedule_reconnect(model)
                    }
                }
            }
            Event::ChallengeResult(gen, res) => {
                // A challenge from an attempt we already gave up on (a relay
                // switch, a foreground `Connect`). Its `authenticating` is not
                // ours to clear and its challenge is not ours to sign.
                if gen != model.auth_gen {
                    return Command::done();
                }
                // Cleared here and re-set only if the verify leg actually goes
                // out — every exit from this arm must leave the guard consistent.
                model.authenticating = false;
                let Ok(mut resp) = res else {
                    model.conn = ConnStatus::Offline;
                    return self.schedule_reconnect(model);
                };
                let bytes = resp.take_body().unwrap_or_default();
                let Some(id) = model.identity() else {
                    return render();
                };
                let Ok(c) = serde_json::from_slice::<ChallengeResp>(&bytes) else {
                    model.conn = ConnStatus::Offline;
                    return self.schedule_reconnect(model);
                };
                let host = server_host(&model.settings.server_url);
                let Ok(signature) = id.sign_challenge(&host, &c.challenge) else {
                    // An over-long challenge: a relay trying to get us to sign
                    // something of its choosing. Back off rather than comply.
                    model.conn = ConnStatus::Offline;
                    model.error = Some("relay sent a malformed auth challenge".into());
                    return self.schedule_reconnect(model);
                };
                let url = format!("{}/auth/verify", model.settings.server_url);
                let body = VerifyReq {
                    pubkey: &id.public_key_hex(),
                    challenge: &c.challenge,
                    signature: &signature,
                    revoke_others: false,
                };
                match Http::post(url).body_json(&body) {
                    Ok(req) => {
                        model.authenticating = true;
                        // The verify leg belongs to the same attempt as the
                        // challenge that produced it, so it keeps the generation
                        // rather than opening a new one.
                        req.build().then_send(move |r| Event::VerifyResult(gen, r))
                    }
                    Err(_) => {
                        model.conn = ConnStatus::Offline;
                        model.error = Some("could not build auth request".into());
                        self.schedule_reconnect(model)
                    }
                }
            }
            Event::VerifyResult(gen, res) => {
                if gen != model.auth_gen {
                    return Command::done();
                }
                model.authenticating = false;
                let Ok(mut resp) = res else {
                    model.conn = ConnStatus::Offline;
                    return self.schedule_reconnect(model);
                };
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

            // ---------------- poll ----------------
            Event::Poll => {
                // Exactly one poll loop at a time: each PollResult re-issues Poll,
                // so a second concurrent loop would double forever.
                if model.polling {
                    return Command::done();
                }
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
                    Ok(req) => {
                        model.polling = true;
                        let gen = model.next_poll_gen();
                        // Arm the watchdog alongside the request: if this poll
                        // never resolves, nothing else will ever clear `polling`.
                        req.build()
                            .then_send(move |r| Event::PollResult(gen, r))
                            .and(
                                Time::notify_after(Duration::from_millis(POLL_WATCHDOG_MS))
                                    .0
                                    .then_send(move |_| Event::PollWatchdog(gen)),
                            )
                    }
                    Err(_) => {
                        model.error = Some("could not build poll request".into());
                        self.backoff_poll(model)
                    }
                }
            }
            Event::PollWatchdog(gen) => {
                // Only the poll this watchdog was armed for, and only while it is
                // still the current one and still in flight. A watchdog whose poll
                // already completed (or was superseded) is a stale timer and must
                // not touch a healthy successor.
                if gen != model.poll_gen || !model.polling {
                    return Command::done();
                }
                // Retire it as we give up on it. The request itself is not
                // cancelled — nothing can cancel it — so if it *does* eventually
                // resolve, the generation check below is what stops it from
                // clearing the replacement poll's guard and forking the loop.
                model.abandon_poll();
                Command::event(Event::Poll)
            }
            Event::PollResult(gen, res) => {
                // A result for a poll we already abandoned. Dropping the page is
                // safe — and required. We never wrote a cursor for it, so the
                // relay still holds every message in it and the current poll will
                // be handed them again; whereas honouring it here would clear a
                // guard that now belongs to a *different*, live poll, and the
                // re-poll it chains would be a second loop re-polling itself
                // forever alongside the first.
                if gen != model.poll_gen {
                    return Command::done();
                }
                model.polling = false;
                let Ok(mut resp) = res else {
                    return self.backoff_poll(model);
                };
                let status = u16::from(resp.status());
                if status == 401 {
                    model.token = None;
                    return Command::event(Event::Authenticate);
                }
                if !(200..300).contains(&status) {
                    return self.backoff_poll(model);
                }
                model.poll_retries = 0;
                // Ingesting a page into a model with a hole in it is the worst thing
                // this client can do. The cursor write below is what lets the relay
                // delete the mail we just took, so a page ingested into a model that
                // cannot persist it is a page destroyed on both sides at once. Stop
                // the poll loop instead — it restarts on the next launch, which
                // re-runs the loads.
                if model.kv_load_failed {
                    model.error = Some(
                        "storage read failed — restart the app; messages are not being saved"
                            .into(),
                    );
                    return render();
                }
                let bytes = resp.take_body().unwrap_or_default();
                let parsed: PollResp = serde_json::from_slice(&bytes).unwrap_or_default();
                let cmd = self.ingest_poll(model, parsed);
                // The re-poll hangs off the *cursor write*, not off this event.
                // Polling again is what acks the batch we just took — the server
                // deletes everything up to `cursor` — so it must not happen until
                // the batch is durable on our side. `SavedCursor` re-polls.
                cmd.and(
                    KeyValue::set(K_CURSOR, json_bytes(&model.cursor))
                        .then_send(Event::SavedCursor),
                )
                .and(render())
            }

            // ---------------- outbox ----------------
            Event::StartFlush => self.flush_next(model),
            Event::SendResult(Ok(resp)) => {
                // The in-flight send is over; `flush_next` refuses to run while
                // this is set, so it must be cleared before *any* branch below.
                model.flushing = false;
                let batch = model.in_flight.take();
                let status = u16::from(resp.status());
                if status == 401 {
                    model.token = None;
                    // The batch stays exactly as it is — re-auth, then re-send it.
                    return Command::event(Event::Authenticate);
                }
                if status == 429 {
                    // Rate-limited. Not a delivery failure and not the items'
                    // fault, so they are not charged a retry — a client that spent
                    // its delivery budget on the relay's load would drop perfectly
                    // good messages for being sent too enthusiastically. They stay
                    // queued untouched; we just wait.
                    //
                    // `Retry-After` is the relay saying how long. Only the
                    // delta-seconds form is read — the HTTP-date form falls back to
                    // our own backoff — and it is clamped either way, because
                    // obeying an unbounded number from a relay is how the outbox
                    // gets parked forever.
                    let delay = resp
                        .header("retry-after")
                        .map(|v| v.last().as_str())
                        .and_then(|v| v.trim().parse::<u64>().ok())
                        .map_or_else(
                            || {
                                // Nothing to honour, so guess — on the *send* loop's
                                // counter, not the poll loop's. `poll_retries` is reset
                                // by every page the poll loop takes, so a client polling
                                // happily while the relay throttles its sends would
                                // restart the send backoff at 3 s on every page, forever.
                                // That is not a backoff; it is a fixed 3 s retry dressed
                                // as one.
                                let ms = backoff_ms(model.send_retries);
                                model.send_retries = model.send_retries.saturating_add(1);
                                Duration::from_millis(ms)
                            },
                            |secs| {
                                Duration::from_millis(
                                    secs.saturating_mul(1000).min(MAX_RETRY_AFTER_MS),
                                )
                            },
                        );
                    // Park the send loop for the duration, on the *model*. The timer
                    // below is not the only thing that fires `StartFlush` — a poll page
                    // and a fresh `SendText` both do — and without a pause they walk
                    // straight through the wait and hammer the relay that just asked us
                    // to stop. `flush_next` refuses to send until this passes, whoever
                    // wakes it.
                    model.flush_paused_until =
                        now_ms().saturating_add(i64::try_from(delay.as_millis()).unwrap_or(i64::MAX));
                    return Time::notify_after(delay)
                        .0
                        .then_send(|_| Event::StartFlush)
                        .and(render());
                }
                if status == 413 {
                    // The body outgrew what this relay accepts. `MAX_SEND_BATCH_BYTES`
                    // is only a guess at that cap, and this relay's is smaller — so
                    // treating the `413` as transient rebuilds the very same batch,
                    // which is rejected the very same way, forever.
                    //
                    // Measure the cap instead: halve what this batch actually
                    // weighed and rebuild under that. The items are untouched (we
                    // only pop on 200/400), so there is nothing to re-queue.
                    //
                    // Only a *splittable* batch takes this path. A lone item over
                    // the cap cannot be made any smaller, and halving the budget
                    // around it would spin — `flush_next` always takes the first
                    // item whatever it weighs. It falls through to `retry_batch`,
                    // whose budget is what eventually drops it, with an error the
                    // user can see.
                    if let Some(b) = batch.as_ref().filter(|b| b.count > 1) {
                        model.send_batch_budget = Some(b.bytes / 2);
                        return self.flush_next(model);
                    }
                }
                if (200..300).contains(&status) || status == 400 {
                    // The batch was accepted, or rejected outright (`self_send` /
                    // `invalid_message` — both permanent, and the relay takes a
                    // batch all-or-nothing). Either way it is finished with.
                    //
                    // The relay is taking our sends again, so the rate-limit backoff
                    // has done its job: forget it, or the *next* 429 — possibly hours
                    // later, under load that has nothing to do with this one — starts
                    // at whatever height the last one climbed to.
                    model.send_retries = 0;
                    for _ in 0..batch.map_or(0, |b| b.count) {
                        model.outbox.pop_front();
                    }
                    return self.persist_outbox(model).and(self.flush_next(model));
                }
                // A transient failure: a 5xx, a rate limit, a relay restarting.
                self.retry_batch(model, batch)
            }
            Event::SendResult(Err(_)) => {
                // A transport error is the same transient failure as a 5xx.
                model.flushing = false;
                let batch = model.in_flight.take();
                self.retry_batch(model, batch)
            }
        }
    }

    fn view(&self, model: &Model) -> ViewModel {
        let page = match model.page {
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

        let active_peer = model.active_peer.clone().unwrap_or_default();

        // `view()` runs on every render, and `ComposeChanged` renders on every
        // keystroke. A contact's `photo` is a base64 avatar — tens of KiB each —
        // so cloning all of them per keypress meant megabytes of allocation and
        // bincode-encoding to type one message.
        //
        // Only the chat page has a composer (`ComposeChanged` is sent from
        // `ChatView` and nowhere else), so only the chat page is on that hot path
        // — and while it is up, the only avatar on screen is the peer we are
        // talking to. Every *other* page renders from a cold event, and the
        // conversations list draws an avatar per row, so it gets the real photos.
        // Withholding them there would not save a single keystroke's work; it
        // would just replace every contact's picture with their initials.
        let chat_open = model.page == Page::Chat;

        let mut contacts: Vec<ContactVM> = model
            .contacts
            .values()
            .map(|c| {
                let msgs = model.messages.get(&c.pubkey);
                let last = msgs.and_then(|m| m.last());
                let photo = if chat_open && c.pubkey != active_peer {
                    String::new()
                } else {
                    c.photo.clone().unwrap_or_default()
                };
                ContactVM {
                    pubkey: c.pubkey.clone(),
                    name: c.label(),
                    ob: hex_to_ob(&c.pubkey),
                    photo,
                    blocked: c.blocked,
                    last_message: last.map(|m| m.body.clone()).unwrap_or_default(),
                    last_ts: last.map_or(0, |m| m.ts),
                }
            })
            .collect();
        contacts.sort_by(|a, b| b.last_ts.cmp(&a.last_ts).then(a.name.cmp(&b.name)));

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
            error: model.error.clone().unwrap_or_default(),
        }
    }
}

impl Skrepka {
    /// One of the five startup kv loads landed. Fires `Connect` on the last one.
    ///
    /// Connecting earlier would let a poll land — and be persisted — against a
    /// model that is still missing its contacts, cursor, or outbox. The loads
    /// still in flight would then overwrite what the poll just ingested, and the
    /// stale `cursor` (0) would make us re-fetch mail we had already acked.
    fn startup_done(&self, model: &mut Model) -> Command<Effect, Event> {
        if !model.startup_load_done() {
            return Command::done();
        }
        if model.kv_load_failed {
            // One of the loads could not be read (as opposed to being absent), so
            // the model has a hole in it over data that is still on disk. Do not
            // connect: a poll would ingest mail into that hole and ack it, and the
            // relay would then delete the only copy of messages we never persisted.
            //
            // Everything downstream is already write-guarded, so this is belt and
            // braces — but it is also the only place that can *say* so, and the
            // recovery is a relaunch, which re-runs the loads.
            model.error = Some(
                "storage read failed — restart the app; changes will not be saved until you do"
                    .into(),
            );
            return render();
        }
        Command::event(Event::Connect)
    }

    /// The three model-state writes, and the one rule they share: a model that
    /// failed to read a key must never write one.
    ///
    /// `persist_outbox` is the reason this matters. `ingest_poll` calls it on every
    /// poll page — including an empty one — so a failed outbox read followed by a
    /// single idle poll is enough to write `[]` over a queue of real unsent
    /// messages. The user's mail is destroyed by a client doing nothing at all.
    fn refuse_write(&self, model: &mut Model) -> bool {
        if model.kv_load_failed {
            model.error = Some("storage read failed — changes will not be saved".into());
            return true;
        }
        false
    }

    fn persist_contacts(&self, model: &mut Model) -> Command<Effect, Event> {
        if self.refuse_write(model) {
            return Command::done();
        }
        let list: Vec<Contact> = model.contacts.values().cloned().collect();
        KeyValue::set(K_CONTACTS, json_bytes(&list)).then_send(Event::Saved)
    }

    fn persist_profile(&self, model: &mut Model) -> Command<Effect, Event> {
        if self.refuse_write(model) {
            return Command::done();
        }
        KeyValue::set(K_PROFILE, json_bytes(&model.profile)).then_send(Event::Saved)
    }

    fn persist_outbox(&self, model: &mut Model) -> Command<Effect, Event> {
        if self.refuse_write(model) {
            return Command::done();
        }
        let list: Vec<OutboxItem> = model.outbox.iter().cloned().collect();
        KeyValue::set(K_OUTBOX, json_bytes(&list)).then_send(Event::Saved)
    }

    fn persist_messages(&self, model: &mut Model, peer: &str) -> Command<Effect, Event> {
        if self.refuse_write(model) {
            return Command::done();
        }
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

    /// The poll loop stalled — retry after a backoff, and stop claiming to be online.
    ///
    /// Every path here (a transport error, a 5xx, a failed cursor write) means the loop
    /// is not healthy, so leaving `conn` at `Online` both lies to the status dot and —
    /// worse — makes `Connect` a no-op, because it stands down when it already believes
    /// it is online. The shell fires `Connect` on every foreground precisely to recover
    /// the long-poll that backgrounding killed; without this it recovers nothing.
    fn backoff_poll(&self, model: &mut Model) -> Command<Effect, Event> {
        model.conn = ConnStatus::Offline;
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
        // Blocking cuts the peer off in both directions (PROTOCOL.md §4). The
        // ingest side drops their messages; the send side must refuse too, or
        // a blocked peer still receives our texts, acks, and the liveness
        // signal that blocking is supposed to cut off.
        if model.contacts.get(&peer).is_some_and(|c| c.blocked) {
            model.error = Some("cannot send to a blocked contact".into());
            return render();
        }
        let body = model.compose.trim().to_string();
        if body.is_empty() {
            return render();
        }
        model.compose.clear();
        let ts = now_ms();
        let id = uuid::Uuid::new_v4().to_string();

        let convo = model.messages.entry(peer.clone()).or_default();
        // Insert in order rather than appending: an incoming message may hold a
        // `ts` up to `MAX_FUTURE_SKEW_MS` ahead of ours, so appending would leave
        // the conversation unsorted — and `trim_history` ages out the *front*.
        insert_sorted(
            convo,
            StoredMessage {
                id: id.clone(),
                body: body.clone(),
                ts,
                outgoing: true,
                delivered: false,
            },
        );
        trim_history(convo);

        // Auto-create a bare contact if messaging a brand-new key, respecting
        // the same `MAX_CONTACTS` cap `ingest_poll` enforces. This is
        // user-driven (not an attack vector), but the cap exists to bound the
        // `contacts` kv blob, which is rewritten in full on every change.
        let was_new = !model.contacts.contains_key(&peer);
        if was_new && model.contacts.len() >= MAX_CONTACTS {
            model.error = Some("contact list is full".into());
            return render();
        }
        if was_new {
            model
                .contacts
                .insert(peer.clone(), Contact::new(peer.clone(), String::new(), ts));
        }

        // On first contact, share our profile *before* the text so the
        // recipient's first impression is a name and avatar, not a truncated
        // @p that gets replaced a moment later. Both are queued behind any
        // in-flight items, so the ordering is preserved through the outbox.
        if was_new {
            let profile = Payload::Profile {
                display_name: model.profile.display_name.clone(),
                bio: model.profile.bio.clone(),
                photo: model.profile.photo.clone(),
            };
            model.outbox.push_back(OutboxItem::profile(
                peer.clone(),
                Arc::new(protocol::serialize_payload(&profile, ts)),
            ));
        }

        let text = Payload::Text { id, body };
        model.outbox.push_back(OutboxItem::new(
            peer.clone(),
            Arc::new(protocol::serialize_payload(&text, ts)),
        ));

        Command::all([
            self.persist_messages(model, &peer),
            self.persist_contacts(model),
            self.persist_outbox(model),
        ])
        .and(Command::event(Event::StartFlush))
        .and(render())
    }

    /// Encrypt and send a batch from the head of the outbox, discarding any
    /// unsendable items in the way.
    ///
    /// The batch is the longest run of items at the head that share a recipient,
    /// bounded by `MAX_SEND_BATCH` and `MAX_SEND_BATCH_BYTES`. Sending them one
    /// at a time meant an HTTP round-trip per message — and per *ack*, which
    /// `ingest_poll` queues one of per sender per page, so catching up after a
    /// long offline stretch was one request per message received. The relay takes
    /// up to a hundred per request (PROTOCOL.md §7); take it up on that.
    ///
    /// Stopping at the first recipient change keeps the outbox's FIFO ordering
    /// intact — a batch is delivered as a unit, so hoisting a later item for the
    /// same peer over an earlier one for a different peer could only reorder
    /// *across* conversations, but it would also let one busy peer starve the
    /// rest of the queue. Consecutive-only is the cheap, obviously-fair rule, and
    /// it already collapses the two cases that matter: a burst of texts to the
    /// open chat, and a page's worth of acks back to one sender.
    ///
    /// The discards happen in one pass, followed by a single `persist_outbox`.
    /// The previous shape recursed once per bad item and emitted a full outbox
    /// rewrite each time, so a contact list holding `n` unusable keys cost
    /// O(n) kv writes of an O(n) blob — and `n` stack frames — to reach the first
    /// item that could actually go out.
    fn flush_next(&self, model: &mut Model) -> Command<Effect, Event> {
        if model.flushing {
            return Command::done();
        }
        // A failed startup read means the outbox in memory is not the outbox on
        // disk. Sending from it is not the danger — `persist_outbox` refusing to
        // write is — but a send that cannot record having happened is one that will
        // happen again on the next launch, from the queue still on disk. Sit still.
        if model.kv_load_failed {
            return Command::done();
        }
        // A 429 parked the loop until the far side of the relay's `Retry-After`.
        // The timer that set the pause also scheduled the `StartFlush` that resumes
        // us, so whoever woke us early — a poll page, a fresh `SendText` — the
        // answer is the same: the relay asked us to stop until then.
        if now_ms() < model.flush_paused_until {
            return Command::done();
        }
        let (Some(id), Some(token)) = (model.identity(), model.token.clone()) else {
            return Command::done();
        };

        let now = now_ms();
        let mut dirty = false;
        let mut recipient: Option<String> = None;
        let mut messages: Vec<Envelope> = Vec::new();
        let mut bytes = 0usize;
        // What we believe this relay's body cap to be — `MAX_SEND_BATCH_BYTES`
        // until a `413` tells us otherwise.
        let batch_budget = model.send_batch_budget.unwrap_or(MAX_SEND_BATCH_BYTES);

        while messages.len() < MAX_SEND_BATCH {
            let Some(item) = model.outbox.get(messages.len()) else {
                break;
            };
            if recipient.as_ref().is_some_and(|r| r != &item.recipient) {
                break;
            }
            let Some(blob) = encrypt_for(&id, item) else {
                // An unusable recipient key can never be encrypted to, so the item
                // has to go or it blocks the head of the outbox forever — but say
                // so, rather than letting the message vanish. (Only reachable at
                // the head: an item deeper in the batch shares the recipient of one
                // we have already encrypted to, so its key is good by construction.)
                model.error = Some(format!(
                    "cannot send to {}: invalid key",
                    trunc_ob(&item.recipient)
                ));
                model.outbox.remove(messages.len());
                dirty = true;
                continue;
            };
            let hex_blob = hex::encode(blob);
            // Always take the first item, whatever it weighs — a lone oversized
            // payload must still reach the relay, which rejects it permanently
            // (`400`) and so gets it out of the queue for good. Past the first,
            // stop before the body outgrows what a relay will accept.
            if !messages.is_empty() && bytes + hex_blob.len() > batch_budget {
                break;
            }
            bytes += hex_blob.len();
            recipient = Some(item.recipient.clone());
            messages.push(Envelope {
                to: item.recipient.clone(),
                encrypted_blob: hex_blob,
            });
        }

        let Some(recipient) = recipient else {
            // Nothing left to send. Render only if we dropped something, so the
            // user sees why their message went away.
            return if dirty {
                self.persist_outbox(model).and(render())
            } else {
                Command::done()
            };
        };

        // Stamp the items now going out for the first time. This is what the TTL
        // in `OutboxItem::is_expired` measures from, so it has to be durable —
        // otherwise a relaunch resets the clock and a permanently-stuck item is
        // immortal again.
        for item in model.outbox.iter_mut().take(messages.len()) {
            if item.first_attempt == 0 {
                item.first_attempt = now;
                dirty = true;
            }
        }
        let persist = if dirty {
            self.persist_outbox(model)
        } else {
            Command::done()
        };

        model.flushing = true;
        model.in_flight = Some(InFlight {
            recipient,
            count: messages.len(),
            bytes,
        });
        let url = format!("{}/messages", model.settings.server_url);
        match Http::post(url)
            .header("authorization", format!("Bearer {token}"))
            .body_json(&SendBatch { messages })
        {
            Ok(req) => persist.and(req.build().then_send(Event::SendResult)),
            Err(_) => {
                // Not a dead loop: the next StartFlush (from a poll page or a
                // fresh send) retries the head of the outbox.
                model.flushing = false;
                model.in_flight = None;
                model.error = Some("could not build send request".into());
                persist.and(render())
            }
        }
    }

    /// A send failed transiently (a 5xx, a rate limit, a dropped connection). The
    /// batch stays queued and goes out again on the next `StartFlush` — but not
    /// forever.
    ///
    /// The outbox is a strict FIFO, so an item that can never be delivered blocks
    /// every message queued behind it, permanently: a single unreachable recipient
    /// relay used to be enough to silence the client for good. Charge every item in
    /// the failed batch a retry and drop the ones that have exhausted their budget
    /// (`OutboxItem::is_expired`) — with an error, rather than letting them vanish.
    fn retry_batch(&self, model: &mut Model, batch: Option<InFlight>) -> Command<Effect, Event> {
        // `None` means the items were removed out from under the send (the peer was
        // blocked, or deleted). There is nothing left to charge or to drop.
        let Some(batch) = batch else {
            return render();
        };

        let now = now_ms();
        let mut expired = 0usize;
        let mut kept: VecDeque<OutboxItem> = VecDeque::with_capacity(model.outbox.len());
        for (i, mut item) in std::mem::take(&mut model.outbox).into_iter().enumerate() {
            if i < batch.count {
                item.retries = item.retries.saturating_add(1);
                if item.is_expired(now) {
                    expired += 1;
                    continue;
                }
            }
            kept.push_back(item);
        }
        model.outbox = kept;

        if expired == 0 {
            // Nothing dropped, but the retry counters still have to be durable: a
            // relaunch that handed every stuck item a fresh budget would wedge the
            // outbox across restarts exactly as it did before there was a budget.
            return self.persist_outbox(model).and(render());
        }
        model.error = Some(format!(
            "gave up sending {expired} message(s) to {}",
            trunc_ob(&batch.recipient)
        ));
        // The head of the outbox has moved, so whatever was stuck behind the items
        // we just dropped can finally go out.
        self.persist_outbox(model)
            .and(self.flush_next(model))
            .and(render())
    }

    /// Decrypt and fold a poll page into the model; queue delivery acks.
    fn ingest_poll(&self, model: &mut Model, page: PollResp) -> Command<Effect, Event> {
        // The caller already refuses to poll into a broken model, and must — the
        // cursor write is its own, and advancing it is what acks the page. This
        // stands guard for whoever calls this next: ingesting is only safe if what
        // is ingested can be written down.
        if model.kv_load_failed {
            return Command::done();
        }
        let prev_cursor = model.cursor;
        if page.cursor > model.cursor {
            model.cursor = page.cursor;
        }
        let Some(id) = model.identity() else {
            return Command::done();
        };

        let now = now_ms();
        let mut touched_convos: HashSet<String> = HashSet::new();
        let mut contacts_dirty = false;
        // sender hex -> message ids needing acks
        let mut ack_targets: BTreeMap<String, Vec<String>> = BTreeMap::new();
        // Lazily-built per-sender sets of known message IDs for O(1) text dedup.
        let mut seen_ids: HashMap<String, HashSet<String>> = HashMap::new();

        let mut budget = MAX_POLL_TOTAL_BYTES;
        for ev in page.events {
            // Reject an oversized blob on its hex length, before it costs us a
            // decode. No conforming sender produces one (the relay caps blobs at
            // the same size), so this can only be junk.
            if ev.encrypted_blob.len() > MAX_BLOB_LEN * 2 {
                continue;
            }
            match budget.checked_sub(ev.encrypted_blob.len() / 2) {
                Some(left) => budget = left,
                None => {
                    // A page this large is a misbehaving relay, not real mail.
                    // Stop here; the rest of the page is discarded exactly as an
                    // undecryptable blob would be.
                    //
                    // Restore the cursor: it was advanced to `page.cursor` above,
                    // but we have not processed the remaining events. If we keep
                    // the advanced cursor, the next poll acks the whole page to
                    // the relay — including every event we skipped — and the
                    // relay deletes them. Those messages are permanently lost.
                    model.cursor = prev_cursor;
                    model.error = Some("relay sent an oversized poll page".into());
                    break;
                }
            }
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

            // Mail from ourselves. A relay cannot forge this — the sender identity
            // is signed inside the AEAD — but it can *echo back* a blob we sent
            // through it, and one addressed to ourselves decrypts perfectly well.
            // Nothing downstream would notice: it would auto-create a contact for
            // our own key (which `AddContact` explicitly refuses to do), file our
            // own words as an incoming message, and queue a delivery ack addressed
            // to us — which flushes, comes back, and is acked again.
            if sender == model.my_pubkey {
                continue;
            }

            // Blocking cuts the peer off entirely (PROTOCOL.md §4) — not just
            // their texts. A blocked peer must not be able to rewrite their
            // display name and avatar in our contact list, mark our messages
            // delivered, or (via an ack we send back) learn that we are online
            // and reading. So the gate sits above the payload match, not inside
            // the `Text` arm.
            if model.contacts.get(&sender).is_some_and(|c| c.blocked) {
                continue;
            }

            // `ts` is chosen by the sender and drives conversation ordering,
            // in-chat ordering, and the displayed time. Bound it to the near
            // future so a peer cannot pin itself to the top of the list forever
            // with `ts = i64::MAX`, and bound it to the non-negative past so a
            // malicious peer cannot make their own message invisible by dating
            // it at `i64::MIN` — `insert_sorted` would put it at position 0 and
            // `trim_history` would age it out first.
            let ts = parsed
                .ts
                .max(0)
                .min(now.saturating_add(MAX_FUTURE_SKEW_MS));
            let known = model.contacts.contains_key(&sender);
            match parsed.payload {
                Payload::Text { id: msg_id, body } => {
                    // Auto-create a contact for a stranger who writes to us — but
                    // only up to `MAX_CONTACTS`. Past that, drop the message
                    // entirely: storing it would mean a `messages:<peer>` blob for
                    // a peer with no contact entry, i.e. a conversation nothing
                    // can open and nothing ever trims.
                    if !known {
                        if model.contacts.len() >= MAX_CONTACTS {
                            continue;
                        }
                        model.contacts.insert(
                            sender.clone(),
                            Contact::new(sender.clone(), String::new(), ts),
                        );
                        contacts_dirty = true;
                    }
                    let convo = model.messages.entry(sender.clone()).or_default();
                    // Lazily build the per-sender ID set on first touch.
                    let id_set = seen_ids.entry(sender.clone()).or_insert_with(|| {
                        convo.iter().map(|m| m.id.clone()).collect()
                    });
                    // dedup by id — O(1) via HashSet
                    if !id_set.contains(&msg_id) {
                        // The conversation is *kept* sorted rather than re-sorted:
                        // a `sort_by_key` per arrival is O(n log n) on a list of up
                        // to `MAX_MESSAGES_PER_PEER`, every time, and a poll page
                        // can carry hundreds of messages.
                        insert_sorted(
                            convo,
                            StoredMessage {
                                id: msg_id.clone(),
                                body,
                                ts,
                                outgoing: false,
                                delivered: false,
                            },
                        );
                        id_set.insert(msg_id.clone());
                        trim_history(convo);
                        touched_convos.insert(sender.clone());
                        // Only ack a message we actually stored — a duplicate id
                        // was already acked when its first copy was ingested.
                        ack_targets.entry(sender.clone()).or_default().push(msg_id);
                    }
                }
                Payload::DeliveryAck { ack_ids } => {
                    // Staleness check: drop a replayed ack whose ts predates the
                    // last one we processed for this contact.
                    let stale = model
                        .contacts
                        .get(&sender)
                        .is_some_and(|c| ts < c.last_ack_ts);
                    if stale {
                        continue;
                    }
                    // The watermark is clamped to *now*, not merely into the skew
                    // window: `ts` is the peer's to choose, and `last_ack_ts` is
                    // what every later ack is measured against. A single ack at
                    // `ts = i64::MAX` would otherwise park the watermark a minute
                    // into the future, and every honest ack that followed — the
                    // ones that actually mark our messages delivered — would read
                    // as stale and be dropped.
                    if let Some(c) = model.contacts.get_mut(&sender) {
                        c.last_ack_ts = ts.min(now);
                        contacts_dirty = true;
                    }
                    let ack_set: HashSet<String> = ack_ids.iter().cloned().collect();
                    if let Some(convo) = model.messages.get_mut(&sender) {
                        let mut changed = false;
                        for m in convo.iter_mut() {
                            if m.outgoing && ack_set.contains(&m.id) && !m.delivered {
                                m.delivered = true;
                                changed = true;
                            }
                        }
                        if changed {
                            touched_convos.insert(sender);
                        }
                    }
                }
                Payload::Profile {
                    display_name,
                    bio,
                    photo,
                } => {
                    // A bare profile from a stranger creates nothing. It is an
                    // unsolicited push with no message attached, so honouring it
                    // would let anyone holding our pubkey put an entry (with an
                    // avatar) in our contact list without ever saying a word.
                    let Some(c) = model.contacts.get_mut(&sender) else {
                        continue;
                    };
                    // Ignore stale profile replays (PROTOCOL.md §4). The watermark
                    // is clamped to *now* for the same reason `last_ack_ts` is: a
                    // peer that parked it in the future would freeze its own
                    // profile, since every honest update it sent afterwards would
                    // read as a stale replay of itself.
                    //
                    // `>=` (not `>`): a contact's `last_profile_ts` starts at 0,
                    // and a first profile whose `ts` is also 0 — the default when
                    // the field is missing — must still be accepted. `>` would
                    // silently drop it, leaving the contact with no profile at all.
                    // A replayed profile at the same `ts` overwrites with identical
                    // content, which is a no-op in practice.
                    if ts >= c.last_profile_ts {
                        c.display_name = display_name;
                        c.bio = bio;
                        c.photo = photo;
                        c.last_profile_ts = ts.min(now);
                        contacts_dirty = true;
                    }
                }
            }
        }

        // Queue delivery acks, in batches the recipient will actually accept.
        //
        // `parse_payload` drops a `delivery.ack` carrying more than `MAX_ACK_IDS`
        // ids, and a peer running this same code applies that cap to *us*. One
        // payload per sender therefore silently stops working the moment a peer
        // has more than `MAX_ACK_IDS` messages waiting for us — which is exactly
        // what a long offline stretch produces — and every one of those messages
        // stays un-delivered on their side forever, because a poll page is only
        // ever acked once.
        let ack_ts = now_ms();
        for (sender, ids) in ack_targets {
            for batch in ids.chunks(protocol::MAX_ACK_IDS) {
                let payload = Payload::DeliveryAck {
                    ack_ids: batch.to_vec(),
                };
                // Consecutive and same-recipient, so `flush_next` puts every one of
                // a sender's ack batches into a single `/messages` request.
                model.outbox.push_back(OutboxItem::new(
                    sender.clone(),
                    Arc::new(protocol::serialize_payload(&payload, ack_ts)),
                ));
            }
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

/// Encrypt one outbox item to its recipient, or `None` if the recipient's key is
/// unusable — a bad hex string, the wrong length, or 32 bytes that aren't a curve
/// point. `AddContact` rejects all three now, but an older contact list (or a
/// profile-broadcast fan-out over one) may still hold such a key.
fn encrypt_for(sender: &Identity, item: &OutboxItem) -> Option<Vec<u8>> {
    let recipient: [u8; 32] = hex::decode(&item.recipient).ok()?.try_into().ok()?;
    let mut rng = rand_core::OsRng;
    crate::crypto::encrypt(&mut rng, sender, &recipient, item.envelope_json.as_bytes()).ok()
}

fn backoff_ms(retries: u32) -> u64 {
    (3000u64.saturating_mul(1u64 << retries.min(4))).min(30_000)
}

/// Insert a message into a conversation held in `ts` order.
///
/// `partition_point` lands *after* every message sharing the new one's `ts`, so
/// ties keep arrival order — exactly what the stable `sort_by_key` this replaces
/// produced, at O(log n) + a shift instead of O(n log n) on every message.
///
/// This is what makes "sorted by `ts`" an invariant rather than something
/// `ingest_poll` restored after the fact, which is what `trim_history` has always
/// assumed (it ages out the *front*) and what `view()` renders in order.
fn insert_sorted(convo: &mut Vec<StoredMessage>, msg: StoredMessage) {
    let pos = convo.partition_point(|m| m.ts <= msg.ts);
    convo.insert(pos, msg);
}

/// Age out local history: keep only the most recent `MAX_MESSAGES_PER_PEER`
/// messages of a conversation (PROTOCOL.md §9). Callers keep `convo` sorted by
/// `ts`, so the oldest messages are at the front. The subsequent kv write
/// persists the trimmed list, bounding the `messages:<peer>` blob too.
fn trim_history(convo: &mut Vec<StoredMessage>) {
    if let Some(excess) = convo.len().checked_sub(MAX_MESSAGES_PER_PEER) {
        convo.drain(..excess);
    }
}

/// Decode a kv `get` result into a typed value.
///
/// Returns `Ok(Some(value))` when the key exists and deserializes, `Ok(None)`
/// when the key is absent (a fresh install), and `Err` when the read itself
/// failed (e.g. the file is locked or corrupt). The caller MUST NOT overwrite
/// a key with a default when the read failed — the data is still on disk, and
/// writing the default back destroys it. An absent key is safe to default.
///
/// The old `parse_kv` conflated read errors with absence, which meant a
/// background wake while the device was locked (where `completeUnlessOpen`
/// refuses to open existing files) would load an empty model, and the next
/// `persist_*` would write that emptiness back over the real data.
fn parse_kv<T: for<'de> Deserialize<'de>>(res: KvData) -> Result<Option<T>, ()> {
    match res {
        Ok(Some(bytes)) => serde_json::from_slice(&bytes)
            .map(Some)
            .map_err(|_| ()),
        Ok(None) => Ok(None),
        Err(_) => Err(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::Identity;
    use crate::model::{MAX_OUTBOX_RETRIES, OUTBOX_TTL_MS};

    fn with_identity() -> Model {
        let id = Identity::from_seed(&[3u8; 32]);
        Model {
            secret_key: Some(Zeroizing::new(id.secret_key.to_vec())),
            my_pubkey: id.public_key_hex(),
            ..Default::default()
        }
    }

    fn peer_hex(seed: u8) -> String {
        Identity::from_seed(&[seed; 32]).public_key_hex()
    }

    /// `Command::event` *queues* an event; it does not run it. The runtime drains
    /// that queue back into `update`, so a test that stops at the first `update`
    /// only ever sees half of what an event actually does — `Connect` would look
    /// like it never authenticates, and the poll watchdog like it never re-polls.
    /// Drain it the way the runtime does.
    fn drive(app: &Skrepka, cmd: &mut Command<Effect, Event>, model: &mut Model) {
        for event in cmd.events().collect::<Vec<_>>() {
            let mut next = app.update(event, model);
            drive(app, &mut next, model);
        }
    }

    /// `update` + drain, i.e. what the shell actually observes.
    fn dispatch(app: &Skrepka, event: Event, model: &mut Model) {
        let mut cmd = app.update(event, model);
        drive(app, &mut cmd, model);
    }

    /// A poll page carrying one payload, encrypted from `sender_seed` to `me`.
    fn page_from(sender_seed: u8, me: &Model, payload: &Payload, ts: i64) -> PollResp {
        let sender = Identity::from_seed(&[sender_seed; 32]);
        let recipient = Identity::from_secret_bytes(me.secret_key.as_ref().unwrap()).unwrap();
        let json = protocol::serialize_payload(payload, ts);
        let blob = crate::crypto::encrypt(
            &mut rand_core::OsRng,
            &sender,
            &recipient.public_key(),
            json.as_bytes(),
        )
        .unwrap();
        PollResp {
            events: vec![PollEvent {
                encrypted_blob: hex::encode(blob),
            }],
            cursor: 1,
        }
    }

    fn text(id: &str, body: &str) -> Payload {
        Payload::Text {
            id: id.to_string(),
            body: body.to_string(),
        }
    }

    fn queued(recipient: &str, body: &str) -> OutboxItem {
        OutboxItem::new(
            recipient.to_string(),
            Arc::new(protocol::serialize_payload(&text(body, body), 1)),
        )
    }

    /// The `/messages` batches a command actually puts on the wire. Reading them
    /// off the effect is the only way to see what was *sent*, as opposed to what
    /// the model thinks it sent.
    fn sent_batches(cmd: &mut Command<Effect, Event>) -> Vec<Vec<Envelope>> {
        #[derive(Deserialize)]
        struct Sent {
            messages: Vec<Envelope>,
        }
        cmd.effects()
            .filter_map(|e| match e {
                Effect::Http(req) if req.operation.url.ends_with("/messages") => {
                    serde_json::from_slice::<Sent>(&req.operation.body)
                        .ok()
                        .map(|b| b.messages)
                }
                _ => None,
            })
            .collect()
    }

    fn ok_response(status: u16) -> crux_http::Response<Vec<u8>> {
        let status = crux_http::http::StatusCode::try_from(status).unwrap();
        crux_http::testing::ResponseBuilder::with_status(status)
            .body(Vec::new())
            .build()
    }

    /// The same, plus one header — the only thing a relay can say to us beyond a
    /// status code, and `Retry-After` is the one we act on.
    fn response_with_header(status: u16, name: &str, value: &str) -> crux_http::Response<Vec<u8>> {
        let status = crux_http::http::StatusCode::try_from(status).unwrap();
        crux_http::testing::ResponseBuilder::with_status(status)
            .header(name, value)
            .body(Vec::new())
            .build()
    }

    /// The delays a command actually asks the shell to wait, in milliseconds.
    /// Asserting on the model alone cannot see these — a backoff lives entirely in
    /// the effect.
    fn scheduled_delays(cmd: &mut Command<Effect, Event>) -> Vec<u64> {
        cmd.effects()
            .filter_map(|e| match e {
                Effect::Time(req) => match req.operation {
                    crux_time::TimeRequest::NotifyAfter { duration, .. } => {
                        Some(Duration::from(duration).as_millis() as u64)
                    }
                    _ => None,
                },
                _ => None,
            })
            .collect()
    }

    /// One full send round-trip: flush the outbox, then answer with `status`.
    fn send_and_answer(app: &Skrepka, m: &mut Model, status: u16) {
        let _ = app.update(Event::StartFlush, m);
        let _ = app.update(Event::SendResult(Ok(ok_response(status))), m);
    }

    // -----------------------------------------------------------------------
    // outbox: retry budget and TTL
    // -----------------------------------------------------------------------

    /// The outbox is a strict FIFO, so an item that can never be delivered used to
    /// block every message queued behind it — forever.
    #[test]
    fn an_undeliverable_item_is_dropped_once_it_runs_out_of_retries() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        let stuck = peer_hex(9);
        let behind = peer_hex(11);
        m.outbox.push_back(queued(&stuck, "wedged"));
        m.outbox.push_back(queued(&behind, "stranded"));

        // The relay keeps 500-ing on the head of the queue.
        for i in 1..MAX_OUTBOX_RETRIES {
            send_and_answer(&app, &mut m, 503);
            assert_eq!(m.outbox.len(), 2, "still queued after {i} failure(s)");
            assert_eq!(m.outbox[0].retries, i, "and its budget is being spent");
        }

        // The last one exhausts the budget: the head goes, and what was stuck
        // behind it goes out.
        let _ = app.update(Event::StartFlush, &mut m);
        let mut cmd = app.update(Event::SendResult(Ok(ok_response(503))), &mut m);

        assert_eq!(m.outbox.len(), 1, "the undeliverable item is dropped");
        assert_eq!(m.outbox[0].recipient, behind, "and the queue moves on");
        assert_eq!(
            sent_batches(&mut cmd).len(),
            1,
            "the message behind it is sent immediately, not left for the next flush"
        );
        let err = m.error.expect("the user is told the message was given up on");
        assert!(err.contains("gave up sending 1"), "got: {err}");
    }

    /// The counter alone is not enough: retries only accrue when a send is
    /// attempted, so a client that goes online once a day would take a fortnight to
    /// spend a ten-retry budget. The TTL bounds it in wall-clock time instead.
    #[test]
    fn an_item_older_than_the_ttl_is_dropped_on_its_next_failure() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        let peer = peer_hex(9);

        let mut old = queued(&peer, "ancient");
        old.first_attempt = now_ms() - OUTBOX_TTL_MS - 1;
        old.retries = 1; // nowhere near the retry cap
        m.outbox.push_back(old);

        send_and_answer(&app, &mut m, 503);

        assert!(m.outbox.is_empty(), "the TTL alone is enough to drop it");
        assert!(m.error.is_some_and(|e| e.contains("gave up sending")));
    }

    /// An item queued during a week offline must not be dropped the moment the
    /// network returns: the TTL runs from the first *attempt*, not from when the
    /// message was written. An outbox blob from a build with no `first_attempt`
    /// field deserializes to 0, which must mean "never attempted", not "epoch".
    #[test]
    fn an_item_that_was_never_attempted_has_no_ttl_to_outlive() {
        let item = OutboxItem::new(peer_hex(9), Arc::new("{}".into()));
        assert_eq!(item.first_attempt, 0);
        assert!(
            !item.is_expired(now_ms()),
            "an unsent item must not age out against the epoch"
        );
    }

    /// The TTL clock has to survive a relaunch, or a permanently-stuck item is
    /// handed a fresh 24 hours on every launch and the outbox wedges forever again.
    #[test]
    fn the_first_attempt_stamp_is_persisted_when_the_item_goes_out() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        m.outbox.push_back(queued(&peer_hex(9), "hi"));
        let before = now_ms();

        let mut cmd = app.update(Event::StartFlush, &mut m);

        assert!(m.outbox[0].first_attempt >= before, "the item is stamped");
        // ...and the stamp is written to the `outbox` key, not just to memory.
        let wrote_outbox = cmd.effects().any(|e| {
            matches!(e, Effect::KeyValue(req)
                if matches!(&req.operation, crux_kv::KeyValueOperation::Set { key, .. } if key == K_OUTBOX))
        });
        assert!(wrote_outbox, "the stamped outbox is persisted");
    }

    /// A transient failure below the budget changes nothing but the counter — the
    /// message stays queued and goes out on the next flush.
    #[test]
    fn a_transient_failure_within_budget_keeps_the_message() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        m.outbox.push_back(queued(&peer_hex(9), "hi"));

        send_and_answer(&app, &mut m, 503);
        assert_eq!(m.outbox.len(), 1);
        assert_eq!(m.outbox[0].retries, 1);
        assert!(m.error.is_none(), "a single 5xx is not worth shouting about");
        assert!(!m.flushing, "and the guard is released so the next flush can run");

        // The relay recovers; the message goes out and the item is gone.
        send_and_answer(&app, &mut m, 200);
        assert!(m.outbox.is_empty());
    }

    /// A 401 is not a delivery failure — it means our token expired. The batch must
    /// not be charged a retry for it, or a long-lived client burns its whole budget
    /// on routine re-auths.
    #[test]
    fn a_401_does_not_spend_the_retry_budget() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        m.outbox.push_back(queued(&peer_hex(9), "hi"));

        send_and_answer(&app, &mut m, 401);

        assert_eq!(m.outbox.len(), 1, "the message is still queued");
        assert_eq!(m.outbox[0].retries, 0, "and unpunished");
        assert!(m.token.is_none(), "but the token is thrown away");
    }

    /// A 429 is the relay's load, not the message's fault. Charging the batch a
    /// retry for it would let a busy relay drive perfectly good messages out of the
    /// outbox — and the relay usually says exactly how long to wait, so wait that
    /// long rather than guessing.
    #[test]
    fn a_429_waits_out_retry_after_without_spending_the_retry_budget() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        m.outbox.push_back(queued(&peer_hex(9), "hi"));

        let _ = app.update(Event::StartFlush, &mut m);
        let mut cmd = app.update(
            Event::SendResult(Ok(response_with_header(429, "retry-after", "2"))),
            &mut m,
        );

        assert_eq!(m.outbox.len(), 1, "the message is still queued");
        assert_eq!(m.outbox[0].retries, 0, "and unpunished — it did nothing wrong");
        assert!(!m.flushing, "the guard is released so the retry can run");
        assert_eq!(
            scheduled_delays(&mut cmd),
            vec![2_000],
            "and we wait exactly as long as the relay asked"
        );
    }

    /// Without the header there is nothing to honour, so fall back to our own
    /// backoff rather than hammering the relay that just asked us to slow down.
    ///
    /// On the *send* loop's counter. `poll_retries` is reset by every page the poll
    /// loop takes, so spending it here means a client that polls happily while the
    /// relay throttles its sends restarts the send backoff at 3 s forever.
    #[test]
    fn a_429_without_header_uses_send_side_backoff() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        m.outbox.push_back(queued(&peer_hex(9), "hi"));
        // The poll loop is healthy and has just taken a page — exactly the state that
        // used to reset the send backoff out from under itself.
        m.poll_retries = 0;

        let _ = app.update(Event::StartFlush, &mut m);
        let mut cmd = app.update(Event::SendResult(Ok(ok_response(429))), &mut m);

        assert_eq!(m.outbox[0].retries, 0, "still not the message's fault");
        assert_eq!(
            scheduled_delays(&mut cmd),
            vec![backoff_ms(0)],
            "the first send-side backoff"
        );
        assert_eq!(m.send_retries, 1, "and the send loop's own counter is spent");

        // A second 429 climbs, rather than restarting at 3 s.
        m.flush_paused_until = 0;
        let _ = app.update(Event::StartFlush, &mut m);
        let mut cmd = app.update(Event::SendResult(Ok(ok_response(429))), &mut m);
        assert_eq!(scheduled_delays(&mut cmd), vec![backoff_ms(1)], "it climbs");
        assert_eq!(m.send_retries, 2);
    }

    /// The `Retry-After` timer is not the only thing that fires `StartFlush` — a poll
    /// page and a fresh `SendText` both do. Without a pause latched on the model the
    /// wait is decorative: the next poll page walks through it and hammers the relay
    /// that just asked us to stop.
    #[test]
    fn a_429_pauses_flush_until_the_delay_elapses() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        m.outbox.push_back(queued(&peer_hex(9), "hi"));

        let _ = app.update(Event::StartFlush, &mut m);
        let _ = app.update(
            Event::SendResult(Ok(response_with_header(429, "retry-after", "2"))),
            &mut m,
        );
        assert!(
            m.flush_paused_until > now_ms(),
            "the relay's wait is latched on the model, not just on a timer"
        );

        // Anything else that wakes the send loop during the wait — a poll page, a new
        // message — must find it closed.
        let mut cmd = app.update(Event::StartFlush, &mut m);
        assert!(
            sent_batches(&mut cmd).is_empty(),
            "nothing goes out while the relay has asked us to wait"
        );
        assert!(!m.flushing, "and the loop is left free to resume later");
        assert_eq!(m.outbox.len(), 1, "the message is still queued");

        // Time passes (the clock cannot be moved in a test, so retire the pause the
        // way the elapsing of it would) and the timer's own `StartFlush` lands.
        m.flush_paused_until = 0;
        let mut cmd = app.update(Event::StartFlush, &mut m);
        assert_eq!(
            sent_batches(&mut cmd).len(),
            1,
            "and once the wait is over the batch goes out"
        );
    }

    /// A send the relay accepts means the throttle is off. Keeping the counter would
    /// make the next 429 — hours later, under unrelated load — resume at whatever
    /// height the last one climbed to.
    #[test]
    fn a_successful_send_clears_the_send_side_backoff() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        m.send_retries = 4;
        m.outbox.push_back(queued(&peer_hex(9), "hi"));

        send_and_answer(&app, &mut m, 200);

        assert_eq!(m.send_retries, 0, "the relay is taking our sends again");
    }

    /// `Retry-After` is a number a relay chooses and we obey. Unbounded, one of
    /// them parks the outbox for thirty years — with nothing on screen to say why.
    #[test]
    fn an_absurd_retry_after_is_clamped() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        m.outbox.push_back(queued(&peer_hex(9), "hi"));

        let _ = app.update(Event::StartFlush, &mut m);
        let mut cmd = app.update(
            Event::SendResult(Ok(response_with_header(429, "retry-after", "999999999"))),
            &mut m,
        );

        assert_eq!(
            scheduled_delays(&mut cmd),
            vec![MAX_RETRY_AFTER_MS],
            "we wait, but only as long as we are willing to"
        );
    }

    // -----------------------------------------------------------------------
    // outbox: batching
    // -----------------------------------------------------------------------

    /// Sending one message per request meant a round-trip per *ack* too, so
    /// catching up on a hundred messages cost a hundred requests.
    #[test]
    fn consecutive_items_for_one_recipient_go_out_in_a_single_request() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        let peer = peer_hex(9);
        for i in 0..5 {
            m.outbox.push_back(queued(&peer, &format!("m{i}")));
        }

        let mut cmd = app.update(Event::StartFlush, &mut m);

        let batches = sent_batches(&mut cmd);
        assert_eq!(batches.len(), 1, "one request, not five");
        assert_eq!(batches[0].len(), 5, "carrying every message");
        assert!(batches[0].iter().all(|e| e.to == peer));

        // ...and its success clears the whole batch, not just the head.
        let _ = app.update(Event::SendResult(Ok(ok_response(200))), &mut m);
        assert!(m.outbox.is_empty());
    }

    /// The batch stops at the first recipient change: a batch is delivered as a
    /// unit, and hoisting a later item for the same peer over an earlier one for a
    /// different peer would let one busy conversation starve the rest of the queue.
    #[test]
    fn a_batch_stops_at_the_first_recipient_change() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        let a = peer_hex(9);
        let b = peer_hex(11);
        m.outbox.push_back(queued(&a, "a1"));
        m.outbox.push_back(queued(&a, "a2"));
        m.outbox.push_back(queued(&b, "b1"));
        m.outbox.push_back(queued(&a, "a3"));

        let mut cmd = app.update(Event::StartFlush, &mut m);
        let batches = sent_batches(&mut cmd);
        assert_eq!(batches.len(), 1);
        assert_eq!(batches[0].len(), 2, "only the run at the head");
        assert!(batches[0].iter().all(|e| e.to == a));

        let mut cmd = app.update(Event::SendResult(Ok(ok_response(200))), &mut m);
        assert_eq!(m.outbox.len(), 2);
        let batches = sent_batches(&mut cmd);
        assert_eq!(batches[0].len(), 1, "then b's single message");
        assert_eq!(batches[0][0].to, b);
    }

    /// The relay answers `413 batch_too_large` past a hundred (PROTOCOL.md §7) —
    /// which we would read as a transient failure and retry forever.
    #[test]
    fn a_batch_is_capped_at_the_relays_limit() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        let peer = peer_hex(9);
        for i in 0..(MAX_SEND_BATCH + 20) {
            m.outbox.push_back(queued(&peer, &format!("m{i}")));
        }

        let mut cmd = app.update(Event::StartFlush, &mut m);
        let batches = sent_batches(&mut cmd);
        assert_eq!(batches[0].len(), MAX_SEND_BATCH);

        let _ = app.update(Event::SendResult(Ok(ok_response(200))), &mut m);
        assert_eq!(m.outbox.len(), 20, "the rest stays queued for the next batch");
    }

    /// A hundred profile broadcasts each carrying a 64 KiB photo would build a
    /// request far past the body-size cap a relay has by default — and the `413`
    /// that came back would look transient, so we would retry it forever.
    #[test]
    fn a_batch_is_capped_by_body_size_as_well_as_count() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        let peer = peer_hex(9);
        // A body at the cap, and incompressible — `crypto::encrypt` deflates the
        // plaintext, so a run of one character would ride out to nearly nothing and
        // prove no cap at all.
        let mut seed = 1u64;
        let big: String = std::iter::repeat_with(|| {
            seed = seed.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(1);
            char::from(b'a' + (seed >> 33) as u8 % 26)
        })
        .take(protocol::MAX_BODY_LEN)
        .collect();
        for i in 0..MAX_SEND_BATCH {
            m.outbox.push_back(OutboxItem::new(
                peer.clone(),
                Arc::new(protocol::serialize_payload(&text(&format!("m{i}"), &big), 1)),
            ));
        }

        let mut cmd = app.update(Event::StartFlush, &mut m);
        let batches = sent_batches(&mut cmd);
        let body: usize = batches[0].iter().map(|e| e.encrypted_blob.len()).sum();

        assert!(batches[0].len() < MAX_SEND_BATCH, "the count cap is not the binding one");
        assert!(!batches[0].is_empty(), "but something still goes out");
        assert!(body <= MAX_SEND_BATCH_BYTES, "the body stays inside the budget");
    }

    /// `MAX_SEND_BATCH_BYTES` is a *guess* at a cap the protocol never publishes, and
    /// a relay configured below it answers `413`. Read as a transient failure, that
    /// `413` rebuilds the identical batch, is rejected identically, and repeats until
    /// every item has burned its retry budget — the outbox drains without a single
    /// message being delivered. So a `413` measures the cap instead of fighting it.
    #[test]
    fn a_413_halves_the_batch_budget_and_retries_smaller() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        let peer = peer_hex(9);
        for i in 0..5 {
            m.outbox.push_back(queued(&peer, &format!("m{i}")));
        }

        // Nothing is known about this relay yet, so all five go out at once.
        let mut cmd = app.update(Event::StartFlush, &mut m);
        let first = sent_batches(&mut cmd);
        assert_eq!(first[0].len(), 5, "the whole run goes out on the first attempt");
        assert!(m.send_batch_budget.is_none(), "and we have assumed nothing");
        let sent_bytes: usize = first[0].iter().map(|e| e.encrypted_blob.len()).sum();

        // ...and the relay says that was too big.
        let mut cmd = app.update(Event::SendResult(Ok(ok_response(413))), &mut m);

        assert_eq!(
            m.send_batch_budget,
            Some(sent_bytes / 2),
            "the budget is halved against what actually failed, not against the constant"
        );
        assert_eq!(m.outbox.len(), 5, "a 413 delivered nothing, so nothing is popped");
        assert!(
            m.outbox.iter().all(|i| i.retries == 0),
            "and the items are not charged for the relay being smaller than we guessed"
        );

        // The retry goes out at once, and it is smaller.
        let second = sent_batches(&mut cmd);
        assert_eq!(second.len(), 1, "retried immediately, not left for the next flush");
        let shrunk = second[0].len();
        assert!(shrunk < 5, "with a smaller batch, got {shrunk} items");
        assert!(shrunk > 0, "but not an empty one");

        // The relay takes the smaller batch, and exactly it is popped.
        let _ = app.update(Event::SendResult(Ok(ok_response(200))), &mut m);
        assert_eq!(m.outbox.len(), 5 - shrunk, "exactly the batch that landed is gone");
        assert_eq!(
            m.send_batch_budget,
            Some(sent_bytes / 2),
            "and what we learned about the relay survives the success — its cap did not grow"
        );
    }

    /// A batch of one cannot be split, and `flush_next` takes the first item whatever
    /// it weighs — so halving the budget around a lone oversized item would rebuild
    /// the same one-item batch forever, at full speed, with no retry ever charged.
    /// It has to fall through to the retry budget, which is what eventually drops it.
    #[test]
    fn a_413_on_a_single_item_ages_out_instead_of_spinning() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        m.outbox.push_back(queued(&peer_hex(9), "bigger than this relay allows"));

        for i in 1..MAX_OUTBOX_RETRIES {
            send_and_answer(&app, &mut m, 413);
            assert_eq!(m.outbox.len(), 1, "still queued after {i} rejection(s)");
            assert_eq!(m.outbox[0].retries, i, "and charged for each of them");
        }
        assert!(
            m.send_batch_budget.is_none(),
            "an unsplittable batch teaches us nothing about the cap"
        );

        send_and_answer(&app, &mut m, 413);
        assert!(m.outbox.is_empty(), "the item that can never be sent is dropped");
        assert!(
            m.error.is_some_and(|e| e.contains("gave up sending")),
            "and the user is told, rather than the message quietly vanishing"
        );
    }

    /// What we learned is about *that relay*. A new one is entitled to a bigger cap,
    /// and it will never send the `413` that would correct a budget carried over.
    #[test]
    fn changing_relay_forgets_the_learned_batch_budget() {
        let app = Skrepka;
        let mut m = with_identity();
        m.send_batch_budget = Some(1024);

        let _ = app.update(Event::SetServerUrl("https://other.example".into()), &mut m);

        assert!(m.send_batch_budget.is_none());
    }

    /// An unusable key at the head still has to be discarded, batching or not —
    /// and the discard must not take the rest of the queue with it.
    #[test]
    fn an_unsendable_head_is_dropped_and_the_batch_behind_it_still_goes_out() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        let good = peer_hex(9);
        m.outbox.push_back(queued(&hex::encode([0xabu8; 32]), "doomed"));
        m.outbox.push_back(queued(&good, "fine"));
        m.outbox.push_back(queued(&good, "also fine"));

        let mut cmd = app.update(Event::StartFlush, &mut m);

        assert_eq!(m.outbox.len(), 2, "only the unsendable item is dropped");
        let batches = sent_batches(&mut cmd);
        assert_eq!(batches[0].len(), 2, "and the batch behind it goes out whole");
        assert!(m.error.is_some_and(|e| e.contains("invalid key")));
    }

    // -----------------------------------------------------------------------
    // outbox: profile supersede
    // -----------------------------------------------------------------------

    /// A profile is state, not an event: only the newest one means anything. Five
    /// quick edits used to queue five payloads per contact — each with the photo.
    #[test]
    fn repeated_profile_edits_supersede_rather_than_pile_up() {
        let app = Skrepka;
        let mut m = with_identity();
        let a = peer_hex(9);
        let b = peer_hex(11);
        for peer in [&a, &b] {
            m.contacts
                .insert(peer.clone(), Contact::new(peer.clone(), String::new(), 0));
        }

        for name in ["One", "Two", "Three"] {
            let _ = app.update(
                Event::SaveProfile {
                    display_name: name.into(),
                    bio: String::new(),
                    photo: None,
                },
                &mut m,
            );
        }

        assert_eq!(m.outbox.len(), 2, "one pending profile per contact, not three");
        for item in &m.outbox {
            assert!(item.is_profile());
            let parsed = protocol::parse_payload(item.envelope_json.as_bytes()).unwrap();
            match parsed.payload {
                Payload::Profile { display_name, .. } => {
                    assert_eq!(display_name, "Three", "and it is the latest one");
                }
                _ => panic!("expected a profile"),
            }
        }
    }

    /// Superseding must not reach into a payload that is already on the wire: its
    /// ciphertext is built and gone, and `SendResult` pops it on success — so a
    /// profile swapped in now would be dropped having never been sent.
    #[test]
    fn a_profile_already_in_flight_is_not_rewritten_under_the_send() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        let peer = peer_hex(9);
        m.contacts
            .insert(peer.clone(), Contact::new(peer.clone(), String::new(), 0));

        let _ = app.update(
            Event::SaveProfile {
                display_name: "Old".into(),
                bio: String::new(),
                photo: None,
            },
            &mut m,
        );
        // It goes out and is still in flight.
        let _ = app.update(Event::StartFlush, &mut m);
        assert!(m.flushing);

        // A second edit lands mid-send. It must queue a *new* item rather than
        // rewrite the one whose ciphertext is already gone.
        let _ = app.update(
            Event::SaveProfile {
                display_name: "New".into(),
                bio: String::new(),
                photo: None,
            },
            &mut m,
        );
        assert_eq!(m.outbox.len(), 2, "the in-flight item is left alone");

        let _ = app.update(Event::SendResult(Ok(ok_response(200))), &mut m);
        assert_eq!(m.outbox.len(), 1, "the sent one is popped");
        let parsed = protocol::parse_payload(m.outbox[0].envelope_json.as_bytes()).unwrap();
        match parsed.payload {
            Payload::Profile { display_name, .. } => assert_eq!(
                display_name, "New",
                "and the newer profile survives to be sent"
            ),
            _ => panic!("expected a profile"),
        }
    }

    // -----------------------------------------------------------------------
    // in-flight bookkeeping
    // -----------------------------------------------------------------------

    /// `SendResult` pops by count off the head of the outbox. If the items it sent
    /// were removed from under it — the user blocked the peer mid-send — popping by
    /// count anyway takes whatever slid into their place: another peer's mail.
    #[test]
    fn blocking_the_peer_mid_send_does_not_pop_someone_elses_messages() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        let enemy = peer_hex(9);
        let friend = peer_hex(11);
        m.contacts
            .insert(enemy.clone(), Contact::new(enemy.clone(), String::new(), 0));
        m.outbox.push_back(queued(&enemy, "e1"));
        m.outbox.push_back(queued(&enemy, "e2"));
        m.outbox.push_back(queued(&friend, "f1"));

        let _ = app.update(Event::StartFlush, &mut m);
        assert_eq!(m.in_flight.as_ref().unwrap().count, 2);

        // Blocked mid-flight: the two items in the air are dropped from the queue.
        let _ = app.update(
            Event::SetBlocked {
                peer: enemy.clone(),
                blocked: true,
            },
            &mut m,
        );
        assert_eq!(m.outbox.len(), 1);

        // The send lands. It must pop nothing.
        let _ = app.update(Event::SendResult(Ok(ok_response(200))), &mut m);
        assert_eq!(m.outbox.len(), 1, "the friend's message is untouched");
        assert_eq!(m.outbox[0].recipient, friend);
    }

    // -----------------------------------------------------------------------
    // delete contact
    // -----------------------------------------------------------------------

    /// Blocking only silences a peer; the entry stayed in the list forever.
    #[test]
    fn deleting_a_contact_forgets_the_contact_the_history_and_the_queue() {
        let app = Skrepka;
        let mut m = with_identity();
        let peer = peer_hex(9);
        let other = peer_hex(11);
        for p in [&peer, &other] {
            m.contacts
                .insert(p.clone(), Contact::new(p.clone(), String::new(), 0));
            m.messages.insert(
                p.clone(),
                vec![StoredMessage {
                    id: "m1".into(),
                    body: "hi".into(),
                    ts: 1,
                    outgoing: false,
                    delivered: false,
                }],
            );
            m.outbox.push_back(queued(p, "queued"));
        }
        m.active_peer = Some(peer.clone());
        m.page = Page::Chat;

        let mut cmd = app.update(Event::DeleteContact { peer: peer.clone() }, &mut m);

        assert!(!m.contacts.contains_key(&peer));
        assert!(!m.messages.contains_key(&peer));
        assert!(
            m.outbox.iter().all(|i| i.recipient != peer),
            "nothing more goes to a peer we have forgotten"
        );
        assert_eq!(m.page, Page::Conversations, "the open chat is closed");
        assert!(m.active_peer.is_none());

        // Everyone else is untouched.
        assert!(m.contacts.contains_key(&other));
        assert_eq!(m.messages[&other].len(), 1);
        assert_eq!(m.outbox.len(), 1);

        // The history blob is *deleted*, not left behind holding what the user just
        // asked us to forget.
        let deleted = cmd.effects().any(|e| {
            matches!(e, Effect::KeyValue(req)
                if matches!(&req.operation, crux_kv::KeyValueOperation::Delete { key } if key == &k_messages(&peer)))
        });
        assert!(deleted, "the messages:<peer> key is removed");
    }

    /// Deleting a peer we are not looking at must not throw the user out of the
    /// chat they *are* looking at.
    #[test]
    fn deleting_another_contact_leaves_the_open_chat_alone() {
        let app = Skrepka;
        let mut m = with_identity();
        let open = peer_hex(9);
        let doomed = peer_hex(11);
        for p in [&open, &doomed] {
            m.contacts
                .insert(p.clone(), Contact::new(p.clone(), String::new(), 0));
        }
        m.active_peer = Some(open.clone());
        m.page = Page::Chat;

        let _ = app.update(Event::DeleteContact { peer: doomed }, &mut m);

        assert_eq!(m.page, Page::Chat);
        assert_eq!(m.active_peer.as_deref(), Some(open.as_str()));
    }

    // -----------------------------------------------------------------------
    // watermark clamping
    // -----------------------------------------------------------------------

    /// An ack at `ts = i64::MAX` used to park `last_ack_ts` a minute into the
    /// future — and every honest ack that followed, the ones that actually mark our
    /// messages delivered, read as stale and was dropped. A peer could silence its
    /// own delivery receipts forever with one payload.
    #[test]
    fn a_far_future_ack_cannot_suppress_the_acks_that_follow_it() {
        let app = Skrepka;
        let mut m = with_identity();
        let peer = peer_hex(9);
        m.contacts
            .insert(peer.clone(), Contact::new(peer.clone(), String::new(), 0));
        m.messages.insert(
            peer.clone(),
            vec![StoredMessage {
                id: "m1".into(),
                body: "hi".into(),
                ts: 1,
                outgoing: true,
                delivered: false,
            }],
        );

        // The poisoned ack: acks nothing we sent, but sets the watermark.
        let ack = Payload::DeliveryAck {
            ack_ids: vec!["nothing".into()],
        };
        let page = page_from(9, &m, &ack, i64::MAX);
        let _ = app.ingest_poll(&mut m, page);
        assert!(
            m.contacts[&peer].last_ack_ts <= now_ms(),
            "the watermark cannot be pushed into the future"
        );

        // A perfectly ordinary ack, sent now. It must still land.
        let ack = Payload::DeliveryAck {
            ack_ids: vec!["m1".into()],
        };
        let page = page_from(9, &m, &ack, now_ms());
        let _ = app.ingest_poll(&mut m, page);
        assert!(
            m.messages[&peer][0].delivered,
            "an honest ack after a far-future one must still be honoured"
        );
    }

    /// The same trick against `last_profile_ts`: a profile at `ts = i64::MAX` would
    /// freeze the peer's own entry, since every honest update they sent afterwards
    /// would read as a stale replay of itself.
    #[test]
    fn a_far_future_profile_cannot_freeze_the_peers_own_profile() {
        let app = Skrepka;
        let mut m = with_identity();
        let peer = peer_hex(9);
        m.contacts
            .insert(peer.clone(), Contact::new(peer.clone(), String::new(), 0));

        let profile = |name: &str| Payload::Profile {
            display_name: name.into(),
            bio: String::new(),
            photo: None,
        };
        let page = page_from(9, &m, &profile("Far"), i64::MAX);
        let _ = app.ingest_poll(&mut m, page);
        let first_ts = m.contacts[&peer].last_profile_ts;
        assert!(first_ts <= now_ms());

        // A later profile at a greater ts must still apply — the clamping
        // is what stops the far-future one from freezing the peer.
        let page = page_from(9, &m, &profile("Now"), first_ts + 1);
        let _ = app.ingest_poll(&mut m, page);
        assert_eq!(
            m.contacts[&peer].display_name, "Now",
            "a later, honest profile must still apply"
        );
    }

    // -----------------------------------------------------------------------
    // conversation ordering
    // -----------------------------------------------------------------------

    /// The conversation is held in `ts` order rather than re-sorted per arrival.
    /// `trim_history` ages out the *front*, so an out-of-order insert does not just
    /// render wrong — it throws away the wrong message.
    #[test]
    fn messages_are_inserted_in_timestamp_order() {
        let app = Skrepka;
        let mut m = with_identity();
        let peer = peer_hex(9);

        // Arrive out of order, including a tie.
        for (i, ts) in [300i64, 100, 200, 200].into_iter().enumerate() {
            let page = page_from(9, &m, &text(&format!("m{i}"), "x"), ts);
            let _ = app.ingest_poll(&mut m, page);
        }
        // ...and an outgoing message, which used to be appended blindly.
        m.active_peer = Some(peer.clone());
        m.compose = "mine".into();
        let _ = app.update(Event::SendText, &mut m);

        let convo = &m.messages[&peer];
        assert!(
            convo.windows(2).all(|w| w[0].ts <= w[1].ts),
            "the conversation is sorted: {:?}",
            convo.iter().map(|s| s.ts).collect::<Vec<_>>()
        );
        // Ties keep arrival order, exactly as the stable sort used to give.
        let tied: Vec<&str> = convo
            .iter()
            .filter(|s| s.ts == 200)
            .map(|s| s.id.as_str())
            .collect();
        assert_eq!(tied, vec!["m2", "m3"]);
    }

    /// PROTOCOL.md §4: a blocked peer's messages are not shown — and acking them
    /// would tell the blocked peer we are online and reading.
    #[test]
    fn a_blocked_senders_message_is_neither_stored_nor_acked() {
        let app = Skrepka;
        let mut m = with_identity();
        let peer = peer_hex(9);
        let mut contact = Contact::new(peer.clone(), "Bob".into(), 0);
        contact.blocked = true;
        m.contacts.insert(peer.clone(), contact);

        let page = page_from(9, &m, &text("m1", "hi"), now_ms());
        let _ = app.ingest_poll(&mut m, page);

        assert!(
            m.messages.get(&peer).is_none_or(Vec::is_empty),
            "a blocked peer's message must not be stored"
        );
        assert!(m.outbox.is_empty(), "no delivery.ack goes back to a blocked peer");
        // ...and nothing to render in the chat, even if it is opened.
        m.active_peer = Some(peer);
        m.page = Page::Chat;
        assert!(app.view(&m).messages.is_empty());
    }

    /// The same page, unblocked: the control that proves the gate is the block
    /// flag and not something else in the ingest path.
    fn ingest_one_text_from_an_unblocked_peer() -> (Model, String) {
        let app = Skrepka;
        let mut m = with_identity();
        let peer = peer_hex(9);
        let page = page_from(9, &m, &text("m1", "hi"), now_ms());
        let _ = app.ingest_poll(&mut m, page);
        (m, peer)
    }

    #[test]
    fn an_unblocked_senders_message_is_stored_and_acked() {
        let (m, peer) = ingest_one_text_from_an_unblocked_peer();
        assert_eq!(m.messages[&peer].len(), 1);
        assert_eq!(m.messages[&peer][0].body, "hi");
        assert_eq!(m.outbox.len(), 1, "one delivery.ack is queued");
        assert_eq!(m.outbox[0].recipient, peer);
    }

    /// A peer sending `ts = i64::MAX` used to pin itself to the top of the
    /// conversation list forever, and render with an absurd timestamp.
    #[test]
    fn a_far_future_timestamp_is_clamped_to_now() {
        let app = Skrepka;
        let mut m = with_identity();
        let peer = peer_hex(9);

        let page = page_from(9, &m, &text("m1", "hi"), i64::MAX);
        let before = now_ms();
        let _ = app.ingest_poll(&mut m, page);

        let ts = m.messages[&peer][0].ts;
        assert!(
            ts <= now_ms() + MAX_FUTURE_SKEW_MS,
            "ts {ts} must be clamped into the skew window"
        );
        assert!(ts >= before, "and clamped to now, not to some past value");
        // The clamped value is what the shell sorts and renders by.
        assert_eq!(app.view(&m).contacts[0].last_ts, ts);
    }

    /// Honest clock skew inside the tolerance is preserved as-is.
    #[test]
    fn a_slightly_future_timestamp_is_kept() {
        let app = Skrepka;
        let mut m = with_identity();
        let peer = peer_hex(9);
        let ts = now_ms() + 5_000;

        let page = page_from(9, &m, &text("m1", "hi"), ts);
        let _ = app.ingest_poll(&mut m, page);

        assert_eq!(m.messages[&peer][0].ts, ts);
    }

    #[test]
    fn message_history_is_capped_at_the_cutoff() {
        let app = Skrepka;
        let mut m = with_identity();
        let peer = peer_hex(9);

        let convo = m.messages.entry(peer.clone()).or_default();
        for i in 0..MAX_MESSAGES_PER_PEER {
            convo.push(StoredMessage {
                id: format!("old-{i}"),
                body: "x".into(),
                ts: i as i64,
                outgoing: false,
                delivered: false,
            });
        }

        let page = page_from(9, &m, &text("new", "newest"), now_ms());
        let _ = app.ingest_poll(&mut m, page);

        let convo = &m.messages[&peer];
        assert_eq!(convo.len(), MAX_MESSAGES_PER_PEER, "the cap holds");
        assert_eq!(convo.last().unwrap().id, "new", "the newest is kept");
        assert_eq!(convo.first().unwrap().id, "old-1", "the oldest is aged out");
    }

    /// An off-curve key can't be encrypted to, so the send is dropped — but the
    /// user has to be told, rather than watching the message vanish.
    #[test]
    fn a_send_to_an_unusable_key_reports_an_error() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        let bad = hex::encode([0xabu8; 32]); // 32 bytes, not a curve point
        m.outbox
            .push_back(OutboxItem::new(bad, Arc::new("{}".into())));

        let _ = app.update(Event::StartFlush, &mut m);

        assert!(m.outbox.is_empty(), "the unsendable item does not wedge the outbox");
        assert!(!m.flushing);
        let err = m.error.expect("the failure is surfaced");
        assert!(err.contains("invalid key"), "got: {err}");
    }

    #[test]
    fn add_contact_rejects_a_key_that_is_not_a_curve_point() {
        let app = Skrepka;
        let mut m = with_identity();
        let bad = hex::encode([0xabu8; 32]);

        let _ = app.update(
            Event::AddContact {
                input: bad.clone(),
                nickname: "Mallory".into(),
            },
            &mut m,
        );

        assert!(!m.contacts.contains_key(&bad), "an unsendable contact is not stored");
        assert!(m.error.is_some());
    }

    /// A dropped kv write silently loses data; it must not be swallowed.
    #[test]
    fn a_failed_save_surfaces_an_error() {
        let app = Skrepka;
        let mut m = with_identity();

        let _ = app.update(
            Event::Saved(Err(crux_kv::error::KeyValueError::Io {
                message: "no space left on device".into(),
            })),
            &mut m,
        );
        assert!(m.error.is_some(), "a failed write is reported");

        // A successful write stays quiet.
        m.error = None;
        let _ = app.update(Event::Saved(Ok(None)), &mut m);
        assert!(m.error.is_none());
    }

    #[test]
    fn server_host_strips_scheme_port_and_case() {
        assert_eq!(server_host("https://Relay.Example.com:8443/x"), "relay.example.com");
        assert_eq!(server_host("http://localhost:8080"), "localhost");
        assert_eq!(server_host("https://relay.example.com./x"), "relay.example.com");
        // Its only caller passes `settings.server_url`, which is always an
        // absolute URL (`normalize_server_url` guarantees it). Anything else is a
        // bug, and an empty host produces a signature the relay rejects — which is
        // the right failure: loud, not a silently-wrong host binding.
        assert_eq!(server_host("relay.example.com"), "");
    }

    /// The auth signature is bound to the host (PROTOCOL.md §6), so `server_host`
    /// has to agree with what the relay computes. Splitting on `:` by hand cut an
    /// IPv6 literal at its first colon and produced `[`.
    #[test]
    fn server_host_handles_an_ipv6_literal() {
        assert_eq!(server_host("http://[::1]:8080"), "[::1]");
        assert_eq!(
            server_host("https://[2001:DB8::1]/poll"),
            "[2001:db8::1]"
        );
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

    /// Gating ingest stops the acks we have not queued yet — but the ack for the
    /// message that made the user hit "block" is already in the outbox, and an ack
    /// is exactly the "we are online and reading you" signal the block exists to
    /// cut off.
    #[test]
    fn blocking_a_peer_drops_what_is_already_queued_for_them() {
        let app = Skrepka;
        let mut m = with_identity();
        let enemy = peer_hex(9);
        let friend = peer_hex(11);
        m.contacts
            .insert(enemy.clone(), Contact::new(enemy.clone(), String::new(), 0));

        // An ack to the peer we are about to block, plus unrelated mail.
        for recipient in [&enemy, &friend] {
            m.outbox.push_back(OutboxItem::new(
                recipient.clone(),
                Arc::new(protocol::serialize_payload(
                    &Payload::DeliveryAck {
                        ack_ids: vec!["m1".into()],
                    },
                    1,
                )),
            ));
        }

        let _ = app.update(
            Event::SetBlocked {
                peer: enemy.clone(),
                blocked: true,
            },
            &mut m,
        );

        let recipients: Vec<&str> = m.outbox.iter().map(|o| o.recipient.as_str()).collect();
        assert_eq!(
            recipients,
            vec![friend.as_str()],
            "nothing more goes to a blocked peer — and everyone else is untouched"
        );
    }

    #[test]
    fn normalize_server_url_requires_an_http_scheme() {
        // The real parser canonicalizes: scheme and host are lowercased.
        assert_eq!(
            normalize_server_url("  https://Relay.Example.com/  "),
            Some("https://relay.example.com".to_string())
        );
        assert_eq!(
            normalize_server_url("HTTP://localhost:8080///"),
            Some("http://localhost:8080".to_string())
        );
        assert_eq!(
            normalize_server_url("http://[::1]:8080"),
            Some("http://[::1]:8080".to_string())
        );
        // The cases that used to panic Http::post or produce a dead URL.
        assert_eq!(normalize_server_url("relay.example.com"), None);
        assert_eq!(normalize_server_url("localhost:8080"), None);
        assert_eq!(normalize_server_url("ftp://relay.example.com"), None);
        assert_eq!(normalize_server_url("http://"), None);
        assert_eq!(normalize_server_url("http://:8080"), None);
        assert_eq!(normalize_server_url("https://relay example.com"), None);
        assert_eq!(normalize_server_url(""), None);
    }

    /// The hand-rolled validator this replaces was not the parser it guarded:
    /// it waved these through, and `crux_http` unwraps the parse.
    #[test]
    fn normalize_server_url_rejects_what_the_url_parser_rejects() {
        assert_eq!(normalize_server_url("http://[bad"), None);
        assert_eq!(normalize_server_url("http://ho^st"), None);
        assert_eq!(normalize_server_url("http://a\u{7f}b"), None);
    }

    /// Every request appends a path, so a query or fragment would silently
    /// swallow it: `http://x?y` + "/poll" is `http://x?y/poll` — a request to `/`
    /// with a junk query, not to the poll endpoint.
    #[test]
    fn normalize_server_url_rejects_a_query_or_fragment() {
        assert_eq!(normalize_server_url("http://x?y"), None);
        assert_eq!(normalize_server_url("https://relay.example.com/#frag"), None);
    }

    #[test]
    fn set_server_url_rejects_schemeless_and_keeps_the_old_url() {
        let app = Skrepka;
        let mut m = with_identity();
        let original = m.settings.server_url.clone();

        let _ = app.update(Event::SetServerUrl("relay.example.com".into()), &mut m);
        assert_eq!(m.settings.server_url, original, "bad URL must not persist");
        assert!(m.error.is_some());

        let _ = app.update(
            Event::SetServerUrl(" https://relay.example.com/ ".into()),
            &mut m,
        );
        assert_eq!(m.settings.server_url, "https://relay.example.com");
        assert!(m.error.is_none());
        assert!(m.token.is_none());
        assert_eq!(m.conn, ConnStatus::Offline);
    }

    /// The regression that stalled the outbox: `flushing` stayed `true` forever
    /// after the first successful send, so nothing was ever sent again.
    #[test]
    fn send_result_ok_clears_flushing() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        m.outbox
            .push_back(OutboxItem::new(peer_hex(9), Arc::new("{}".into())));

        let _ = app.update(Event::StartFlush, &mut m);
        assert!(m.flushing);

        let resp = crux_http::testing::ResponseBuilder::ok().body(Vec::new()).build();
        let _ = app.update(Event::SendResult(Ok(resp)), &mut m);

        assert!(!m.flushing, "flushing must be cleared on the success path");
        assert!(m.outbox.is_empty(), "the sent item is dropped from the outbox");
    }

    #[test]
    fn flush_next_resumes_after_a_successful_send() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        // Two different peers, or the batching would send both at once.
        for seed in [9u8, 11] {
            m.outbox
                .push_back(OutboxItem::new(peer_hex(seed), Arc::new("{}".into())));
        }
        // First send goes out and marks the model as flushing.
        let _ = app.update(Event::StartFlush, &mut m);
        assert!(m.flushing);

        // Its success must both drop the item and let the *next* one go out.
        let resp = crux_http::testing::ResponseBuilder::ok().body(Vec::new()).build();
        let _ = app.update(Event::SendResult(Ok(resp)), &mut m);
        assert_eq!(m.outbox.len(), 1);
        assert!(m.flushing, "the second item is now in flight");
    }

    #[test]
    fn poll_is_a_noop_while_a_poll_is_already_in_flight() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());

        let _ = app.update(Event::Poll, &mut m);
        assert!(m.polling, "the first Poll issues a request");
        let gen = m.poll_gen;

        // A second Poll (e.g. from a re-auth) must not stack another loop.
        let _ = app.update(Event::Poll, &mut m);
        assert!(m.polling);
        assert_eq!(m.poll_gen, gen, "and does not open a new generation");

        // Both success and failure release the guard so the loop can continue.
        let resp = crux_http::testing::ResponseBuilder::ok().body(Vec::new()).build();
        let _ = app.update(Event::PollResult(m.poll_gen, Ok(resp)), &mut m);
        assert!(!m.polling);

        let _ = app.update(Event::Poll, &mut m);
        assert!(m.polling);
        let _ = app.update(
            Event::PollResult(m.poll_gen, Err(crux_http::HttpError::Timeout)),
            &mut m,
        );
        assert!(!m.polling);
    }

    /// The cursor is the *relay's* sequence number, and the next poll acks
    /// everything up to it. Carrying relay A's cursor over to relay B tells B to
    /// delete every message waiting for us before handing any of them over.
    #[test]
    fn switching_relays_resets_the_cursor() {
        let app = Skrepka;
        let mut m = with_identity();
        m.cursor = now_ms();
        m.token = Some("t".into());
        m.conn = ConnStatus::Online;

        let _ = app.update(Event::SetServerUrl("https://other.example.com".into()), &mut m);

        assert_eq!(m.cursor, 0, "the new relay is polled from the beginning");
        assert!(m.token.is_none(), "the old relay's token is worthless");
        assert_eq!(m.conn, ConnStatus::Offline);
    }

    /// Resetting the cursor is not enough on its own: the poll already in flight
    /// is addressed to the *old* relay and its page carries the old relay's
    /// sequence number. Letting it land writes that number straight back over the
    /// reset, and the next poll hands it to the new relay — which reads it as an
    /// ack and drops every message queued for us before serving any of them.
    #[test]
    fn switching_relays_retires_the_poll_still_in_flight_at_the_old_one() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        m.conn = ConnStatus::Online;

        let _ = app.update(Event::Poll, &mut m);
        let old_relay_poll = m.poll_gen;
        assert!(m.polling);

        let _ = app.update(Event::SetServerUrl("https://other.example.com".into()), &mut m);
        assert!(!m.polling, "the old relay's poll no longer holds the guard");

        // It resolves after the switch, carrying the old relay's cursor.
        let body = serde_json::to_vec(&serde_json::json!({
            "events": [],
            "cursor": 1_700_000_000_000i64,
        }))
        .unwrap();
        let resp = crux_http::testing::ResponseBuilder::ok().body(body).build();
        let _ = app.update(Event::PollResult(old_relay_poll, Ok(resp)), &mut m);

        assert_eq!(
            m.cursor, 0,
            "the new relay must not be handed a cursor from a sequence it never issued"
        );
    }

    /// A URL that the parser rejects reaches `Http::post`, which unwraps it. On
    /// disk it is a panic on every launch — a boot loop with no way out.
    #[test]
    fn a_corrupt_persisted_server_url_falls_back_to_the_default() {
        let app = Skrepka;
        let mut m = with_identity();
        m.loads_pending = STARTUP_LOADS;

        let junk = serde_json::to_vec(&serde_json::json!({"server_url": "http://[bad"})).unwrap();
        let _ = app.update(Event::LoadedSettings(Ok(Some(junk))), &mut m);

        assert_eq!(m.settings.server_url, DEFAULT_SERVER_URL);
        assert!(
            normalize_server_url(&m.settings.server_url).is_some(),
            "whatever we end up with must survive the parser"
        );
    }

    /// A settings blob written before a field existed must still load — otherwise
    /// `parse_kv` returns None, the default is used, and the next write destroys
    /// what was there.
    #[test]
    fn an_old_settings_blob_still_loads() {
        let app = Skrepka;
        let mut m = with_identity();
        m.loads_pending = STARTUP_LOADS;

        let empty = serde_json::to_vec(&serde_json::json!({})).unwrap();
        let _ = app.update(Event::LoadedSettings(Ok(Some(empty))), &mut m);
        assert_eq!(m.settings.server_url, DEFAULT_SERVER_URL);

        // ...and a Contact missing every optional field still becomes a contact.
        let peer = peer_hex(9);
        let old = serde_json::to_vec(&serde_json::json!([{"pubkey": peer}])).unwrap();
        let _ = app.update(Event::LoadedContacts(Ok(Some(old))), &mut m);
        assert!(m.contacts.contains_key(&peer));
    }

    /// Connecting before the startup loads land lets a poll be ingested against a
    /// half-loaded model — and the loads still in flight then overwrite it.
    #[test]
    fn connect_waits_for_every_startup_load() {
        let app = Skrepka;
        let mut m = with_identity();
        m.loads_pending = STARTUP_LOADS;

        let connects = |cmd: &mut Command<Effect, Event>| {
            cmd.events()
                .filter(|e| matches!(e, Event::Connect))
                .count()
        };

        for (i, ev) in [
            Event::LoadedSettings(Ok(None)),
            Event::LoadedProfile(Ok(None)),
            Event::LoadedContacts(Ok(None)),
            Event::LoadedCursor(Ok(None)),
        ]
        .into_iter()
        .enumerate()
        {
            let mut cmd = app.update(ev, &mut m);
            assert_eq!(
                m.loads_pending,
                STARTUP_LOADS - 1 - i as u8,
                "each load ticks the counter down"
            );
            assert_eq!(connects(&mut cmd), 0, "and none of them connects");
        }

        // The fifth — and only the fifth — emits Connect.
        let mut cmd = app.update(Event::LoadedOutbox(Ok(None)), &mut m);
        assert_eq!(m.loads_pending, 0);
        assert_eq!(connects(&mut cmd), 1, "the last load connects, exactly once");

        // A late duplicate (a re-delivered load) must not connect again.
        let mut cmd = app.update(Event::LoadedOutbox(Ok(None)), &mut m);
        assert_eq!(connects(&mut cmd), 0);
    }

    /// The sharpest edge of a failed read, and the one that costs the user real
    /// messages: `ingest_poll` persists the outbox on *every* poll page, including
    /// an empty one. So a single unreadable outbox — a background wake with the
    /// device locked — followed by one idle poll used to write `[]` over a queue of
    /// unsent mail. The client destroys the user's messages by doing nothing at all.
    ///
    /// A read failure is not an empty key. Nothing may be written until a launch
    /// reads the key successfully.
    #[test]
    fn a_failed_read_never_writes_over_what_it_could_not_read() {
        let app = Skrepka;
        let mut m = with_identity();
        m.loads_pending = STARTUP_LOADS;

        let connects = |cmd: &mut Command<Effect, Event>| {
            cmd.events()
                .filter(|e| matches!(e, Event::Connect))
                .count()
        };
        // Every key a command actually writes. The model's own view of what it saved
        // cannot see these — the write lives entirely in the effect.
        let kv_writes = |cmd: &mut Command<Effect, Event>| {
            cmd.effects()
                .filter_map(|e| match e {
                    Effect::KeyValue(req) => match &req.operation {
                        crux_kv::KeyValueOperation::Set { key, .. } => Some(key.clone()),
                        _ => None,
                    },
                    _ => None,
                })
                .collect::<Vec<_>>()
        };

        let _ = app.update(Event::LoadedSettings(Ok(None)), &mut m);
        let _ = app.update(Event::LoadedProfile(Ok(None)), &mut m);
        let _ = app.update(Event::LoadedContacts(Ok(None)), &mut m);
        let _ = app.update(Event::LoadedCursor(Ok(None)), &mut m);
        // The outbox is the one that could not be read — a background wake with the
        // device locked. The model now believes it is empty; the disk says otherwise.
        let mut cmd = app.update(
            Event::LoadedOutbox(Err(crux_kv::error::KeyValueError::Io {
                message: "device is locked".into(),
            })),
            &mut m,
        );

        assert!(m.kv_load_failed, "the model knows it has a hole in it");
        assert!(m.error.is_some(), "and says so");
        assert_eq!(
            connects(&mut cmd),
            0,
            "the last load does not connect: a poll would ack mail we cannot store"
        );

        // Every write path is closed, whatever tries to open it.
        let mut cmd = app.update(
            Event::AddContact {
                input: peer_hex(9),
                nickname: "n".into(),
            },
            &mut m,
        );
        assert!(
            kv_writes(&mut cmd).is_empty(),
            "contacts are not written over an unread model"
        );

        // And the regression itself. `ingest_poll` persists the outbox on every page,
        // so one idle poll used to be enough to write `[]` over the queue on disk.
        m.token = Some("t".into());
        let resp = crux_http::testing::ResponseBuilder::ok()
            .body(br#"{"events":[],"cursor":42}"#.to_vec())
            .build();
        let mut cmd = app.update(Event::PollResult(m.poll_gen, Ok(resp)), &mut m);
        assert!(
            kv_writes(&mut cmd).is_empty(),
            "an empty poll writes nothing — not the outbox, not the cursor"
        );

        // The recovery is a relaunch, which re-runs the loads and clears the latch.
        let sk = Identity::from_seed(&[3u8; 32]).secret_key.to_vec();
        let _ = app.update(Event::IdentityLoaded(sk), &mut m);
        assert!(
            !m.kv_load_failed,
            "a fresh round of loads gets to answer for itself"
        );
    }

    /// `Authenticate` is reachable from startup, a 401 on poll, a 401 on send and
    /// a reconnect timer. Without a guard a network blip fires all of them, and
    /// every token that comes back starts its own poll loop.
    #[test]
    fn authentication_does_not_stack() {
        let app = Skrepka;
        let mut m = with_identity();

        let _ = app.update(Event::Authenticate, &mut m);
        assert!(m.authenticating, "the first one goes out");
        assert_eq!(m.conn, ConnStatus::Connecting);

        // A second Authenticate while the first is in flight is a no-op.
        m.conn = ConnStatus::Offline;
        let _ = app.update(Event::Authenticate, &mut m);
        assert_eq!(m.conn, ConnStatus::Offline, "no second challenge was issued");

        // Any terminal outcome releases the guard.
        let _ = app.update(
            Event::ChallengeResult(m.auth_gen, Err(crux_http::HttpError::Timeout)),
            &mut m,
        );
        assert!(!m.authenticating);

        let _ = app.update(Event::Authenticate, &mut m);
        assert!(m.authenticating);
        let _ = app.update(
            Event::VerifyResult(m.auth_gen, Err(crux_http::HttpError::Timeout)),
            &mut m,
        );
        assert!(!m.authenticating);
    }

    /// The shell fires `Connect` on *every* return to the foreground
    /// (`SkrepkaApp.swift`), so a challenge issued before the app was backgrounded
    /// is routinely still in flight when the next attempt starts. It must not come
    /// back and install a token, or clobber `conn`, on top of the attempt that
    /// replaced it.
    #[test]
    fn an_auth_round_trip_superseded_by_connect_cannot_land() {
        let app = Skrepka;
        let mut m = with_identity();

        let _ = app.update(Event::Authenticate, &mut m);
        let superseded = m.auth_gen;
        assert!(m.authenticating);

        // Foregrounding restarts the flow.
        dispatch(&app, Event::Connect, &mut m);
        let live = m.auth_gen;
        assert_ne!(live, superseded, "the in-flight attempt was retired");
        assert!(m.authenticating, "and a fresh one went out");

        // The old challenge finally answers. It is not ours any more.
        let body = serde_json::to_vec(&serde_json::json!({"challenge": "deadbeef"})).unwrap();
        let resp = crux_http::testing::ResponseBuilder::ok().body(body).build();
        let _ = app.update(Event::ChallengeResult(superseded, Ok(resp)), &mut m);
        assert!(
            m.authenticating,
            "the live attempt still holds the guard — a stale leg must not release it"
        );

        // Nor may a stale *verify* install a token over the live attempt.
        let body = serde_json::to_vec(&serde_json::json!({"token": "stale"})).unwrap();
        let resp = crux_http::testing::ResponseBuilder::ok().body(body).build();
        let _ = app.update(Event::VerifyResult(superseded, Ok(resp)), &mut m);
        assert!(m.token.is_none(), "no token from a superseded attempt");
        assert_ne!(m.conn, ConnStatus::Online);

        // The live attempt still completes normally.
        let body = serde_json::to_vec(&serde_json::json!({"token": "real"})).unwrap();
        let resp = crux_http::testing::ResponseBuilder::ok().body(body).build();
        let _ = app.update(Event::VerifyResult(live, Ok(resp)), &mut m);
        assert_eq!(m.token.as_deref(), Some("real"));
        assert_eq!(m.conn, ConnStatus::Online);
    }

    /// Blocking is meant to cut a peer off in *both* directions.
    #[test]
    fn a_blocked_peer_cannot_update_their_profile_or_ack_our_messages() {
        let app = Skrepka;
        let mut m = with_identity();
        let peer = peer_hex(9);
        let mut contact = Contact::new(peer.clone(), "Bob".into(), 0);
        contact.blocked = true;
        contact.display_name = "Bob".into();
        m.contacts.insert(peer.clone(), contact);
        m.messages.insert(
            peer.clone(),
            vec![StoredMessage {
                id: "mine".into(),
                body: "hi".into(),
                ts: 1,
                outgoing: true,
                delivered: false,
            }],
        );

        let profile = Payload::Profile {
            display_name: "Mallory".into(),
            bio: "spam".into(),
            photo: Some("aGk=".into()),
        };
        let page = page_from(9, &m, &profile, now_ms());
        let _ = app.ingest_poll(&mut m, page);
        assert_eq!(
            m.contacts[&peer].display_name, "Bob",
            "a blocked peer cannot rewrite their entry in our contact list"
        );

        let ack = Payload::DeliveryAck {
            ack_ids: vec!["mine".into()],
        };
        let page = page_from(9, &m, &ack, now_ms());
        let _ = app.ingest_poll(&mut m, page);
        assert!(
            !m.messages[&peer][0].delivered,
            "nor tell us they read what we sent before the block"
        );
    }

    /// Blocking someone and then updating our profile must not hand them our new
    /// display name, avatar, and a liveness signal.
    #[test]
    fn save_profile_does_not_broadcast_to_blocked_contacts() {
        let app = Skrepka;
        let mut m = with_identity();
        let friend = peer_hex(9);
        let enemy = peer_hex(11);
        m.contacts
            .insert(friend.clone(), Contact::new(friend.clone(), "Bob".into(), 0));
        let mut blocked = Contact::new(enemy.clone(), "Mallory".into(), 0);
        blocked.blocked = true;
        m.contacts.insert(enemy.clone(), blocked);

        let _ = app.update(
            Event::SaveProfile {
                display_name: "Alice".into(),
                bio: String::new(),
                photo: None,
            },
            &mut m,
        );

        let recipients: Vec<&str> = m.outbox.iter().map(|o| o.recipient.as_str()).collect();
        assert_eq!(recipients, vec![friend.as_str()]);
    }

    /// Any stranger can create a contact just by writing to us, so the list needs
    /// a ceiling — and past it, the message goes too: a stored conversation with
    /// no contact entry is one nothing can open and nothing ever trims.
    #[test]
    fn contacts_from_strangers_are_capped() {
        let app = Skrepka;
        let mut m = with_identity();
        for i in 0..MAX_CONTACTS {
            let k = format!("{i:064x}");
            m.contacts.insert(k.clone(), Contact::new(k, String::new(), 0));
        }
        assert_eq!(m.contacts.len(), MAX_CONTACTS);

        let peer = peer_hex(9);
        let page = page_from(9, &m, &text("m1", "hi"), now_ms());
        let _ = app.ingest_poll(&mut m, page);

        assert_eq!(m.contacts.len(), MAX_CONTACTS, "the cap holds");
        assert!(!m.contacts.contains_key(&peer));
        assert!(m.messages.get(&peer).is_none_or(Vec::is_empty));
        assert!(m.outbox.is_empty(), "and nothing is acked back");
    }

    /// A bare profile is an unsolicited push with no message attached. Honouring
    /// it would let anyone holding our pubkey install an entry — with an avatar —
    /// in our contact list without ever saying a word.
    #[test]
    fn a_profile_from_a_stranger_does_not_create_a_contact() {
        let app = Skrepka;
        let mut m = with_identity();
        let peer = peer_hex(9);

        let profile = Payload::Profile {
            display_name: "Mallory".into(),
            bio: String::new(),
            photo: Some("aGk=".into()),
        };
        let page = page_from(9, &m, &profile, now_ms());
        let _ = app.ingest_poll(&mut m, page);
        assert!(m.contacts.is_empty(), "no contact from a bare profile");

        // But a profile from someone we *do* know still applies.
        m.contacts
            .insert(peer.clone(), Contact::new(peer.clone(), String::new(), 0));
        let page = page_from(9, &m, &profile, now_ms());
        let _ = app.ingest_poll(&mut m, page);
        assert_eq!(m.contacts[&peer].display_name, "Mallory");
    }

    /// A relay cannot forge mail from us — the sender identity is signed inside the
    /// AEAD — but it can *echo back* a blob we sent through it, and one addressed to
    /// ourselves decrypts perfectly well. Nothing downstream would notice: it would
    /// file our own words as incoming, put our own key in our contact list (which
    /// `AddContact` explicitly refuses), and queue a delivery ack addressed to us —
    /// which flushes, comes back, and is acked again.
    #[test]
    fn a_message_from_ourselves_is_dropped() {
        let app = Skrepka;
        let mut m = with_identity();
        let me = Identity::from_secret_bytes(m.secret_key.as_ref().unwrap()).unwrap();

        let json = protocol::serialize_payload(&text("m1", "echo"), now_ms());
        let blob = crate::crypto::encrypt(
            &mut rand_core::OsRng,
            &me,
            &me.public_key(),
            json.as_bytes(),
        )
        .unwrap();
        let page = PollResp {
            events: vec![PollEvent {
                encrypted_blob: hex::encode(blob),
            }],
            cursor: 1,
        };

        let _ = app.ingest_poll(&mut m, page);

        assert!(
            !m.contacts.contains_key(&m.my_pubkey),
            "we are not our own contact"
        );
        assert!(m.messages.is_empty(), "and our own words are not incoming mail");
        assert!(m.outbox.is_empty(), "and we do not ack ourselves");
    }

    /// `polling` gates the whole long-poll loop and is cleared only by a
    /// `PollResult`. If the shell ever drops the HTTP effect, the client goes
    /// silent forever with no visible error.
    #[test]
    fn the_watchdog_unwedges_a_poll_that_never_resolved() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());

        let _ = app.update(Event::Poll, &mut m);
        assert!(m.polling);
        let wedged = m.poll_gen;

        // The watchdog armed for *this* poll releases the guard and restarts the
        // loop — which issues a fresh poll under a new generation.
        dispatch(&app, Event::PollWatchdog(wedged), &mut m);
        assert!(m.polling, "the loop restarted");
        assert_ne!(m.poll_gen, wedged, "under a new generation");
    }

    /// A watchdog is armed per poll and nothing cancels the earlier ones, so a
    /// timer for a poll that has already completed keeps firing. It must not
    /// touch the healthy poll that replaced it.
    #[test]
    fn a_stale_watchdog_leaves_the_current_poll_alone() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());

        let _ = app.update(Event::Poll, &mut m);
        let first = m.poll_gen;
        let resp = crux_http::testing::ResponseBuilder::ok().body(Vec::new()).build();
        let _ = app.update(Event::PollResult(first, Ok(resp)), &mut m);
        let _ = app.update(Event::Poll, &mut m);
        let current = m.poll_gen;
        assert!(m.polling);

        let _ = app.update(Event::PollWatchdog(first), &mut m);
        assert!(m.polling, "the live poll is untouched");
        assert_eq!(m.poll_gen, current, "and not superseded");
    }

    /// The regression the generation exists for.
    ///
    /// An HTTP effect cannot be cancelled, only abandoned — and it stays pending
    /// across an iOS suspension while the wall clock runs on, so on resume the
    /// watchdog gives up on a poll the shell is still about to resolve. If that
    /// late `PollResult` were honoured it would clear `polling` — a guard that by
    /// then belongs to the *replacement* poll — and chain a re-poll of its own.
    /// Two loops, each re-polling itself forever, doubling on every recurrence.
    #[test]
    fn a_poll_abandoned_by_the_watchdog_cannot_fork_the_loop_when_it_lands() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());

        let _ = app.update(Event::Poll, &mut m);
        let abandoned = m.poll_gen;

        // The watchdog gives up on it; the loop restarts under a new generation.
        dispatch(&app, Event::PollWatchdog(abandoned), &mut m);
        let live = m.poll_gen;
        assert!(m.polling && live != abandoned);

        // Now the abandoned request finally resolves. It must be ignored outright.
        let resp = crux_http::testing::ResponseBuilder::ok().body(Vec::new()).build();
        let mut cmd = app.update(Event::PollResult(abandoned, Ok(resp)), &mut m);

        assert!(m.polling, "the live poll still holds the guard");
        assert_eq!(m.poll_gen, live);
        assert_eq!(
            cmd.events().count(),
            0,
            "and the corpse chains nothing — no second loop"
        );
    }

    /// Dropping an abandoned page loses nothing: its cursor was never written, so
    /// the relay still holds every message in it and re-delivers them.
    #[test]
    fn an_abandoned_poll_page_is_not_ingested() {
        let app = Skrepka;
        let mut m = with_identity();
        m.token = Some("t".into());
        let peer = peer_hex(9);

        let _ = app.update(Event::Poll, &mut m);
        let abandoned = m.poll_gen;
        let page = page_from(9, &m, &text("m1", "hi"), now_ms());
        let body = serde_json::to_vec(&serde_json::json!({
            "events": [{"encryptedBlob": page.events[0].encrypted_blob}],
            "cursor": 12345,
        }))
        .unwrap();

        dispatch(&app, Event::PollWatchdog(abandoned), &mut m);
        let resp = crux_http::testing::ResponseBuilder::ok().body(body).build();
        let _ = app.update(Event::PollResult(abandoned, Ok(resp)), &mut m);

        assert!(m.messages.get(&peer).is_none_or(Vec::is_empty));
        assert_eq!(m.cursor, 0, "and the stale cursor is not adopted");
    }

    /// `view()` runs per keystroke (`ComposeChanged` renders), so cloning every
    /// contact's base64 avatar each time meant megabytes of allocation to type one
    /// message. Only the chat page has a composer, and while it is up the only
    /// avatar on screen is the peer we are talking to — so that is the only page
    /// that withholds anything.
    ///
    /// The conversations list draws an avatar per row (`ConversationsView.row`).
    /// Blanking photos there buys nothing — no keystroke renders that page — and
    /// costs every contact their picture.
    #[test]
    fn photos_are_withheld_on_the_chat_page_and_nowhere_else() {
        let app = Skrepka;
        let mut m = with_identity();
        let a = peer_hex(9);
        let b = peer_hex(11);
        for peer in [&a, &b] {
            let mut c = Contact::new(peer.clone(), String::new(), 0);
            c.photo = Some("aGVsbG8=".into());
            m.contacts.insert(peer.clone(), c);
        }
        let photo_of = |vm: &ViewModel, k: &str| {
            vm.contacts
                .iter()
                .find(|c| c.pubkey == k)
                .map(|c| c.photo.clone())
                .unwrap()
        };

        // Conversations list: every row keeps its avatar.
        let vm = app.view(&m);
        assert_eq!(photo_of(&vm, &a), "aGVsbG8=");
        assert_eq!(photo_of(&vm, &b), "aGVsbG8=");

        // Open a chat: exactly that peer's photo, and no one else's — this is the
        // page that re-renders on every keystroke.
        m.page = Page::Chat;
        m.active_peer = Some(a.clone());
        let vm = app.view(&m);
        assert_eq!(photo_of(&vm, &a), "aGVsbG8=");
        assert!(photo_of(&vm, &b).is_empty());
    }

    /// `parse_payload` drops a `delivery.ack` with more than `MAX_ACK_IDS` ids, and
    /// a peer running this code applies that cap to us. One ack payload per sender
    /// therefore stops working the moment a peer has more than the cap waiting for
    /// us — a long offline stretch — and those messages stay un-delivered on their
    /// side forever, because a page is only ever acked once.
    #[test]
    fn acks_are_batched_so_the_peer_can_actually_parse_them() {
        let app = Skrepka;
        let mut m = with_identity();
        let peer = peer_hex(9);
        m.contacts
            .insert(peer.clone(), Contact::new(peer.clone(), String::new(), 0));

        // One page holding more messages from one sender than fits in a single ack.
        let count = protocol::MAX_ACK_IDS + 5;
        let sender = Identity::from_seed(&[9u8; 32]);
        let me = Identity::from_secret_bytes(m.secret_key.as_ref().unwrap()).unwrap();
        let events = (0..count)
            .map(|i| {
                let json = protocol::serialize_payload(&text(&format!("m{i}"), "hi"), now_ms());
                let blob = crate::crypto::encrypt(
                    &mut rand_core::OsRng,
                    &sender,
                    &me.public_key(),
                    json.as_bytes(),
                )
                .unwrap();
                PollEvent {
                    encrypted_blob: hex::encode(blob),
                }
            })
            .collect();
        let _ = app.ingest_poll(&mut m, PollResp { events, cursor: 1 });

        // Local history is capped as always — but every message we *received* is
        // acked, whether or not we chose to keep it.
        assert_eq!(m.messages[&peer].len(), MAX_MESSAGES_PER_PEER);
        assert_eq!(m.outbox.len(), 2, "the acks are split into parseable batches");

        // And every batch really does survive the recipient's parser.
        let mut acked = 0;
        for item in &m.outbox {
            assert_eq!(item.recipient, peer);
            let parsed = protocol::parse_payload(item.envelope_json.as_bytes())
                .expect("a peer must be able to parse the ack we send it");
            match parsed.payload {
                Payload::DeliveryAck { ack_ids } => {
                    assert!(ack_ids.len() <= protocol::MAX_ACK_IDS);
                    acked += ack_ids.len();
                }
                _ => panic!("expected a delivery.ack"),
            }
        }
        assert_eq!(acked, count, "and between them they ack the whole page");
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

    /// A replayed delivery.ack with an older `ts` must be dropped, and
    /// `last_ack_ts` must not regress — otherwise a relay re-delivering an old
    /// page could flip messages back to "not delivered" or keep a stale ack live.
    #[test]
    fn a_replayed_delivery_ack_is_ignored() {
        let app = Skrepka;
        let mut m = with_identity();
        let peer = peer_hex(9);
        let mut contact = Contact::new(peer.clone(), "Bob".into(), 0);
        contact.last_ack_ts = 100;
        m.contacts.insert(peer.clone(), contact);
        m.messages.insert(
            peer.clone(),
            vec![StoredMessage {
                id: "m1".into(),
                body: "hi".into(),
                ts: 50,
                outgoing: true,
                delivered: false,
            }],
        );

        // An ack with ts = 50 (< 100) is stale → ignored.
        let ack = Payload::DeliveryAck {
            ack_ids: vec!["m1".into()],
        };
        let page = page_from(9, &m, &ack, 50);
        let _ = app.ingest_poll(&mut m, page);
        assert!(
            !m.messages[&peer][0].delivered,
            "a stale ack must not mark the message delivered"
        );
        assert_eq!(
            m.contacts[&peer].last_ack_ts, 100,
            "last_ack_ts must not regress"
        );

        // An ack with ts = 200 (> 100) passes → message is marked delivered.
        let ack = Payload::DeliveryAck {
            ack_ids: vec!["m1".into()],
        };
        let page = page_from(9, &m, &ack, 200);
        let _ = app.ingest_poll(&mut m, page);
        assert!(
            m.messages[&peer][0].delivered,
            "a fresh ack must mark the message delivered"
        );
        assert_eq!(
            m.contacts[&peer].last_ack_ts, 200,
            "last_ack_ts advances to the fresh ack's ts"
        );
    }

    // -----------------------------------------------------------------------
    // cursor restoration on budget exhaustion
    // -----------------------------------------------------------------------

    /// The cursor is advanced to `page.cursor` before the event loop runs. If the
    /// poll-byte budget is exhausted mid-page, the loop breaks — but the cursor
    /// must be restored to its pre-page value. Otherwise the next poll acks the
    /// whole page to the relay, which deletes every event we skipped: permanent
    /// message loss.
    #[test]
    fn a_budget_exhausted_mid_page_restores_the_cursor() {
        let app = Skrepka;
        let mut m = with_identity();
        let peer = peer_hex(9);
        m.contacts
            .insert(peer.clone(), Contact::new(peer.clone(), String::new(), 0));
        m.cursor = 100;

        // Two blobs, each at the per-blob ceiling (MAX_BLOB_LEN hex chars =
        // MAX_BLOB_LEN/2 decoded bytes = 21 MiB). Individually they pass the
        // per-blob size gate; together they exceed the 64 MiB page budget.
        // The first passes the budget check (21 < 64) and fails decrypt (it's
        // not a real blob); the second fails the budget check (21 + 21 + 21 > 64).
        // Three blobs to be sure: 3 × 21 = 63 MiB (just under 64), so use four.
        let big_hex = "ab".repeat(MAX_BLOB_LEN); // MAX_BLOB_LEN hex chars = MAX_BLOB_LEN/2 bytes
        let page = PollResp {
            events: (0..4)
                .map(|_| PollEvent {
                    encrypted_blob: big_hex.clone(),
                })
                .collect(),
            cursor: 200,
        };
        let _ = app.ingest_poll(&mut m, page);

        assert_eq!(
            m.cursor, 100,
            "the cursor must be restored — the page was not fully processed"
        );
        assert!(
            m.error.as_ref().is_some_and(|e| e.contains("oversized")),
            "the user is told"
        );
        assert!(
            m.messages.get(&peer).is_none_or(Vec::is_empty),
            "nothing was stored from the oversized page"
        );
    }

    // -----------------------------------------------------------------------
    // send_text block check
    // -----------------------------------------------------------------------

    /// Blocking cuts a peer off in both directions. `send_text` must refuse to
    /// enqueue a message to a blocked contact — otherwise the block only stops
    /// their incoming mail while we keep sending them ours.
    #[test]
    fn send_text_to_a_blocked_peer_is_refused() {
        let app = Skrepka;
        let mut m = with_identity();
        let peer = peer_hex(9);
        let mut contact = Contact::new(peer.clone(), "Enemy".into(), 0);
        contact.blocked = true;
        m.contacts.insert(peer.clone(), contact);
        m.active_peer = Some(peer.clone());
        m.compose = "hello?".into();

        let _ = app.update(Event::SendText, &mut m);

        assert!(
            m.outbox.is_empty(),
            "no message is queued for a blocked peer"
        );
        assert!(
            m.error.as_ref().is_some_and(|e| e.contains("blocked")),
            "the user is told why"
        );
        // The compose buffer is not cleared — the user might want to unblock
        // and resend, and losing their draft would be surprising.
        assert_eq!(m.compose, "hello?");
    }
}
