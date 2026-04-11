"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/toast";
import { buildEnterUrlFromQrToken } from "@/lib/site-url";

export type SectionQrListItem = {
  id: string;
  name: string;
  qr_token?: string | null;
  qr_token_issued_at?: string | null;
};

type Props = {
  section: SectionQrListItem;
  getAccessToken: () => Promise<string | null>;
  /** Same default as Send ITR (report default / admin email). */
  defaultReportEmail?: string;
  onQrUpdated?: () => void;
};

function sanitizeFilename(name: string) {
  const s = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .trim()
    .replace(/\s+/g, "_");
  return s || "section";
}

export function SectionQrRow({
  section,
  getAccessToken,
  defaultReportEmail = "",
  onQrUpdated,
}: Props) {
  const { pushToast } = useToast();
  const [sendOpen, setSendOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [url, setUrl] = useState<string | null>(() =>
    section.qr_token ? buildEnterUrlFromQrToken(section.qr_token) : null
  );
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (section.qr_token) {
      setUrl(buildEnterUrlFromQrToken(section.qr_token));
    } else {
      setUrl(null);
      setDataUrl(null);
    }
  }, [section.qr_token, section.id]);

  useEffect(() => {
    if (!url) {
      setDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then((u) => {
        if (!cancelled) setDataUrl(u);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const openSendDialog = () => {
    setSendEmail((defaultReportEmail || "").trim());
    setSendOpen(true);
  };

  const handleSendQrEmail = async () => {
    if (!sendEmail.trim()) return;
    setSending(true);
    try {
      const auth = await getAccessToken();
      if (!auth) throw new Error("Sign in required");

      const qrRes = await fetch(`/api/drainer/sections/${section.id}/qr`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth}` },
      });
      const qrJson = (await qrRes.json()) as {
        error?: string;
        qr_token?: string;
        url?: string;
      };
      if (!qrRes.ok) throw new Error(qrJson.error ?? "Could not prepare QR");

      const sendRes = await fetch("/api/drainer/sections/send-qr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth}`,
        },
        body: JSON.stringify({
          sectionId: section.id,
          email: sendEmail.trim(),
          token: qrJson.qr_token,
          url: qrJson.url,
        }),
      });
      const sendJson = (await sendRes.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!sendRes.ok) throw new Error(sendJson.error ?? "Send failed");

      pushToast({
        type: "success",
        title: "QR sent",
        message: sendJson.message ?? `Email sent to ${sendEmail.trim()}`,
      });
      setSendOpen(false);
      onQrUpdated?.();
    } catch (e) {
      pushToast({
        type: "error",
        title: "Send failed",
        message: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setSending(false);
    }
  };

  const downloadPng = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${sanitizeFilename(section.name)}-qr.png`;
    a.rel = "noopener";
    a.click();
  };

  return (
    <>
      <div className="rounded-xl border border-[var(--border)] bg-white p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm font-medium text-[var(--ink)] truncate min-w-0">
            {section.name}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9 shrink-0"
            onClick={openSendDialog}
          >
            Send QR
          </Button>
        </div>
        {url && (
          <div className="space-y-2 pt-1 border-t border-[var(--border)]">
            {dataUrl ? (
              <img
                src={dataUrl}
                alt=""
                width={220}
                height={220}
                className="mx-auto rounded-lg border border-[var(--border)] bg-white"
              />
            ) : (
              <p className="text-xs text-[var(--muted-foreground)] text-center py-2">
                Rendering QR…
              </p>
            )}
            <p className="text-[11px] break-all text-[var(--muted-foreground)] font-mono">
              {url}
            </p>
            {dataUrl && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full min-h-9"
                onClick={downloadPng}
              >
                Download QR
              </Button>
            )}
          </div>
        )}
      </div>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send QR Code — {section.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="email"
              placeholder="Email address"
              value={sendEmail}
              onChange={(e) => setSendEmail(e.target.value)}
              className="drainer-input"
              autoComplete="email"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSendOpen(false)}
              className="bg-[#EEE4DA] border-[var(--card-border)] hover:bg-[#E8D2BF]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSendQrEmail}
              disabled={!sendEmail.trim() || sending}
              className="bg-[#B8682A] text-white border-0 hover:bg-[#A35D26]"
            >
              {sending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 mr-1" />
                  Sending…
                </>
              ) : (
                "Send"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
