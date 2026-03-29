import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 9,
  },
  header: {
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
  },
  meta: {
    fontSize: 8,
    marginTop: 4,
    color: "#555",
  },
  table: {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#333",
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#4472C4",
  },
  headerCell: {
    padding: 6,
    fontSize: 8,
    fontWeight: "bold",
    color: "white",
    borderRightWidth: 0.5,
    borderRightColor: "rgba(255,255,255,0.5)",
  },
  dataRow: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderTopColor: "#333",
  },
  dataRowAlt: {
    flexDirection: "row",
    backgroundColor: "#f2f2f2",
    borderTopWidth: 0.5,
    borderTopColor: "#333",
  },
  cell: {
    padding: 4,
    fontSize: 8,
    borderRightWidth: 0.5,
    borderRightColor: "#333",
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 24,
    right: 24,
    fontSize: 7,
    color: "#666",
  },
});

type CheckpointHistoryRow = {
  id: string;
  name: string;
  chainage: number;
  type: string;
  alert_email: string | null;
  last_notified: string;
  expired_at: string;
};

type SectionInfo = {
  name: string;
  project: { name: string | null; number: string | null } | null;
};

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

function formatCh(n: number): string {
  return n.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const COL_WIDTHS = [120, 50, 60, 100, 100, 100];

export async function generateCheckpointRecordPdf(
  section: SectionInfo,
  records: CheckpointHistoryRow[],
  datePrinted: string
) {
  const sorted = [...records].sort(
    (a, b) => Number(b.chainage) - Number(a.chainage)
  );

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>
            Checkpoint Record — {section.name}
          </Text>
          <Text style={styles.meta}>
            Date printed: {formatDate(datePrinted)} | Project:{" "}
            {section.project?.name ?? "—"}{" "}
            {section.project?.number ? `(${section.project.number})` : ""}
          </Text>
        </View>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            <Text style={[styles.headerCell, { width: COL_WIDTHS[0] }]}>
              Checkpoint Name
            </Text>
            <Text style={[styles.headerCell, { width: COL_WIDTHS[1] }]}>CH</Text>
            <Text style={[styles.headerCell, { width: COL_WIDTHS[2] }]}>Type</Text>
            <Text style={[styles.headerCell, { width: COL_WIDTHS[3] }]}>
              Notified At
            </Text>
            <Text style={[styles.headerCell, { width: COL_WIDTHS[4] }]}>
              Alert Recipient
            </Text>
            <Text
              style={[
                styles.headerCell,
                { width: COL_WIDTHS[5], borderRightWidth: 0 },
              ]}
            >
              Archived At
            </Text>
          </View>
          {sorted.length === 0 ? (
            <View style={styles.dataRow}>
              <Text
                style={[
                  styles.cell,
                  {
                    width: "100%",
                    padding: 12,
                    textAlign: "center",
                    color: "#666",
                  },
                ]}
              >
                No checkpoint history
              </Text>
            </View>
          ) : (
            sorted.map((r, idx) => (
              <View
                key={r.id}
                style={idx % 2 === 0 ? styles.dataRow : styles.dataRowAlt}
              >
                <Text style={[styles.cell, { width: COL_WIDTHS[0] }]}>
                  {r.name}
                </Text>
                <Text style={[styles.cell, { width: COL_WIDTHS[1] }]}>
                  {formatCh(Number(r.chainage))}
                </Text>
                <Text style={[styles.cell, { width: COL_WIDTHS[2] }]}>
                  {r.type}
                </Text>
                <Text style={[styles.cell, { width: COL_WIDTHS[3] }]}>
                  {formatDate(r.last_notified)}
                </Text>
                <Text style={[styles.cell, { width: COL_WIDTHS[4] }]}>
                  {r.alert_email ?? "—"}
                </Text>
                <Text
                  style={[
                    styles.cell,
                    { width: COL_WIDTHS[5], borderRightWidth: 0 },
                  ]}
                >
                  {formatDate(r.expired_at)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text>
            Generated by OnSite Drainer — {formatDate(datePrinted)}
          </Text>
        </View>
      </Page>
    </Document>
  );

  const buffer = (await renderToBuffer(doc)) as Buffer;
  const safeName = (section.name ?? "checkpoints").replace(/\s+/g, "-");
  return {
    buffer,
    contentType: "application/pdf",
    fileName: `checkpoint-record_${safeName}_${Date.now()}.pdf`,
  };
}
