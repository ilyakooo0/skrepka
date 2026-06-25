//! Generates the Swift (and other) type bindings for the shell from the core's
//! Event / ViewModel / Effect types via facet typegen.

use std::path::PathBuf;

use anyhow::Result;
use clap::{Parser, ValueEnum};
use crux_core::type_generation::facet::{Config, TypeRegistry};
use log::info;

use skrepka_core::Skrepka;

#[derive(Copy, Clone, PartialEq, Eq, PartialOrd, Ord, ValueEnum)]
enum Language {
    Swift,
}

#[derive(Parser)]
#[command(version, about, long_about = None)]
struct Args {
    #[arg(short, long, value_enum)]
    language: Language,
    #[arg(short, long)]
    output_dir: PathBuf,
}

fn main() -> Result<()> {
    pretty_env_logger::init();
    let args = Args::parse();

    let typegen = TypeRegistry::new().register_app::<Skrepka>()?.build()?;
    let config = Config::builder("Skrepka", &args.output_dir).build();

    match args.language {
        Language::Swift => {
            info!("Generating Swift types");
            typegen.swift(&config)?;
        }
    }
    Ok(())
}
