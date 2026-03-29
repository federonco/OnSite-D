/**
 * ITR-PLA-001 PDF via React-PDF (serverless-safe).
 * Layout tuned for Batch 4 visual target.
 */

import React from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
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
} from "./config";
import { getLogoSrc } from "./logo";
import { mapRecordToCells } from "./mapper";
import type { RecordRow } from "./mapper";
import type { SectionInfo } from "./types";

const WIDTHS = [...COL_WIDTHS_PT];
const CATEGORY_WIDTHS = [
  WIDTHS.slice(0, 6).reduce((a, b) => a + b, 0),
  WIDTHS.slice(6, 10).reduce((a, b) => a + b, 0),
  WIDTHS.slice(10, 12).reduce((a, b) => a + b, 0),
  WIDTHS.slice(12, 14).reduce((a, b) => a + b, 0),
];

const BORDER = 1;
const FINAL_COLUMN_COUNT = 14; /** Table ends at SIGNATURE. No extra columns. */
const CELL_ALIGN: ("left" | "right" | "center")[] = [
  "left", "right", "left", "center", "center", "center", "left",
  "center", "center", "center", "center", "center", "left", "left",
];

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 7 },
  header: {
    flexDirection: "row",
    borderWidth: BORDER,
    borderColor: COLORS.BLACK,
    marginBottom: 5,
  },
  headerLeft: {
    width: "20%",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRightWidth: BORDER,
    borderColor: COLORS.BLACK,
  },
  headerMetaRow: { flexDirection: "row", fontSize: 6, marginBottom: 0 },
  headerLabel: { fontWeight: "bold", marginRight: 4 },
  headerCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 4,
  },
  headerTitle: { fontSize: 9, fontWeight: "bold", textTransform: "uppercase" },
  headerSubtitle: { fontSize: 7, marginTop: 1 },
  headerRight: {
    width: "20%",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderLeftWidth: BORDER,
    borderColor: COLORS.BLACK,
  },
  logoImg: { width: 52, height: 20 },
  logoPlaceholder: {
    width: 52,
    height: 20,
    backgroundColor: COLORS.GREY,
    justifyContent: "center",
    alignItems: "center",
  },
  projSection: {
    borderWidth: BORDER,
    borderColor: COLORS.BLACK,
    marginBottom: 5,
  },
  projHeader: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "center",
    borderBottomWidth: BORDER,
    borderBottomColor: COLORS.BLACK,
  },
  projRow: { flexDirection: "row" },
  projCell: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRightWidth: BORDER,
    borderBottomWidth: BORDER,
    borderColor: COLORS.BLACK,
    fontSize: 7,
  },
  tableWrap: {
    borderWidth: BORDER,
    borderColor: COLORS.BLACK,
    marginBottom: 8,
  },
  tableHeader: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "center",
    backgroundColor: COLORS.BLUE,
    color: COLORS.WHITE,
    borderBottomWidth: BORDER,
    borderBottomColor: COLORS.BLACK,
  },
  tableRow: { flexDirection: "row", minHeight: 18 },
  categoryCell: {
    paddingVertical: 4,
    paddingHorizontal: 3,
    fontSize: 6,
    fontWeight: "bold",
    borderRightWidth: BORDER,
    borderBottomWidth: BORDER,
    textAlign: "center",
  },
  colHeaderCell: {
    paddingVertical: 4,
    paddingHorizontal: 3,
    fontSize: 5,
    fontWeight: "bold",
    borderRightWidth: BORDER,
    borderBottomWidth: BORDER,
    textAlign: "center",
  },
  asteriskCell: {
    paddingVertical: 3,
    paddingHorizontal: 3,
    fontSize: 5,
    borderRightWidth: BORDER,
    borderBottomWidth: BORDER,
    borderColor: COLORS.BLACK,
  },
  dataCell: {
    paddingVertical: 2,
    paddingHorizontal: 3,
    fontSize: 6,
    borderRightWidth: BORDER,
    borderBottomWidth: BORDER,
    borderColor: COLORS.BLACK,
    backgroundColor: COLORS.WHITE,
  },
  notes: {
    marginTop: 6,
    fontSize: 6,
    lineHeight: 1.3,
  },
  noteLine: { marginBottom: 1 },
});

