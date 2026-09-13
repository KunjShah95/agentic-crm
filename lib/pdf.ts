/**
 * HTML → PDF renderer. One headless-Chromium path that works both locally and
 * on Vercel Fluid Compute:
 *
 *   - Production / Vercel: @sparticuz/chromium ships a Lambda-compatible
 *     Chromium binary; puppeteer-core drives it.
 *   - Local dev: point PUPPETEER_EXECUTABLE_PATH at an installed Chrome/Edge,
 *     or rely on the common-location auto-detect below.
 *
 * Server-only. Do not import from client components.
 */

import { existsSync } from "node:fs"

// Lazy-required so client bundles never pull in the browser packages.
type Browser = import("puppeteer-core").Browser

const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME

/** Common local Chrome/Edge install locations across OSes. */
const LOCAL_CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  // Windows
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  // macOS
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  // Linux
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean) as string[]

function localExecutablePath(): string {
  const found = LOCAL_CHROME_CANDIDATES.find((p) => existsSync(p))
  if (!found) {
    throw new Error(
      "No local Chrome/Edge found for PDF rendering. Install Chrome or set PUPPETEER_EXECUTABLE_PATH in .env.",
    )
  }
  return found
}

async function launch(): Promise<Browser> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const puppeteer = require("puppeteer-core") as typeof import("puppeteer-core")

  if (isServerless) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@sparticuz/chromium") as {
      default?: { args: string[]; executablePath: () => Promise<string> }
      args?: string[]
      executablePath?: () => Promise<string>
    }
    const chromium = mod.default ?? (mod as { args: string[]; executablePath: () => Promise<string> })
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }

  return puppeteer.launch({
    executablePath: localExecutablePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })
}

/**
 * Render a full HTML document to an A4 PDF buffer. `printBackground` keeps CSS
 * colors/borders; margins give a document-style page.
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await launch()
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "load" })
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
