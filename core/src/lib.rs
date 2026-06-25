//! Skrepka shared core — portable business logic for the iOS (and future) clients.

pub mod app;
pub mod crypto;
pub mod ffi;
pub mod model;
pub mod phonemic;
pub mod protocol;

pub use app::Skrepka;
