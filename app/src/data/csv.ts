// Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF, UTF-8 BOM) for the data files in app/data.
export function parseCsv(text: string): Record<string, string>[] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text // strip UTF-8 BOM
  const records: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (inQuotes) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((cell) => cell !== '')) records.push(row)
      row = []
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    if (row.some((cell) => cell !== '')) records.push(row)
  }

  const [header, ...body] = records
  if (!header) return []
  return body.map((cells) =>
    Object.fromEntries(header.map((name, idx) => [name, cells[idx] ?? ''])),
  )
}
