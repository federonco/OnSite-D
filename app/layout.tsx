import type { Metadata, Viewport } from "next";

export const dynamic = "force-dynamic";
import { DM_Mono, Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const displayFont = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const bodyFont = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const codeFont = DM_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Pipe Laying Tracker",
  description: "Pipe laying inspection and ITR reporting",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${displayFont.variable} ${bodyFont.variable} ${codeFont.variable} antialiased`}
      >
        <Providers>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            <footer className="px-6 pb-6 pt-2 text-center text-xs text-[var(--muted-foreground)]">
              <div className="space-y-1">
                <div>
                  OnSite-D- Alkimos Pileline Alliance
                </div>
                <div>
                  Created by{" "}
                  <a
                    href="https://www.readx.com.au"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 align-middle -translate-y-[2px]"
                  >
                    <img
                      src="/readx-logo.png"
                      alt="readX"
                      className="h-[10px]"
                    />
                  </a>
                </div>
                <div>All Rights Reserved.</div>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
