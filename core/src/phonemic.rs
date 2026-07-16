//! Urbit-style `@p` syllable encoding for public keys (port of Phonemic.fs).
//!
//! Each byte pair `[hi, lo]` encodes as `prefixes[hi] ++ suffixes[lo]` (6 chars);
//! pairs are joined with `-`. A 32-byte key -> 16 six-char syllables.

use std::collections::HashMap;
use std::sync::OnceLock;

const PREFIXES: [&str; 256] = [
    "doz", "mar", "bin", "wan", "sam", "lit", "sig", "hid", "fid", "lis", "sog", "dir", "wac",
    "sab", "wis", "sib", "rig", "sol", "dop", "mod", "fog", "lid", "hop", "dar", "dor", "lor",
    "hod", "fol", "rin", "tog", "sil", "mir", "hol", "pas", "lac", "rov", "liv", "dal", "sat",
    "lib", "tab", "han", "tic", "pid", "tor", "bol", "fos", "dot", "los", "dil", "for", "pil",
    "ram", "tir", "win", "tad", "bic", "dif", "roc", "wid", "bis", "das", "mid", "lop", "ril",
    "nar", "dap", "mol", "san", "loc", "nov", "sit", "nid", "tip", "sic", "rop", "wit", "nat",
    "pan", "min", "rit", "pod", "mot", "tam", "tol", "sav", "pos", "nap", "nop", "som", "fin",
    "fon", "ban", "mor", "wor", "sip", "ron", "nor", "bot", "wic", "soc", "wat", "dol", "mag",
    "pic", "dav", "bid", "bal", "tim", "tas", "mal", "lig", "siv", "tag", "pad", "sal", "div",
    "dac", "tan", "sid", "fab", "tar", "mon", "ran", "nis", "wol", "mis", "pal", "las", "dis",
    "map", "rab", "tob", "rol", "lat", "lon", "nod", "nav", "fig", "nom", "nib", "pag", "sop",
    "ral", "bil", "had", "doc", "rid", "moc", "pac", "rav", "rip", "fal", "tod", "til", "tin",
    "hap", "mic", "fan", "pat", "tac", "lab", "mog", "sim", "son", "pin", "lom", "ric", "tap",
    "fir", "has", "bos", "bat", "poc", "hac", "tid", "hav", "sap", "lin", "dib", "hos", "dab",
    "bit", "bar", "rac", "par", "lod", "dos", "bor", "toc", "hil", "mac", "tom", "dig", "fil",
    "fas", "mit", "hob", "har", "mig", "hin", "rad", "mas", "hal", "rag", "lag", "fad", "top",
    "mop", "hab", "nil", "nos", "mil", "fop", "fam", "dat", "nol", "din", "hat", "nac", "ris",
    "fot", "rib", "hoc", "nim", "lar", "fit", "wal", "rap", "sar", "nal", "mos", "lan", "don",
    "dan", "lad", "dov", "riv", "bac", "pol", "lap", "tal", "pit", "nam", "bon", "ros", "ton",
    "fod", "pon", "sov", "noc", "sor", "lav", "mat", "mip", "fip",
];

