/// The shared CP1252 smart-punctuation mapping. Reading normalizes these
/// bytes silently, and the normalization is written back to disk on save —
/// it is a recovery feature for broken legacy files, not a lossless decode.
/// Lives in models because both io and parsers depend on this mapping.
pub(crate) fn known_cp1252_char(byte: u8) -> Option<char> {
    match byte {
        0x91 | 0x92 => Some('\''),
        0x93 | 0x94 => Some('"'),
        0x96 => Some('-'),
        _ => None,
    }
}
