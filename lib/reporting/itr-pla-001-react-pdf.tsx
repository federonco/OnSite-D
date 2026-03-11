/**
 * ITR-PLA-001 PDF via React-PDF (serverless-safe).
 * Same pipeline as audit report — no Puppeteer/Chromium.
 * Used when Puppeteer fails in serverless (e.g. Vercel).
 */

import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  Image,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  DOC_NO,
  EFFECTIVE_DATE,
  REVISION_NO,
  COLORS,
  COL_WIDTHS_PT,
  CATEGORIES,
  COLUMN_HEADERS,
  ASTERISK_ROW,
  NOTES,
} from "@/lib/reporting/itr-pla-001/config";
import { mapRecordToCells } from "@/lib/reporting/itr-pla-001/mapper";
import type { RecordRow } from "@/lib/reporting/itr-pla-001/mapper";
import type { SectionInfo } from "@/lib/reporting/itr-pla-001/types";

const LOGO_URL =
  "https://raw.githubusercontent.com/federonco/readx-assets/main/Alkimos_logo.png";

const WIDTHS = [...COL_WIDTHS_PT];
const CATEGORY_WIDTHS = [
  WIDTHS.slice(0, 6).reduce((a, b) => a + b, 0),
  WIDTHS.slice(6, 10).reduce((a, b) => a + b, 0),
  WIDTHS.slice(10, 12).reduce((a, b) => a + b, 0),
  WIDTHS.slice(12, 14).reduce((a, b) => a + b, 0),
];

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 7 },
  header: {
    flexDirection: "row",
    borderWidth: 0.5,
    marginBottom: 4,
  },
  headerLeft: {
    width: 150,
    borderRightWidth: 0.5,
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    padding: 2,
    fontSize: 7,
  },
  headerLabel: { width: 70, paddingRight: 4 },
  headerValue: { flex: 1 },
  headerRight: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
  },
  headerTitle: { flex: 1 },
  headerTitleMain: { fontSize: 8, fontWeight: "bold" },
  headerTitleSub: { fontSize: 7, marginTop: 2 },
  logo: { width: 60, height: 18, objectFit: "contain" },
  projSection: { borderWidth: 0.5, marginBottom: 4 },
  projHeader: {
    padding: 4,
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "center",
    borderBottomWidth: 0.5,
  },
  projRow: { flexDirection: "row" },
  projCell: {
    flex: 1,
    padding: 4,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    fontSize: 7,
  },
  tableWrap: { borderWidth: 0.5, marginBottom: 8 },
  tableHeader: {
    padding: 4,
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "center",
    borderBottomWidth: 0.5,
  },
  tableRow: { flexDirection: "row" },
  categoryCell: {
    padding: 2,
    fontSize: 6,
    fontWeight: "bold",
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
  },
  colHeaderCell: {
    padding: 2,
    fontSize: 5,
    fontWeight: "bold",
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    textAlign: "center",
  },
  asteriskCell: {
    padding: 2,
    fontSize: 5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
  },
  dataCell: {
    padding: 2,
    fontSize: 6,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
  },
  notes: { marginTop: 8, fontSize: 6, lineHeight: 1.2 },
});

export async function generateITRPla001PdfReact(
  section: SectionInfo,
  records: RecordRow[],
  pageNumber: number,
  _totalPages: number,
  options?: { isOpenITR?: boolean }
): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
  console.log("[ITR-PLA-001] React-PDF: start", { sectionName: section?.name, recordsCount: records?.length, pageNumber });
  const pageNoLabel = options?.isOpenITR ? "In Progress" : "1 of 1";
  const dataRows = records.map((r) => mapRecordToCells(r));

  const doc = (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>Doc No:</Text>
              <Text style={styles.headerValue}>{DOC_NO}</Text>
            </View>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>Effective:</Text>
              <Text style={styles.headerValue}>{EFFECTIVE_DATE}</Text>
            </View>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>Revision:</Text>
              <Text style={styles.headerValue}>{REVISION_NO}</Text>
            </View>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>Page No:</Text>
              <Text style={styles.headerValue}>{pageNoLabel}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.headerTitle}>
              <Text style={styles.headerTitleMain}>PIPE LAYING INSPECTION FIELD RECORD</Text>
              <Text style={styles.headerTitleSub}>ITR-PLA-001</Text>
            </View>
            <Image src={LOGO_URL} style={styles.logo} />
          </View>
        </View>

        <View style={styles.projSection}>
          <Text style={styles.projHeader}>PROJECT INFORMATION</Text>
          <View style={styles.projRow}>
            <Text style={styles.projCell}>PROJECT: {section.project_name ?? "—"}</Text>
            <Text style={styles.projCell}>NUMBER: {section.project_number ?? "—"}</Text>
          </View>
          <View style={styles.projRow}>
            <Text style={styles.projCell}>SECTION: {section.name}</Text>
            <Text style={styles.projCell}>ITP: {section.itp_number ?? "—"}</Text>
          </View>
        </View>

        <View style={styles.tableWrap}>
          <Text style={styles.tableHeader}>PIPE RECORDS</Text>
          {/* Category row */}
          <View style={[styles.tableRow, { backgroundColor: COLORS.BLUE }]}>
            {CATEGORIES.map((c, i) => (
              <Text
                key={i}
                style={[
                  styles.categoryCell,
                  { width: CATEGORY_WIDTHS[i], color: COLORS.WHITE },
                ]}
              >
                {c.label}
              </Text>
            ))}
          </View>
          {/* Column headers */}
          <View style={[styles.tableRow, { backgroundColor: COLORS.BLUE }]}>
            {COLUMN_HEADERS.map((h, i) => (
              <Text
                key={i}
                style={[
                  styles.colHeaderCell,
                  { width: WIDTHS[i], color: COLORS.WHITE },
                ]}
              >
                {h.replace(/\n/g, " ")}
              </Text>
            ))}
          </View>
          {/* Asterisk row */}
          <View style={[styles.tableRow, { backgroundColor: COLORS.GREY }]}>
            {WIDTHS.map((w, i) => (
              <Text key={i} style={[styles.asteriskCell, { width: w }]}>
                {ASTERISK_ROW[i] ?? ""}
              </Text>
            ))}
          </View>
          {/* Data rows */}
          {dataRows.map((cells, ri) => (
            <View key={ri} style={styles.tableRow}>
              {cells.slice(0, 14).map((cell, ci) => (
                <Text
                  key={ci}
                  style={[styles.dataCell, { width: WIDTHS[ci] }]}
                >
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.notes}>
          {NOTES.map((n, i) => (
            <Text key={i}>{n}</Text>
          ))}
        </View>
      </Page>
    </Document>
  );

  const buffer = (await renderToBuffer(doc)) as Buffer;
  console.log("[ITR-PLA-001] React-PDF: after renderToBuffer", { bufferSize: buffer?.length ?? 0 });
  const safeName = (section.name ?? "section").replace(/\s+/g, "-");
  const fileName = `ITR-PLA-001_${safeName}_ITR-${pageNumber}_${Date.now()}.pdf`;
  return {
    buffer,
    contentType: "application/pdf",
    fileName,
  };
}