const SUFFIXES: [&str; 256] = [
    "zod", "nec", "bud", "wes", "sev", "per", "sut", "let", "ful", "pen", "syt", "dur", "wep",
    "ser", "wyl", "sun", "ryp", "syx", "dyr", "nup", "heb", "peg", "lup", "dep", "dys", "put",
    "lug", "hec", "ryt", "tyv", "syd", "nex", "lun", "mep", "lut", "sep", "pes", "del", "sul",
    "ped", "tem", "led", "tul", "met", "wen", "byn", "hex", "feb", "pyl", "dul", "het", "mev",
    "rut", "tyl", "wyd", "tep", "bes", "dex", "sef", "wyc", "bur", "der", "nep", "pur", "rys",
    "reb", "den", "nut", "sub", "pet", "rul", "syn", "reg", "tyd", "sup", "sem", "wyn", "rec",
    "meg", "net", "sec", "mul", "nym", "tev", "web", "sum", "mut", "nyx", "rex", "teb", "fus",
    "hep", "ben", "mus", "wyx", "sym", "sel", "ruc", "dec", "wex", "syr", "wet", "dyl", "myn",
    "mes", "det", "bet", "bel", "tux", "tug", "myr", "pel", "syp", "ter", "meb", "set", "dut",
    "deg", "tex", "sur", "fel", "tud", "nux", "rux", "ren", "wyt", "nub", "med", "lyt", "dus",
    "neb", "rum", "tyn", "seg", "lyx", "pun", "res", "red", "fun", "rev", "ref", "mec", "ted",
    "rus", "bex", "leb", "dux", "ryn", "num", "pyx", "ryg", "ryx", "fep", "tyr", "tus", "tyc",
    "leg", "nem", "fer", "mer", "ten", "lus", "nus", "syl", "tec", "mex", "pub", "rym", "tuc",
    "fyl", "lep", "deb", "ber", "mug", "hut", "tun", "byl", "sud", "pem", "dev", "lur", "def",
    "bus", "bep", "run", "mel", "pex", "dyt", "byt", "typ", "lev", "myl", "wed", "duc", "fur",
    "fex", "nul", "luc", "len", "ner", "lex", "rup", "ned", "lec", "ryd", "lyd", "fen", "wel",
    "nyd", "hus", "rel", "rud", "nes", "hes", "fet", "des", "ret", "dun", "ler", "nyr", "seb",
    "hul", "ryl", "lud", "rem", "lys", "fyn", "wer", "ryc", "sug", "nys", "nyl", "lyn", "dyn",
    "dem", "lux", "fed", "sed", "bec", "mun", "lyr", "tes", "mud", "nyt", "byr", "sen", "weg",
    "fyr", "mur", "tel", "rep", "teg", "pec", "nel", "nev", "fes",
];

/// Reverse tables for decoding. Built once, on first `from_ob`.
///
/// Correctness rests on both tables being duplicate-free: a `HashMap` keeps the
/// *last* of any repeated syllable, where the linear scan this replaced returned
/// the *first*. `tables_are_full_and_distinct` pins that invariant down.
static PREFIX_MAP: OnceLock<HashMap<&'static str, u8>> = OnceLock::new();
static SUFFIX_MAP: OnceLock<HashMap<&'static str, u8>> = OnceLock::new();

fn prefix_map() -> &'static HashMap<&'static str, u8> {
    PREFIX_MAP.get_or_init(|| {
        PREFIXES
            .iter()
            .enumerate()
            .map(|(i, &s)| (s, i as u8))
            .collect()
    })
}

fn suffix_map() -> &'static HashMap<&'static str, u8> {
    SUFFIX_MAP.get_or_init(|| {
        SUFFIXES
            .iter()
            .enumerate()
            .map(|(i, &s)| (s, i as u8))
            .collect()
    })
}

fn prefix_index(s: &str) -> Option<u8> {
    prefix_map().get(s).copied()
}

fn suffix_index(s: &str) -> Option<u8> {
    suffix_map().get(s).copied()
}

/// Encode bytes as a hyphen-joined `@p` string. `None` for an odd-length input.
///
/// A syllable *is* a byte pair, so an odd trailing byte has no spelling. Padding
/// it with suffix 0 (as this used to) made the encoding non-injective: `[x]` and
/// `[x, 0]` produced the same @p, and `from_ob` decoded both back to `[x, 0]`.
/// Keys are always 32 bytes, so no caller is affected — but a display helper
/// must not quietly invent a byte.
pub fn to_ob(bytes: &[u8]) -> Option<String> {
    // P1: Empty input produces an empty string, which is a valid but
    // meaningless @p — return None instead so the round-trip is symmetric.
    if bytes.is_empty() {
        return None;
    }
    if !bytes.len().is_multiple_of(2) {
        return None;
    }
    Some(
        bytes
            .chunks_exact(2)
            .map(|pair| format!("{}{}", PREFIXES[pair[0] as usize], SUFFIXES[pair[1] as usize]))
            .collect::<Vec<_>>()
            .join("-"),
    )
}

