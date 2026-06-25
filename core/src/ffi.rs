//! The FFI surface the Swift shell calls, via BoltFFI. Mirrors the Crux
//! counter example's `ffi.rs`: a `Bridge` that takes/returns bincode bytes.

#![allow(clippy::used_underscore_items)]

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

#[boltffi::export]
impl CoreFFI {
    #[must_use]
    pub fn new() -> Self {
        Self {
            core: Bridge::new(Core::new()),
        }
    }

    /// Send an event to the app and return the resulting effects (bincode).
    #[must_use]
    pub fn update(&self, data: &[u8]) -> Vec<u8> {
        let mut effects = Vec::new();
        match self.core.update(data, &mut effects) {
            Ok(()) => effects,
            Err(e) => panic!("{e}"),
        }
    }

    /// Resolve an effect request and return the next batch of effects.
    #[must_use]
    pub fn resolve(&self, id: u32, data: &[u8]) -> Vec<u8> {
        let mut effects = Vec::new();
        match self.core.resolve(EffectId(id), data, &mut effects) {
            Ok(()) => effects,
            Err(e) => panic!("{e}"),
        }
    }

    /// Get the current serialized `ViewModel`.
    #[must_use]
    pub fn view(&self) -> Vec<u8> {
        let mut view_model = Vec::new();
        match self.core.view(&mut view_model) {
            Ok(()) => view_model,
            Err(e) => panic!("{e}"),
        }
    }
}
