/// Production-source view of a Rust file, shared by every architecture check
/// that must ignore test code: comments and strings are stripped first so the
/// `#[cfg(test)]` block boundary is brace-balanced over real code only — a
/// `{` inside a comment or string can no longer shift the cut.
export function productionRustSource(text) {
  return stripRustTestBlocks(stripRustCommentsAndStrings(text));
}

export function stripRustCommentsAndStrings(text) {
  // Deterministic lexer-lite. Regex alternation cannot lex Rust reliably: a
  // `"` inside a char literal, or a `'` lifetime, makes string/delimiter
  // pairing desync across hundreds of lines. States are walked explicitly.
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '/' && next === '*') {
      let depth = 1;
      let j = i + 2;
      while (j < text.length && depth > 0) {
        if (text[j] === '/' && text[j + 1] === '*') {
          depth += 1;
          j += 2;
        } else if (text[j] === '*' && text[j + 1] === '/') {
          depth -= 1;
          j += 2;
        } else {
          j += 1;
        }
      }
      out += ' ';
      i = j;
      continue;
    }
    if (ch === '/' && next === '/') {
      const end = text.indexOf('\n', i);
      i = end === -1 ? text.length : end;
      out += ' ';
      continue;
    }
    const rawHashes = matchRawStringHashes(text, i);
    if (rawHashes !== null) {
      i = skipRawString(text, i + 1 + rawHashes, rawHashes);
      out += '""';
      continue;
    }
    if (ch === '"') {
      i = skipQuoted(text, i, '"');
      out += '""';
      continue;
    }
    if (ch === "'") {
      const lifetime = /^[A-Za-z_][A-Za-z0-9_]*(?!')/.exec(text.slice(i + 1, i + 32));
      if (lifetime) {
        out += ch;
        i += 1 + lifetime[0].length;
        continue;
      }
      i = skipQuoted(text, i, "'");
      out += "''";
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/// `r"..."`, `r#"..."#`, `br#"..."#` — returns the hash count at position i.
function matchRawStringHashes(text, i) {
  let j = i;
  if (text[j] === 'b') j += 1;
  if (text[j] !== 'r') return null;
  j += 1;
  let hashes = 0;
  while (text[j] === '#') {
    hashes += 1;
    j += 1;
  }
  return text[j] === '"' ? hashes : null;
}

function skipRawString(text, bodyStart, hashes) {
  const terminator = '"' + '#'.repeat(hashes);
  const end = text.indexOf(terminator, bodyStart);
  return end === -1 ? text.length : end + terminator.length;
}

function skipQuoted(text, openIndex, quote) {
  let j = openIndex + 1;
  while (j < text.length) {
    if (text[j] === '\\') {
      j += 2;
      continue;
    }
    if (text[j] === quote) {
      return j + 1;
    }
    j += 1;
  }
  return text.length;
}

export function stripRustTestBlocks(text) {
  let output = text;
  const marker = '#[cfg(test)]';
  let index = output.indexOf(marker);
  while (index !== -1) {
    const blockStart = output.indexOf('{', index);
    if (blockStart === -1) break;
    let depth = 0;
    let end = blockStart;
    for (; end < output.length; end += 1) {
      const char = output[end];
      if (char === '{') depth += 1;
      if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          end += 1;
          break;
        }
      }
    }
    output = `${output.slice(0, index)}${output.slice(end)}`;
    index = output.indexOf(marker);
  }
  return output;
}
