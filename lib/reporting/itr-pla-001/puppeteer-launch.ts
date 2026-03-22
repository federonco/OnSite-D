/**
 * Puppeteer launch config for ITR PDF.
 * - Vercel/serverless: @sparticuz/chromium
 * - Local Windows: PUPPETEER_EXECUTABLE_PATH or system Chrome
 */

import * as fs from "fs";
import * as path from "path";
import chromium from "@sparticuz/chromium";

const DEFAULT_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-extensions",
  "--disable-background-networking",
  "--no-zygote",
];

/** Common Chrome paths on Windows (local dev) */
const WINDOWS_CHROME_PATHS = [
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean) as string[];

function findLocalChrome(): string | undefined {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;
  for (const p of WINDOWS_CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

export async function getPuppeteerLaunchConfig(): Promise<{
  executablePath: string;
  args: string[];
}> {
  const useChromium = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_VERSION;
  if (useChromium) {
    chromium.setGraphicsMode = false;
    return {
      executablePath: await chromium.executablePath(),
      args: chromium.args,
    };
  }
  const localChrome = findLocalChrome();
  if (localChrome) {
    return { executablePath: localChrome, args: DEFAULT_ARGS };
  }
  throw new Error(
    "Chrome not found. Set PUPPETEER_EXECUTABLE_PATH to your Chrome path, or install Chrome. On Vercel this uses @sparticuz/chromium."
  );
}
