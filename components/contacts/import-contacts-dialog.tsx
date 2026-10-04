"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  CheckCircle2,
  FileText,
  ArrowLeft,
  ArrowRight,
  Upload,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

type ImportStep = "upload" | "map" | "preview" | "done"

type MappedField = {
  csvColumn: string | null
  crmField: string
  required: boolean
  label: string
}

const CRM_FIELDS: Omit<MappedField, "csvColumn">[] = [
  { crmField: "firstName", required: true, label: "First name" },
  { crmField: "lastName", required: false, label: "Last name" },
  { crmField: "email", required: false, label: "Email" },
  { crmField: "phone", required: false, label: "Phone" },
  { crmField: "jobTitle", required: false, label: "Job title" },
  { crmField: "linkedinUrl", required: false, label: "LinkedIn URL" },
]

/**
 * The two fields that make an imported contact usable.
 *
 * Separate from `CRM_FIELDS.required` because "required to save a row" and
 * "required for the row to be worth anything" are different questions, and the
 * second one is the one that has no enforcement anywhere else — see the
 * `reachWarning` comment below.
 */
const REACH_FIELDS = ["phone", "email"] as const

const REACH_FIELDS_LABELS: Record<(typeof REACH_FIELDS)[number], string> = {
  phone: "phone number",
  email: "email address",
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split("\n")
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""))
  const rows = lines.slice(1).map((line) =>
    line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""))
  )
  return { headers, rows }
}

