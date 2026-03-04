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

const styles = StyleSheet.create({
  page: { padding: 20, fontSize: 7 },
  header: { marginBottom: 12 },
  title: { fontSize: 12, fontWeight: "bold" },
  meta: { fontSize: 8, marginTop: 4 },
  table: { display: "flex", width: "auto", borderStyle: "solid", borderWidth: 1 },
  row: { flexDirection: "row" },
  headerRow: { flexDirection: "row", minHeight: 18 },
  dataRow: { flexDirection: "row", minHeight: 14 },
  cell: { borderStyle: "solid", borderWidth: 0.5, padding: 2, flexGrow: 1 },
  headerCell: { backgroundColor: "#e5e7eb", fontWeight: "bold" },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  footerText: { fontSize: 6, color: "#666" },
  logo: { height: 14 },
});

const LOGO_URL =
  "https://raw.githubusercontent.com/federonco/readx-assets/main/readX%20blue.png";

type SectionInfo = {
  name: string;
  project_name: string | null;
  project_number: string | null;
};

type RecordRow = {
  date_installed: string | null;
  chainage: number;
  pipe_fitting_id: string | null;
  joint_type: string | null;
  witness_mark: boolean | null;
  internal_seal: boolean | null;
  deflection_v_sign: string | null;
  deflection_v_mm: number | null;
  deflection_h_side: string | null;
  deflection_h_mm: number | null;
  cp_lugs: boolean | null;
  ovality_check: boolean | null;
  joint_air_test: boolean | null;
  cement_liner: boolean | null;
  spark_testing: boolean | null;
  inspector_name: string | null;
};

const HEADERS = [
  "Date",
  "Ch",
  "Pipe ID",
  "Joint",
  "Witness",
  "Seal",
  "Alignment",
  "CP",
  "Ovality",
  "Air",
  "Cement",
  "Spark",
  "Inspector",
];
const COL_WIDTHS = [36, 28, 40, 24, 24, 24, 56, 20, 24, 20, 24, 24, 48];

function formatDate(d: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  } catch {
    return d;
  }
}

function formatAlignment(r: RecordRow) {
  const vSign = r.deflection_v_sign ?? "+";
  const vMm = r.deflection_v_mm ?? 0;
  const hSide = r.deflection_h_side ?? "L";
  const hMm = r.deflection_h_mm ?? 0;
  return `V: ${vSign}${vMm} / H: ${hSide}${hMm}`;
}

function yn(val: boolean | null | undefined) {
  if (val == null) return "";
  return val ? "Y" : "N";
}

const Footer = () => (
  <View style={styles.footer} fixed>
    <Text style={styles.footerText}>Created by</Text>
    <Image src={LOGO_URL} style={styles.logo} />
    <Text style={styles.footerText}>
      — APA Quality Management Systems — All Rights Reserved
    </Text>
  </View>
);

export async function generateAuditReportPdf(
  section: SectionInfo,
  records: RecordRow[]
) {
  const doc = (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Section Audit — Raw Records</Text>
          <View style={styles.meta}>
            <Text>Section: {section.name}</Text>
            <Text>Project: {section.project_name ?? ""} ({section.project_number ?? ""})</Text>
            <Text>Total records: {records.length}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            {HEADERS.map((label, idx) => (
              <Text
                key={label}
                style={[
                  styles.cell,
                  styles.headerCell,
                  {
                    width: COL_WIDTHS[idx],
                    flexGrow: idx === 6 ? 1 : 0,
                    flexShrink: 0,
                  },
                ]}
              >
                {label}
              </Text>
            ))}
          </View>
          {records.map((r, idx) => (
            <View key={idx} style={styles.dataRow}>
              <Text
                style={[
                  styles.cell,
                  { width: COL_WIDTHS[0], flexGrow: 0, flexShrink: 0 },
                ]}
              >
                {formatDate(r.date_installed)}
              </Text>
              <Text
                style={[
                  styles.cell,
                  { width: COL_WIDTHS[1], flexGrow: 0, flexShrink: 0 },
                ]}
              >
                {String(r.chainage)}
              </Text>
              <Text
                style={[
                  styles.cell,
                  { width: COL_WIDTHS[2], flexGrow: 0, flexShrink: 0 },
                ]}
              >
                {r.pipe_fitting_id ?? ""}
              </Text>
              <Text
                style={[
                  styles.cell,
                  { width: COL_WIDTHS[3], flexGrow: 0, flexShrink: 0 },
                ]}
              >
                {r.joint_type ?? ""}
              </Text>
              <Text
                style={[
                  styles.cell,
                  { width: COL_WIDTHS[4], flexGrow: 0, flexShrink: 0 },
                ]}
              >
                {yn(r.witness_mark)}
              </Text>
              <Text
                style={[
                  styles.cell,
                  { width: COL_WIDTHS[5], flexGrow: 0, flexShrink: 0 },
                ]}
              >
                {yn(r.internal_seal)}
              </Text>
              <Text
                style={[
                  styles.cell,
                  { width: COL_WIDTHS[6], flexGrow: 1, flexShrink: 0 },
                ]}
              >
                {formatAlignment(r)}
              </Text>
              <Text
                style={[
                  styles.cell,
                  { width: COL_WIDTHS[7], flexGrow: 0, flexShrink: 0 },
                ]}
              >
                {yn(r.cp_lugs)}
              </Text>
              <Text
                style={[
                  styles.cell,
                  { width: COL_WIDTHS[8], flexGrow: 0, flexShrink: 0 },
                ]}
              >
                {yn(r.ovality_check)}
              </Text>
              <Text
                style={[
                  styles.cell,
                  { width: COL_WIDTHS[9], flexGrow: 0, flexShrink: 0 },
                ]}
              >
                {yn(r.joint_air_test)}
              </Text>
              <Text
                style={[
                  styles.cell,
                  { width: COL_WIDTHS[10], flexGrow: 0, flexShrink: 0 },
                ]}
              >
                {yn(r.cement_liner)}
              </Text>
              <Text
                style={[
                  styles.cell,
                  { width: COL_WIDTHS[11], flexGrow: 0, flexShrink: 0 },
                ]}
              >
                {yn(r.spark_testing)}
              </Text>
              <Text
                style={[
                  styles.cell,
                  { width: COL_WIDTHS[12], flexGrow: 0, flexShrink: 0 },
                ]}
              >
                {r.inspector_name ?? ""}
              </Text>
            </View>
          ))}
        </View>

        <Footer />
      </Page>
    </Document>
  );

  const buffer = (await renderToBuffer(doc)) as Buffer;
  const safeName = (section.name ?? "section").replace(/\s+/g, "-");
  return {
    buffer,
    contentType: "application/pdf",
    fileName: `audit_${safeName}_${Date.now()}.pdf`,
  };
}
