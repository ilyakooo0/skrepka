//! The FFI surface the Swift shell calls, via BoltFFI. Mirrors the Crux
//! counter example's `ffi.rs`: a `Bridge` that takes/returns bincode bytes.
//!
//! Nothing here may unwind. A panic crossing the Rust/Swift boundary is
//! undefined behavior, not a crash report — so every exported method runs its
//! body inside `catch_unwind` and turns a panic into an empty response. The
//! shell already tolerates an empty effect list (it just does nothing) and an
//! empty view (it renders the previous one), so a bug degrades into a stalled
//! UI rather than a corrupted process.
//!
//! Note the release profile deliberately does *not* set `panic = "abort"`:
//! aborting would fire before `catch_unwind` ever ran, which is strictly worse
//! than catching.

#![allow(clippy::used_underscore_items)]

use std::panic::{catch_unwind, AssertUnwindSafe};

use crux_core::{
    bridge::{Bridge, EffectId},
    Core,
};

use crate::Skrepka;

/// The main interface used by the shell.
pub struct CoreFFI {
    core: Bridge<Skrepka>,
}

impl Default for CoreFFI {
    fn default() -> Self {
        Self::new()
    }
}

/// Run `f`, converting a panic (or a bridge error) into an empty byte vec.
///
/// `AssertUnwindSafe` is sound here because a poisoned `Bridge` is never read
/// again for correctness: the worst case is a dropped effect batch, and the next
/// event starts a fresh `update`.
///
/// NOTE: A panic mid-`update` leaves the `Model` in a partially-mutated state.
/// The next `update` call operates on this potentially-corrupted state. A
/// proper fix requires snapshotting the Model before `update` and restoring on
/// panic, or marking the Bridge as poisoned. This is an accepted limitation.
fn guard(f: impl FnOnce() -> Vec<u8>) -> Vec<u8> {
    catch_unwind(AssertUnwindSafe(f)).unwrap_or_default()
}

#[boltffi::export]
impl CoreFFI {
    #[must_use]
    pub fn new() -> Self {
        Self {
            core: Bridge::new(Core::new()),
        }
    }

    /// Send an event to the app and return the resulting effects (bincode).
    /// Empty on a serialization failure — see the module docs.
    #[must_use]
    pub fn update(&self, data: &[u8]) -> Vec<u8> {
        guard(|| {
            let mut effects = Vec::new();
            match self.core.update(data, &mut effects) {
                Ok(()) => effects,
                Err(_) => Vec::new(),
            }
        })
    }

    /// Resolve an effect request and return the next batch of effects.
    #[must_use]
    pub fn resolve(&self, id: u32, data: &[u8]) -> Vec<u8> {
        guard(|| {
            let mut effects = Vec::new();
            match self.core.resolve(EffectId(id), data, &mut effects) {
                Ok(()) => effects,
                Err(_) => Vec::new(),
            }
        })
    }

    /// Get the current serialized `ViewModel`.
    #[must_use]
    pub fn view(&self) -> Vec<u8> {
        guard(|| {
            let mut view_model = Vec::new();
            match self.core.view(&mut view_model) {
                Ok(()) => view_model,
                Err(_) => Vec::new(),
            }
        })
    }
}
