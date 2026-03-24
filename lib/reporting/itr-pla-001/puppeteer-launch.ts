/**
 * Puppeteer launch config for ITR PDF.
 * - Vercel/serverless: @sparticuz/chromium (serverless-compatible, no libnss3)
 * - Local Windows: PUPPETEER_EXECUTABLE_PATH or system Chrome
 */

import * as fs from "fs";
import * as path from "path";
import chromium from "@sparticuz/chromium";
import puppeteer, { Browser } from "puppeteer-core";

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
  defaultViewport?: { width: number; height: number; deviceScaleFactor?: number };
  headless?: boolean | "shell";
}> {
  const useChromium = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_VERSION;
  if (useChromium) {
    chromium.setGraphicsMode = false;
    return {
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      headless: chromium.headless,
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

/** Launch browser for PDF generation. Uses @sparticuz/chromium on Vercel (no libnss3). */
export async function launchBrowser(): Promise<Browser> {
  const config = await getPuppeteerLaunchConfig();
  return puppeteer.launch({
    args: config.args,
    defaultViewport: config.defaultViewport,
    executablePath: config.executablePath,
    headless: config.headless ?? true,
  });
}
