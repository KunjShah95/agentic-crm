/**
 * E-sign adapter stub (Leegality / Digio). Sends a rendered document for
 * signature when provider creds are configured; otherwise returns a mock
 * request so the booking flow works end-to-end in dev without a BSP account.
 */

export type ESignResult = { id: string; mock: boolean; status: "PENDING" | "SIGNED" }

export async function requestSignature(input: { docId: string; html: string; signerName?: string; signerPhone?: string }): Promise<ESignResult> {
  const key = process.env.LEEGALITY_API_KEY ?? process.env.DIGIO_API_KEY
  if (!key) {
    return { id: `mock-esign-${input.docId}`, mock: true, status: "PENDING" }
  }

  const provider = process.env.LEEGALITY_API_KEY ? "leegality" : "digio"
  const url =
    provider === "leegality"
      ? "https://api.leegality.com/v3.0/sign/request"
      : "https://api.digio.in/v2/client/document/upload"
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ file: input.html, signers: [{ name: input.signerName, phone: input.signerPhone }] }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(`E-sign request failed: ${res.status} ${errText}`)
  }
  const data = (await res.json()) as { id?: string; requestId?: string }
  return { id: data.id ?? data.requestId ?? "", mock: false, status: "PENDING" }
}