/// Decode a `@p` string back to bytes. Returns `None` if any syllable is invalid.
/// Input is case-insensitive; the syllable tables are lowercase.
pub fn from_ob(s: &str) -> Option<Vec<u8>> {
    let lowered = s.to_lowercase();
    let parts: Vec<&str> = lowered.split('-').filter(|p| !p.is_empty()).collect();
    if parts.is_empty() {
        return None;
    }
    let mut out = Vec::with_capacity(parts.len() * 2);
    for part in parts {
        // `len` is in bytes, so the ASCII check is what makes the 3-byte slices
        // below char-boundary-safe on arbitrary user input.
        if part.len() != 6 || !part.is_ascii() {
            return None;
        }
        let hi = prefix_index(&part[0..3])?;
        let lo = suffix_index(&part[3..6])?;
        out.push(hi);
        out.push(lo);
    }
    Some(out)
}

/// Check that `bytes` is a 32-byte, well-formed Ed25519 public key, and return
/// its lowercase hex.
///
/// Length alone is not enough: `crypto::encrypt` decompresses the recipient key
/// to its Montgomery form, so 32 bytes that aren't a curve point would be
/// accepted as a contact and then fail on *every* send to them.
fn valid_pubkey_hex(bytes: &[u8]) -> Option<String> {
    let key: [u8; 32] = bytes.try_into().ok()?;
    ed25519_dalek::VerifyingKey::from_bytes(&key).ok()?;
    Some(hex::encode(key))
}

