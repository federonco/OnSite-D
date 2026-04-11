"use client";

import { useState } from "react";
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

  return (
    <>
      <div className="rounded-xl border border-[var(--border)] bg-white p-3">
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
