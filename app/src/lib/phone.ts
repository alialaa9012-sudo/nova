const ARABIC_DIGITS = /[٠-٩۰-۹]/g

/** Converts Arabic-Indic and Persian digits to ASCII digits. */
export function toAsciiDigits(input: string): string {
  return input.replace(ARABIC_DIGITS, (d) => {
    const code = d.charCodeAt(0)
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660)
  })
}

/** Returns an Egyptian mobile number as 01XXXXXXXXX, or null when it is not one. */
export function normalizeEgyptianMobile(input: string): string | null {
  let s = toAsciiDigits(input).replace(/[\s\-().]/g, '')
  if (s.startsWith('+20')) s = `0${s.slice(3)}`
  else if (s.startsWith('0020')) s = `0${s.slice(4)}`
  else if (s.startsWith('20') && s.length === 12) s = `0${s.slice(2)}`
  return /^01[0125]\d{8}$/.test(s) ? s : null
}
