/**
 * percent-decode.mjs — display-only decoding of URL-encoded text.
 *
 * Foundry keeps paths URL-encoded ("ANIMA%C3%87%C3%95ES/Mana%20Crystal
 * %5B2%5D.webm"). These helpers turn that into readable text
 * ("ANIMAÇÕES/Mana Crystal [2].webm") for DISPLAY ONLY. Callers must never
 * write the result back into data.
 *
 * Safety rules:
 *   - Only runs of valid "%XX" are touched; a lone "%" or "100%" stays as is.
 *   - A run that is not valid UTF-8 is not thrown on: only its plain ASCII
 *     bytes are decoded, the rest stays encoded.
 *   - Control characters (%00-%1F, %7F) always stay encoded, so a decoded
 *     name can never contain a line break or invisible character.
 *   - Single pass: "%2541" becomes "%41", never "A".
 */

const ENCODED_RUN = /(?:%[0-9A-Fa-f]{2})+/g;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function decodeRun(run) {
  let decoded;
  try {
    decoded = decodeURIComponent(run);
  } catch {
    // Invalid UTF-8 somewhere in the run: keep non-ASCII bytes encoded.
    return run.replace(/%([2-7][0-9A-Fa-f])/g, (match, hex) => {
      const code = parseInt(hex, 16);
      return code === 0x7f ? match : String.fromCharCode(code);
    });
  }
  return CONTROL_CHARS.test(decoded) ? run : decoded;
}

/** Readable version of `text` (returns non-strings unchanged). */
export function decodeForDisplay(text) {
  if (typeof text !== "string" || !text.includes("%")) return text;
  return text.replace(ENCODED_RUN, decodeRun);
}

/** True if decodeForDisplay would change `text`. */
export function hasDecodableText(text) {
  return typeof text === "string" && text.includes("%") && decodeForDisplay(text) !== text;
}
