//! Urbit-style `@p` syllable encoding for public keys (port of Phonemic.fs).
//!
//! Each byte pair `[hi, lo]` encodes as `prefixes[hi] ++ suffixes[lo]` (6 chars);
//! pairs are joined with `-`. A 32-byte key -> 16 six-char syllables.

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

fn prefix_index(s: &str) -> Option<u8> {
    PREFIXES.iter().position(|p| *p == s).map(|i| i as u8)
}

fn suffix_index(s: &str) -> Option<u8> {
    SUFFIXES.iter().position(|p| *p == s).map(|i| i as u8)
}

/// Encode bytes as a hyphen-joined `@p` string.
pub fn to_ob(bytes: &[u8]) -> String {
    bytes
        .chunks(2)
        .map(|pair| {
            let hi = pair[0] as usize;
            // An odd trailing byte (never happens for 32-byte keys) reuses suffix 0.
            let lo = pair.get(1).copied().unwrap_or(0) as usize;
            format!("{}{}", PREFIXES[hi], SUFFIXES[lo])
        })
        .collect::<Vec<_>>()
        .join("-")
}

/// Decode a `@p` string back to bytes. Returns `None` if any syllable is invalid.
pub fn from_ob(s: &str) -> Option<Vec<u8>> {
    let parts: Vec<&str> = s.split('-').filter(|p| !p.is_empty()).collect();
    if parts.is_empty() {
        return None;
    }
    let mut out = Vec::with_capacity(parts.len() * 2);
    for part in parts {
        if part.len() != 6 {
            return None;
        }
        let hi = prefix_index(&part[0..3])?;
        let lo = suffix_index(&part[3..6])?;
        out.push(hi);
        out.push(lo);
    }
    Some(out)
}

/// Parse a contact identifier given as either a `@p` string or 64-char hex.
/// Returns the lowercase hex of a valid 32-byte Ed25519 public key.
pub fn try_parse_pubkey(input: &str) -> Option<String> {
    let trimmed = input.trim();
    // Try @p first (contains hyphens or non-hex syllables), then hex.
    if let Some(bytes) = from_ob(trimmed) {
        if bytes.len() == 32 {
            return Some(hex::encode(bytes));
        }
    }
    if let Ok(bytes) = hex::decode(trimmed.to_lowercase()) {
        if bytes.len() == 32 {
            return Some(hex::encode(bytes));
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tables_are_full_and_distinct() {
        assert_eq!(PREFIXES.len(), 256);
        assert_eq!(SUFFIXES.len(), 256);
        assert_eq!(PREFIXES[0], "doz");
        assert_eq!(SUFFIXES[0], "zod");
    }

    #[test]
    fn round_trip_32_bytes() {
        let key: Vec<u8> = (0u8..32).collect();
        let ob = to_ob(&key);
        assert_eq!(ob.split('-').count(), 16, "16 syllables for 32 bytes");
        assert_eq!(from_ob(&ob), Some(key));
    }

    #[test]
    fn zero_key_is_dozzod_repeated() {
        let ob = to_ob(&[0u8; 32]);
        assert!(ob.starts_with("dozzod-dozzod"));
    }

    #[test]
    fn try_parse_accepts_hex_and_ob() {
        let key = [0xabu8; 32];
        let hex_str = hex::encode(key);
        let ob = to_ob(&key);
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
}
