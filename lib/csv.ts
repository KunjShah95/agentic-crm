export function parseUnitsCsv(csv: string) {
  const [headerLine, ...rows] = csv.trim().split("\n")
  const headers = headerLine.split(",").map((h) => h.trim())
  return rows.filter(Boolean).map((line) => {
    const vals = line.split(",").map((v) => v.trim())
    const rec: Record<string, string> = {}
    headers.forEach((h, i) => (rec[h] = vals[i] ?? ""))
    return rec
  })
}