/// Parse a contact identifier given as either a `@p` string or 64-char hex.
/// Returns the lowercase hex of a valid 32-byte Ed25519 public key.
pub fn try_parse_pubkey(input: &str) -> Option<String> {
    let trimmed = input.trim();
    // Try @p first (contains hyphens or non-hex syllables), then hex.
    if let Some(hex) = from_ob(trimmed).as_deref().and_then(valid_pubkey_hex) {
        return Some(hex);
    }
    if let Ok(bytes) = hex::decode(trimmed) {
        return valid_pubkey_hex(&bytes);
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The name always claimed distinctness; now the decode path depends on it.
    /// A duplicate syllable would collapse a map entry, so a table of 256 that
    /// maps to fewer than 256 keys is the exact failure this must catch.
    #[test]
    fn tables_are_full_and_distinct() {
        assert_eq!(PREFIXES.len(), 256);
        assert_eq!(SUFFIXES.len(), 256);
        assert_eq!(PREFIXES[0], "doz");
        assert_eq!(SUFFIXES[0], "zod");
        assert_eq!(prefix_map().len(), 256, "prefix table has a duplicate");
        assert_eq!(suffix_map().len(), 256, "suffix table has a duplicate");
    }

    /// Every index must survive encode -> decode. Guards the map against being
    /// built off-by-one or with a truncated cast.
    #[test]
    fn every_syllable_index_round_trips() {
        for i in 0..=255u8 {
            assert_eq!(prefix_index(PREFIXES[i as usize]), Some(i));
            assert_eq!(suffix_index(SUFFIXES[i as usize]), Some(i));
        }
        assert_eq!(prefix_index("zod"), None, "suffix must not decode as prefix");
        assert_eq!(suffix_index("doz"), None, "prefix must not decode as suffix");
    }

    #[test]
    fn round_trip_32_bytes() {
        let key: Vec<u8> = (0u8..32).collect();
        let ob = to_ob(&key).unwrap();
        assert_eq!(ob.split('-').count(), 16, "16 syllables for 32 bytes");
        assert_eq!(from_ob(&ob), Some(key));
    }

    #[test]
    fn zero_key_is_dozzod_repeated() {
        let ob = to_ob(&[0u8; 32]).unwrap();
        assert!(ob.starts_with("dozzod-dozzod"));
    }

    /// A syllable is a byte *pair*. Padding an odd trailing byte with suffix 0
    /// made `to_ob` non-injective: `[7]` and `[7, 0]` spelled the same, and
    /// `from_ob` decoded both to `[7, 0]`.
    #[test]
    fn odd_length_input_has_no_spelling() {
        assert_eq!(to_ob(&[7u8]), None);
        assert_eq!(to_ob(&[7u8, 0]), Some("hidzod".to_string()));
        assert_eq!(to_ob(&[]), None);
    }

    /// A real Ed25519 public key. `try_parse_pubkey` now checks that a key is a
    /// curve point, so tests can't use an arbitrary byte pattern.
    fn real_key() -> [u8; 32] {
        crate::crypto::Identity::from_seed(&[7u8; 32]).unwrap().public_key()
    }

    /// 32 bytes that decode fine but are *not* on the curve — the case that used
    /// to be accepted as a contact and then failed on every send to it.
    const NOT_A_POINT: [u8; 32] = [0xab; 32];

    #[test]
    fn try_parse_accepts_hex_and_ob() {
        let key = real_key();
        let hex_str = hex::encode(key);
        let ob = to_ob(&key).unwrap();
        assert_eq!(try_parse_pubkey(&hex_str), Some(hex_str.clone()));
        assert_eq!(try_parse_pubkey(&ob), Some(hex_str.clone()));
        assert_eq!(try_parse_pubkey(&hex_str.to_uppercase()), Some(hex_str));
    }

    #[test]
    fn try_parse_rejects_wrong_length_and_garbage() {
        assert_eq!(try_parse_pubkey("deadbeef"), None);
        assert_eq!(try_parse_pubkey("not-a-key"), None);
        assert_eq!(try_parse_pubkey(""), None);
    }

    #[test]
    fn try_parse_rejects_a_32_byte_key_that_is_not_a_curve_point() {
        assert!(
            ed25519_dalek::VerifyingKey::from_bytes(&NOT_A_POINT).is_err(),
            "fixture must really be off-curve"
        );
        // Both spellings of it: raw hex, and the @p it round-trips through.
        let ob = to_ob(&NOT_A_POINT).unwrap();
        assert_eq!(try_parse_pubkey(&hex::encode(NOT_A_POINT)), None);
        assert_eq!(try_parse_pubkey(&ob), None);
        // The syllable encoding itself is still lossless — only the key check fails.
        assert_eq!(from_ob(&ob), Some(NOT_A_POINT.to_vec()));
    }

    #[test]
    fn ob_parsing_is_case_insensitive() {
        let key = real_key();
        let hex_str = hex::encode(key);
        let ob = to_ob(&key).unwrap();
        assert_eq!(from_ob(&ob.to_uppercase()), Some(key.to_vec()));
        assert_eq!(try_parse_pubkey(&ob.to_uppercase()), Some(hex_str.clone()));
        // Mixed case, as a QR scan or a paste from a title-cased field might give.
        let mixed: String = ob
            .chars()
            .enumerate()
            .map(|(i, c)| {
                if i.is_multiple_of(2) {
                    c.to_ascii_uppercase()
                } else {
                    c
                }
            })
            .collect();
        assert_eq!(try_parse_pubkey(&mixed), Some(hex_str));
    }

    /// `part.len()` is a *byte* count, so a 6-byte syllable holding a multi-byte
    /// char would slice mid-character and panic. Reachable from the AddContact field.
    #[test]
    fn multibyte_input_is_rejected_not_panicked_on() {
        assert_eq!(from_ob("abéxx"), None);
        assert_eq!(try_parse_pubkey("abéxx"), None);
        assert_eq!(try_parse_pubkey("ünïcødé-abéxx"), None);
    }
}