export async function generateITRPla001PdfReact(
  section: SectionInfo,
  records: RecordRow[],
  pageNumber: number,
  _totalPages: number,
  options?: { isOpenITR?: boolean; dataRows?: string[][] }
): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
  const pageNoLabel = options?.isOpenITR ? "In Progress" : "1 of 1";
  const dataRows = options?.dataRows ?? records.map((r) => mapRecordToCells(r));

  const doc = (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerMetaRow}>
              <Text style={styles.headerLabel}>Doc No:</Text>
              <Text>{DOC_NO}</Text>
            </View>
            <View style={styles.headerMetaRow}>
              <Text style={styles.headerLabel}>Effective Date:</Text>
              <Text>{EFFECTIVE_DATE}</Text>
            </View>
            <View style={styles.headerMetaRow}>
              <Text style={styles.headerLabel}>Revision No:</Text>
              <Text>{REVISION_NO}</Text>
            </View>
            <View style={styles.headerMetaRow}>
              <Text style={styles.headerLabel}>Page No:</Text>
              <Text>{pageNoLabel}</Text>
            </View>
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>PIPE LAYING INSPECTION FIELD RECORD</Text>
            <Text style={styles.headerSubtitle}>ITR-PLA-001</Text>
          </View>
          <View style={styles.headerRight}>
            {getLogoSrc() ? (
              <Image src={getLogoSrc()!} style={styles.logoImg} />
            ) : (
              <View style={styles.logoPlaceholder}><Text style={{ fontSize: 5 }}>LOGO</Text></View>
            )}
          </View>
        </View>

        <View style={styles.projSection}>
          <Text style={styles.projHeader}>PROJECT INFORMATION</Text>
          <View style={styles.projRow}>
            <Text style={[styles.projCell, { flex: 3 }]}>PROJECT NAME:</Text>
            <Text style={[styles.projCell, { flex: 4 }]}>{section.project?.name ?? "—"}</Text>
            <Text style={[styles.projCell, { flex: 2 }]}>PROJECT NUMBER:</Text>
            <Text style={[styles.projCell, { flex: 5, borderRightWidth: 0 }]}>{section.project?.number ?? "—"}</Text>
          </View>
          <View style={styles.projRow}>
            <Text style={[styles.projCell, { flex: 3 }]}>SECTION-SUBLOT:</Text>
            <Text style={[styles.projCell, { flex: 4 }]}>{section.name}</Text>
            <Text style={[styles.projCell, { flex: 3 }]}>ITP:</Text>
            <Text style={[styles.projCell, { flex: 4, borderRightWidth: 0 }]}>{section.itp_number ?? "—"}</Text>
          </View>
        </View>

        <View style={styles.tableWrap}>
          <Text style={styles.tableHeader}>PIPE RECORDS</Text>
          <View style={[styles.tableRow, { backgroundColor: COLORS.BLUE }]}>
            {CATEGORIES.map((c, i) => (
              <Text
                key={i}
                style={[
                  styles.categoryCell,
                  {
                    width: CATEGORY_WIDTHS[i],
                    color: COLORS.WHITE,
                    borderColor: COLORS.WHITE,
                    borderRightWidth: i === CATEGORIES.length - 1 ? 0 : BORDER,
                  },
                ]}
              >
                {c.label}
              </Text>
            ))}
          </View>
          <View style={[styles.tableRow, { backgroundColor: COLORS.BLUE }]}>
            {COLUMN_HEADERS.slice(0, FINAL_COLUMN_COUNT).map((h, i) => (
              <Text
                key={i}
                style={[
                  styles.colHeaderCell,
                  {
                    width: WIDTHS[i],
                    color: COLORS.WHITE,
                    borderColor: COLORS.WHITE,
                    borderRightWidth: i === FINAL_COLUMN_COUNT - 1 ? 0 : BORDER,
                  },
                ]}
              >
                {h.replace(/\n/g, " ")}
              </Text>
            ))}
          </View>
          <View style={[styles.tableRow, { backgroundColor: COLORS.GREY }]}>
            {WIDTHS.slice(0, FINAL_COLUMN_COUNT).map((w, i) => (
              <Text
                key={i}
                style={[
                  styles.asteriskCell,
                  {
                    width: w,
                    borderRightWidth: i === FINAL_COLUMN_COUNT - 1 ? 0 : BORDER,
                  },
                ]}
              >
                {ASTERISK_ROW[i] ?? ""}
              </Text>
            ))}
          </View>
          {dataRows.map((cells, ri) => {
            const row = cells.slice(0, FINAL_COLUMN_COUNT);
            const padded = row.length < FINAL_COLUMN_COUNT
              ? [...row, ...Array(FINAL_COLUMN_COUNT - row.length).fill("")]
              : row;
            return (
              <View key={ri} style={styles.tableRow}>
                {padded.slice(0, FINAL_COLUMN_COUNT).map((cell, ci) => (
                  <Text
                    key={ci}
                    style={[
                      styles.dataCell,
                      {
                        width: WIDTHS[ci],
                        textAlign: CELL_ALIGN[ci] ?? "left",
                        borderRightWidth: ci === FINAL_COLUMN_COUNT - 1 ? 0 : BORDER,
                      },
                    ]}
                  >
                    {cell}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>

        <View style={styles.notes}>
          {NOTES.map((n, i) => (
            <Text key={i} style={styles.noteLine}>
              {n}
            </Text>
          ))}
        </View>
      </Page>
    </Document>
  );

  const buffer = (await renderToBuffer(doc)) as Buffer;
  const safeName = (section.name ?? "section").replace(/\s+/g, "-");
  const fileName = `ITR-PLA-001_${safeName}_ITR-${pageNumber}_${Date.now()}.pdf`;
  return {
    buffer,
    contentType: "application/pdf",
    fileName,
  };
}