function autoMap(headers: string[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {}
  for (const field of CRM_FIELDS) {
    const match = headers.find((h) => {
      const lower = h.toLowerCase()
      return (
        lower === field.crmField.toLowerCase() ||
        lower === field.label.toLowerCase() ||
        (field.crmField === "firstName" && (lower === "name" || lower === "first")) ||
        (field.crmField === "lastName" && lower === "last") ||
        (field.crmField === "phone" && (lower === "mobile" || lower === "telephone" || lower === "cell"))
      )
    })
    mapping[field.crmField] = match ?? null
  }
  return mapping
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  onImported?: () => void
}

export function ImportContactsDialog({ open, onOpenChange, workspaceId, onImported }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<ImportStep>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null)
  const [fieldMap, setFieldMap] = useState<Record<string, string | null>>({})
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{
    imported: number
    skipped: number
    failedBatches: number
    batchSize: number
    errors: string[]
  } | null>(null)

  const reset = () => {
    setStep("upload")
    setFile(null)
    setCsvData(null)
    setFieldMap({})
    setImporting(false)
    setProgress(0)
    setResult(null)
  }

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file")
      return
    }
    setFile(f)
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      const data = parseCsv(text)
      if (data.rows.length === 0) {
        toast.error("CSV file is empty or has no data rows")
        return
      }
      setCsvData(data)
      setFieldMap(autoMap(data.headers))
      setStep("map")
    }
    reader.readAsText(f)
  }, [])

  const mappedCount = Object.values(fieldMap).filter(Boolean).length
  const requiredMapped = CRM_FIELDS.filter((f) => f.required).every((f) => fieldMap[f.crmField])

  /**
   * Whether the import will produce contacts the team can actually act on.
   *
   * `phone` and `email` are the only two routes out of the CRM — a contact with
   * neither cannot be called, emailed, or matched by the deduplication in
   * `lead-ingest`, which keys on `phoneLookupKey`. Importing without them is
   * allowed, because a name-only contact is still a real record, but it used to
   * happen with no signal at all: `requiredMapped` only gates on `firstName`, so
   * every other dropdown could read "— Skip —" and the button would still say
   * "Import 400 contacts". The user got 400 unreachable rows and a success toast.
   *
   * So this is stated plainly rather than left for the user to infer from a
   * disabled button. It names the consequence, and it does not block the import —
   * the choice belongs to whoever is doing it.
   */
  const missingReach = REACH_FIELDS.filter((k) => !fieldMap[k])
  const reachWarning =
    missingReach.length === REACH_FIELDS.length
      ? `No phone or email column is mapped, so every contact you import will have neither. You will not be able to call or email anyone from this list, and the duplicate check cannot tell they already exist.`
      : missingReach.length === 1
        ? `No ${REACH_FIELDS_LABELS[missingReach[0]]} column is mapped, so those contacts will have no ${REACH_FIELDS_LABELS[missingReach[0]]}.`
        : null

  const onImport = async () => {
    if (!csvData || !requiredMapped) return
    setImporting(true)
    setStep("preview")
    setProgress(0)

    try {
      const total = csvData.rows.length
      const importedRows: Record<string, string>[] = []
      const errors: string[] = []
      /* Rows the CSV itself ruled out (no first name). Kept apart from
         `failedBatches` below, which means rows that were valid but did not
         reach the database — a different problem with a different remedy. */
      let rowSkips = 0
      let failedBatches = 0

      for (let i = 0; i < total; i++) {
        const row = csvData.rows[i]
        const record: Record<string, string> = {}
        for (const field of CRM_FIELDS) {
          const csvCol = fieldMap[field.crmField]
          if (csvCol) {
            const colIdx = csvData.headers.indexOf(csvCol)
            if (colIdx >= 0 && row[colIdx]) {
              record[field.crmField] = row[colIdx]
            }
          }
        }
        if (!record.firstName) {
          rowSkips++
          errors.push(`Row ${i + 2}: missing first name`)
          continue
        }
        importedRows.push(record)
        setProgress(Math.round(((i + 1) / total) * 80))
      }

      // Batch create via server action
      const batchSize = 50
      let created = 0
      for (let i = 0; i < importedRows.length; i += batchSize) {
        const batch = importedRows.slice(i, i + batchSize)
        const response = await fetch(`/api/contacts/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, contacts: batch }),
        })
        if (response.ok) {
          const data = await response.json()
          created += data.created ?? batch.length
        } else {
          /* Counted separately from the row-level skips above. Both were pushed
             into one `errors` array and then reported as `skipped`, so a batch of
             50 that failed to save was announced as "1 row skipped due to errors"
             — and `created` had already been incremented for the successful
             batches, leaving a summary that read as a clean import while up to
             `batchSize * failedBatches` rows were never written. */
          failedBatches++
          errors.push(
            `Batch ${Math.floor(i / batchSize) + 1} — ${batch.length} contacts could not be saved`,
          )
        }
        setProgress(80 + Math.round((i / importedRows.length) * 20))
      }

      setProgress(100)
      setResult({ imported: created, skipped: rowSkips, failedBatches, batchSize, errors })
      setStep("done")
      /* Not a success toast when a batch failed to save. The import genuinely
         did not complete in that case, and a green "Imported 380 contacts" is how
         someone walks away believing their list is in the CRM. */
      if (failedBatches) {
        toast.error(
          `Imported ${created} contacts, but ${failedBatches * batchSize} were not saved. Check the summary.`,
        )
      } else {
        toast.success(`Imported ${created} contacts`)
      }
      router.refresh()
      onImported?.()
    } catch (err) {
      console.error("Import failed:", err)
      toast.error("Import failed. Please try again.")
      setStep("map")
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setTimeout(reset, 300)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import contacts from CSV</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV file with your contacts. We'll help you map columns."}
            {step === "map" && "Match your CSV columns to contact fields."}
            {step === "preview" && "Importing your contacts..."}
            {step === "done" && "Your contacts have been imported."}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {(["upload", "map", "preview", "done"] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border text-[10px] font-medium",
                  step === s && "border-primary bg-primary text-primary-foreground",
                  ["upload", "map", "preview", "done"].indexOf(step) > i &&
                    "border-status-positive-fg bg-status-positive-bg text-status-positive-fg"
                )}
              >
                {["upload", "map", "preview", "done"].indexOf(step) > i ? (
                  <CheckCircle2 className="size-3" />
                ) : (
                  i + 1
                )}
              </span>
              <span className={cn(step === s && "font-medium text-foreground")}>
                {s === "upload" ? "Upload" : s === "map" ? "Map" : s === "preview" ? "Import" : "Done"}
              </span>
              {i < 3 && <span className="text-border">/</span>}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="min-h-48">
          {step === "upload" && (
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed bg-muted/20 p-8 text-center"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (f && fileRef.current) {
                  const dt = new DataTransfer()
                  dt.items.add(f)
                  fileRef.current.files = dt.files
                  fileRef.current.dispatchEvent(new Event("change", { bubbles: true }))
                }
              }}
            >
              <div className="flex size-12 items-center justify-center rounded-md bg-primary/10">
                <Upload className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Click to upload or drag and drop</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Supports .csv files with headers in the first row
                </p>
              </div>
            </div>
          )}

          {step === "map" && csvData && (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {/* Which file, and how much of it is understood. `file` and
                  `mappedCount` were both tracked but never rendered, so the
                  mapping step gave no confirmation of *which* spreadsheet was
                  loaded and no indication of how many fields were actually being
                  carried across — every optional dropdown could read "— Skip —"
                  and the row count in the button was the only feedback. */}
              <div className="flex items-start justify-between gap-3 rounded-md border bg-muted/20 p-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{file?.name ?? "Uploaded file"}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {csvData.rows.length.toLocaleString("en-IN")} rows ·{" "}
                      {csvData.headers.length} columns
                    </p>
                  </div>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {mappedCount}/{CRM_FIELDS.length} mapped
                </p>
              </div>

              {reachWarning && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-md border border-status-caution-fg/30 bg-status-caution-bg p-2.5"
                >
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-status-caution-fg"
                    aria-hidden
                  />
                  <p className="text-xs leading-relaxed text-status-caution-fg">{reachWarning}</p>
                </div>
              )}
              {CRM_FIELDS.map((field) => (
                <div key={field.crmField} className="flex items-center gap-3">
                  <label className="w-28 text-sm font-medium shrink-0">
                    {field.label}
                    {field.required && <span className="text-destructive ml-0.5">*</span>}
                  </label>
                  <select
                    value={fieldMap[field.crmField] ?? ""}
                    onChange={(e) =>
                      setFieldMap((prev) => ({
                        ...prev,
                        [field.crmField]: e.target.value || null,
                      }))
                    }
                    className="flex-1 rounded-sm border bg-background px-3 py-1.5 text-sm"
                  >
                    <option value="">— Skip —</option>
                    {csvData.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {step === "preview" && (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <Progress value={progress} className="w-full max-w-sm" />
              <p className="text-sm text-muted-foreground">
                {progress < 100 ? "Importing contacts..." : "Finalizing..."}
              </p>
            </div>
          )}

          {step === "done" && result && (
            <div className="space-y-4 py-4">
              <div
                className={cn(
                  "flex items-center gap-3 rounded-md border p-3",
                  result.failedBatches
                    ? "border-status-caution-fg/30 bg-status-caution-bg"
                    : "bg-status-positive-bg",
                )}
              >
                {result.failedBatches ? (
                  <AlertTriangle className="size-5 shrink-0 text-status-caution-fg" aria-hidden />
                ) : (
                  <CheckCircle2 className="size-5 shrink-0 text-status-positive-fg" aria-hidden />
                )}
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      result.failedBatches && "text-status-caution-fg",
                    )}
                  >
                    {result.imported} contacts imported
                  </p>
                  {/* The two failure kinds are reported separately because they
                      need different responses: a bad row is fixed in the
                      spreadsheet, a failed batch is not in the CRM at all and has
                      to be retried. */}
                  {result.failedBatches > 0 && (
                    <p className="text-xs leading-relaxed text-status-caution-fg">
                      {result.failedBatches * result.batchSize} contacts were not saved — the
                      request to the server failed. Re-run the import; rows already in the
                      CRM are skipped as duplicates.
                    </p>
                  )}
                  {result.skipped > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {result.skipped} {result.skipped === 1 ? "row" : "rows"} skipped — no first
                      name
                    </p>
                  )}
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-md border bg-muted/20 p-3">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{err}</p>
                  ))}
                  {result.errors.length > 10 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      +{result.errors.length - 10} more errors
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          {step === "map" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                <ArrowLeft className="mr-1 size-3" />
                Back
              </Button>
              <Button onClick={onImport} disabled={!requiredMapped || importing}>
                Import {csvData?.rows.length} contacts
                <ArrowRight className="ml-1 size-3" />
              </Button>
            </>
          )}
          {step === "preview" && (
            <Button variant="outline" disabled>
              Importing...
            </Button>
          )}
          {step === "done" && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>

        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={onFileChange}
        />
      </DialogContent>
    </Dialog>
  )
}
