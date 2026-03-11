import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  Image,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import path from "path";
import fs from "fs";

const LOGO_URL = "https://raw.githubusercontent.com/federonco/readx-assets/main/Alkimos_logo.png";

const DOC_NO = "9823-PW-QAT-ITC-0009";
const EFFECTIVE_DATE = "08/07/2025";
const REVISION_NO = "1";

const ITR_PAGE_SIZE = 9;

const STYLES = {
  BLUE_PRIMARY: "#1155CC",
  GREY_ASTERISKS: "#D9D9D9",
  WHITE: "#FFFFFF",
  BLACK: "#000000",
  FONT_FAMILY: "Arial",
  TITLE_SIZE: 8,
  HEADER_LABEL_SIZE: 7,
  COLUMN_HEADER_SIZE: 5,
  DATA_SIZE: 7,
  NOTES_SIZE: 8,
  PAGE_MARGIN: 50,
  DATA_ROW_HEIGHT: 24.7,
  COLUMN_HEADER_HEIGHT: 43,
  ASTERISK_ROW_HEIGHT: 12,
  BORDER_WIDTH: 0.5,
};

const COL_WIDTHS = [55.5, 55.5, 55.5, 55.5, 55.5, 39, 87.4, 48.9, 37.9, 43.4, 50.5, 55.5, 46.2, 55.5];

const COLUMN_HEADERS = [
  "Date Installed",
  "Pipe Chainage",
  "Pipe No Stamp or\nFitting ID",
  "Joint Type\n(WR, RRJ,\nWB, or CWB)",
  "Pipe Installed to\nWittness Mark\n(Y/N)",
  "Internal\nRubber Seal\nCheck (Y/N)",
  "Alignment & Deflection Check\nAlignment:\nHor ±100mm/ Vert ±50mm\nJoint Deflection:\nsee note below",
  "CP Lugs Installed\n@ 12 O'clock (RRJ\nONLY)",
  "Ovality Check\n**",
  "Joint Air Test\nRRJ-WR ONLY\n(80kPa hold for\n2 min)",
  "Internal Cement\nLiner\n(OK/Patch)",
  "Spark Testing\n(OK/Patched)",
  "NAME",
  "SIGNATURE",
];

const ASTERISK_ROW: Record<number, string> = {
  2: "*",
  4: "*",
  6: "***",
  7: "*",
  8: "**",
  9: "*",
  10: "*(If Patched)",
  11: "*(If Patched)",
};

// Arimo = clon métrico de Arial (Google Fonts, Apache). Prefer local .ttf, else @fontsource/arimo.
const fontsDir = path.join(process.cwd(), "public", "fonts");
const arimoRegular = path.join(fontsDir, "Arimo-Regular.ttf");
const arimoBold = path.join(fontsDir, "Arimo-Bold.ttf");

if (fs.existsSync(arimoRegular) && fs.existsSync(arimoBold)) {
  Font.register({
    family: "Arial",
    fonts: [
      { src: arimoRegular, fontWeight: "normal", fontStyle: "normal" },
      { src: arimoBold, fontWeight: "bold", fontStyle: "normal" },
    ],
  });
} else {
  const arimoDir = path.join(process.cwd(), "node_modules", "@fontsource", "arimo", "files");
  Font.register({
    family: "Arial",
    fonts: [
      { src: path.join(arimoDir, "arimo-latin-400-normal.woff"), fontWeight: "normal" },
      { src: path.join(arimoDir, "arimo-latin-700-normal.woff"), fontWeight: "bold", fontStyle: "normal" },
    ],
  });
}
Font.registerHyphenationCallback((word) => [word]);

const cellBorder = {
  borderWidth: STYLES.BORDER_WIDTH,
  borderColor: STYLES.BLACK,
  borderStyle: "solid" as const,
};

const styles = StyleSheet.create({
  page: {
    padding: STYLES.PAGE_MARGIN,
    fontFamily: STYLES.FONT_FAMILY,
    fontSize: STYLES.DATA_SIZE,
  },
  headerTable: {
    flexDirection: "row",
    marginBottom: 6,
    ...cellBorder,
  },
  headerLeft: {
    width: 220,
    padding: 4,
    ...cellBorder,
  },
  headerRow: {
    flexDirection: "row",
    minHeight: 10,
    borderBottomWidth: STYLES.BORDER_WIDTH,
    borderColor: STYLES.BLACK,
  },
  headerRowLast: { borderBottomWidth: 0 },
  headerLabelCell: {
    width: 95,
    padding: 4,
    borderRightWidth: STYLES.BORDER_WIDTH,
    borderColor: STYLES.BLACK,
  },
  headerLabel: { fontWeight: "bold", fontSize: STYLES.HEADER_LABEL_SIZE },
  headerValueCell: { flex: 1, padding: 4 },
  headerValue: { fontSize: STYLES.HEADER_LABEL_SIZE },
  headerRight: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 4,
    ...cellBorder,
  },
  headerTitleBlock: { alignItems: "center", flex: 1 },
  headerTitle1: { fontSize: STYLES.TITLE_SIZE, fontWeight: "bold" },
  headerTitle2: { fontSize: STYLES.TITLE_SIZE, fontWeight: "bold", marginTop: 2 },
  logoImg: { height: 26, width: 98 },
  logoPlaceholder: { fontSize: 7, color: STYLES.BLUE_PRIMARY, fontWeight: "bold" },
  projectSection: { marginBottom: 6, ...cellBorder },
  projectTitleRow: {
    backgroundColor: STYLES.BLUE_PRIMARY,
    padding: 4,
    minHeight: 12,
  },
  projectTitle: {
    color: STYLES.WHITE,
    fontWeight: "bold",
    fontSize: STYLES.TITLE_SIZE,
    textAlign: "center",
  },
  projectDataRow: { flexDirection: "row" },
  projectDataCell: {
    flex: 1,
    padding: 6,
    ...cellBorder,
  },
  projectDataText: { fontSize: STYLES.DATA_SIZE },
  pipeRecordsSection: { ...cellBorder },
  pipeRecordsTitleRow: {
    backgroundColor: STYLES.BLUE_PRIMARY,
    padding: 4,
    minHeight: 12,
  },
  pipeRecordsTitle: {
    color: STYLES.WHITE,
    fontWeight: "bold",
    fontSize: STYLES.TITLE_SIZE,
    textAlign: "center",
  },
  categoryRow: {
    flexDirection: "row",
    backgroundColor: STYLES.BLUE_PRIMARY,
    minHeight: 12,
  },
  categoryCell: {
    padding: 2,
    justifyContent: "center",
    ...cellBorder,
  },
  categoryText: { color: STYLES.WHITE, fontSize: 6, fontWeight: "bold", textAlign: "center" },
  colHeaderRow: {
    flexDirection: "row",
    backgroundColor: STYLES.BLUE_PRIMARY,
    minHeight: STYLES.COLUMN_HEADER_HEIGHT,
  },
  colHeaderCell: {
    padding: 4,
    justifyContent: "center",
    ...cellBorder,
  },
  colHeaderText: {
    color: STYLES.WHITE,
    fontSize: STYLES.COLUMN_HEADER_SIZE,
    fontWeight: "bold",
    textAlign: "center",
  },
  asteriskRow: {
    flexDirection: "row",
    backgroundColor: STYLES.GREY_ASTERISKS,
    minHeight: STYLES.ASTERISK_ROW_HEIGHT,
  },
  asteriskCell: {
    padding: 2,
    fontSize: STYLES.COLUMN_HEADER_SIZE,
    textAlign: "center",
    ...cellBorder,
  },
  dataRow: {
    flexDirection: "row",
    minHeight: STYLES.DATA_ROW_HEIGHT,
    backgroundColor: STYLES.WHITE,
  },
  dataCell: {
    padding: 4,
    fontSize: STYLES.DATA_SIZE,
    textAlign: "center",
    ...cellBorder,
  },
  notesSection: {
    marginTop: 6,
    fontSize: STYLES.NOTES_SIZE,
    lineHeight: 1.4,
  },
});

type SectionInfo = {
  name: string;
  project_name: string | null;
  project_number: string | null;
  itp_number: string | null;
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

function formatDate(d: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function formatChainage(n: number): string {
  return n.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatAlignment(r: RecordRow) {
  const vSign = r.deflection_v_sign ?? "+";
  const vMm = r.deflection_v_mm ?? 0;
  const hSide = r.deflection_h_side ?? "L";
  const hMm = r.deflection_h_mm ?? 0;
  return `V: ${vSign}${vMm}mm / H: ${hSide}${hMm}mm`;
}

function yn(val: boolean | null | undefined): string {
  if (val == null) return "";
  return val ? "Y" : "";
}

function passOrEmpty(val: boolean | null | undefined): string {
  if (val == null) return "";
  return val ? "PASS" : "";
}

function cpLugsVal(r: RecordRow) {
  const jt = (r.joint_type ?? "").toString().toUpperCase().trim();
  if (jt !== "RRJ") return "N/A";
  return yn(r.cp_lugs);
}

function jointAirTestVal(r: RecordRow) {
  const jt = (r.joint_type ?? "").toString().toUpperCase().trim();
  if (jt === "TRANSITION") return "N/A";
  if (jt === "RRJ" || jt === "WR") return yn(r.joint_air_test);
  return "N/A";
}

function cementLinerVal(r: RecordRow) {
  if (r.cement_liner == null) return "";
  return r.cement_liner ? "OK" : "Patch";
}

async function fetchLogoDataUrl(): Promise<string | null> {
  try {
    const publicPath = path.join(process.cwd(), "public", "alkimos-logo.png");
    if (fs.existsSync(publicPath)) {
      const buf = fs.readFileSync(publicPath);
      return `data:image/png;base64,${buf.toString("base64")}`;
    }
  } catch {
    /* ignore */
  }
  try {
    for (const name of ["Alkimos_logo.png", "Alkimos logo.png"]) {
      const uploadsPath = path.join(process.cwd(), "app", "uploads", name);
      if (fs.existsSync(uploadsPath)) {
        const buf = fs.readFileSync(uploadsPath);
        return `data:image/png;base64,${buf.toString("base64")}`;
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    return `data:image/png;base64,${b64}`;
  } catch {
    return null;
  }
}

export async function generateITRPla001Pdf(
  section: SectionInfo,
  records: RecordRow[],
  pageNumber: number,
  totalPages: number,
  options?: { isOpenITR?: boolean }
) {
  const pageRecords = records.slice(0, ITR_PAGE_SIZE);
  const emptyToFill = ITR_PAGE_SIZE - pageRecords.length;
  const totalEmptyRows = emptyToFill;
  const logoDataUrl = await fetchLogoDataUrl();
  const pageNoLabel = options?.isOpenITR ? "In Progress" : `${pageNumber} of ${totalPages}`;

  const doc = (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header: 4 rows × (label | value | title/logo) con bordes */}
        <View style={styles.headerTable}>
          <View style={styles.headerLeft}>
            <View style={styles.headerRow}>
              <View style={styles.headerLabelCell}>
                <Text style={styles.headerLabel}>Doc No:</Text>
              </View>
              <View style={styles.headerValueCell}>
                <Text style={styles.headerValue}>{DOC_NO}</Text>
              </View>
            </View>
            <View style={styles.headerRow}>
              <View style={styles.headerLabelCell}>
                <Text style={styles.headerLabel}>Effective Date:</Text>
              </View>
              <View style={styles.headerValueCell}>
                <Text style={styles.headerValue}>{EFFECTIVE_DATE}</Text>
              </View>
            </View>
            <View style={styles.headerRow}>
              <View style={styles.headerLabelCell}>
                <Text style={styles.headerLabel}>Revision No:</Text>
              </View>
              <View style={styles.headerValueCell}>
                <Text style={styles.headerValue}>{REVISION_NO}</Text>
              </View>
            </View>
            <View style={[styles.headerRow, styles.headerRowLast]}>
              <View style={styles.headerLabelCell}>
                <Text style={styles.headerLabel}>Page No:</Text>
              </View>
              <View style={styles.headerValueCell}>
                <Text style={styles.headerValue}>{pageNoLabel}</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.headerTitleBlock}>
              <Text style={styles.headerTitle1}>PIPE LAYING INSPECTION FIELD RECORD</Text>
              <Text style={styles.headerTitle2}>ITR-PLA-001</Text>
            </View>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.logoImg} />
            ) : (
              <Text style={styles.logoPlaceholder}>ALKIMOS PIPELINE ALLIANCE</Text>
            )}
          </View>
        </View>

        {/* PROJECT INFORMATION */}
        <View style={styles.projectSection}>
          <View style={styles.projectTitleRow}>
            <Text style={styles.projectTitle}>PROJECT INFORMATION</Text>
          </View>
          <View style={styles.projectDataRow}>
            <View style={styles.projectDataCell}>
              <Text style={styles.projectDataText}>
                <Text style={{ fontWeight: "bold" }}>PROJECT NAME: </Text>
                {section.project_name ?? "—"}
              </Text>
            </View>
            <View style={styles.projectDataCell}>
              <Text style={styles.projectDataText}>
                <Text style={{ fontWeight: "bold" }}>PROJECT NUMBER: </Text>
                {section.project_number ?? "—"}
              </Text>
            </View>
          </View>
          <View style={styles.projectDataRow}>
            <View style={styles.projectDataCell}>
              <Text style={styles.projectDataText}>
                <Text style={{ fontWeight: "bold" }}>SECTION-SUBLOT: </Text>
                {section.name}
              </Text>
            </View>
            <View style={styles.projectDataCell}>
              <Text style={styles.projectDataText}>
                <Text style={{ fontWeight: "bold" }}>ITP: </Text>
                {section.itp_number ?? "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* PIPE RECORDS TABLE */}
        <View style={styles.pipeRecordsSection}>
          <View style={styles.pipeRecordsTitleRow}>
            <Text style={styles.pipeRecordsTitle}>PIPE RECORDS</Text>
          </View>
          <View style={styles.categoryRow}>
            <View style={[styles.categoryCell, { width: 316.5 }]}>
              <Text style={styles.categoryText}>Pipe/ Fitting Details</Text>
            </View>
            <View style={[styles.categoryCell, { width: 217.6 }]}>
              <Text style={styles.categoryText}>PIPE SPECIFICS</Text>
            </View>
            <View style={[styles.categoryCell, { width: 106 }]}>
              <Text style={styles.categoryText}>FINAL CHECK</Text>
            </View>
            <View style={[styles.categoryCell, { width: 101.7 }]}>
              <Text style={styles.categoryText}>APA Signoff</Text>
            </View>
          </View>
          <View style={styles.colHeaderRow}>
            {COLUMN_HEADERS.map((label, idx) => (
              <View key={idx} style={[styles.colHeaderCell, { width: COL_WIDTHS[idx] }]}>
                <Text style={styles.colHeaderText}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.asteriskRow}>
            {COLUMN_HEADERS.map((_, idx) => (
              <View key={idx} style={[styles.asteriskCell, { width: COL_WIDTHS[idx] }]}>
                <Text>{ASTERISK_ROW[idx] ?? ""}</Text>
              </View>
            ))}
          </View>
          {pageRecords.map((r, idx) => (
            <View key={idx} style={styles.dataRow}>
              <View style={[styles.dataCell, { width: COL_WIDTHS[0] }]}>
                <Text>{formatDate(r.date_installed)}</Text>
              </View>
              <View style={[styles.dataCell, { width: COL_WIDTHS[1] }]}>
                <Text>{formatChainage(r.chainage)}</Text>
              </View>
              <View style={[styles.dataCell, { width: COL_WIDTHS[2] }]}>
                <Text>{r.pipe_fitting_id ?? ""}</Text>
              </View>
              <View style={[styles.dataCell, { width: COL_WIDTHS[3] }]}>
                <Text>{r.joint_type ?? ""}</Text>
              </View>
              <View style={[styles.dataCell, { width: COL_WIDTHS[4] }]}>
                <Text>{yn(r.witness_mark)}</Text>
              </View>
              <View style={[styles.dataCell, { width: COL_WIDTHS[5] }]}>
                <Text>{yn(r.internal_seal)}</Text>
              </View>
              <View style={[styles.dataCell, { width: COL_WIDTHS[6] }]}>
                <Text>{formatAlignment(r)}</Text>
              </View>
              <View style={[styles.dataCell, { width: COL_WIDTHS[7] }]}>
                <Text>{cpLugsVal(r)}</Text>
              </View>
              <View style={[styles.dataCell, { width: COL_WIDTHS[8] }]}>
                <Text>{passOrEmpty(r.ovality_check)}</Text>
              </View>
              <View style={[styles.dataCell, { width: COL_WIDTHS[9] }]}>
                <Text>{jointAirTestVal(r)}</Text>
              </View>
              <View style={[styles.dataCell, { width: COL_WIDTHS[10] }]}>
                <Text>{cementLinerVal(r)}</Text>
              </View>
              <View style={[styles.dataCell, { width: COL_WIDTHS[11] }]}>
                <Text>{passOrEmpty(r.spark_testing)}</Text>
              </View>
              <View style={[styles.dataCell, { width: COL_WIDTHS[12] }]}>
                <Text>{r.inspector_name ?? ""}</Text>
              </View>
              <View style={[styles.dataCell, { width: COL_WIDTHS[13] }]}>
                <Text />
              </View>
            </View>
          ))}
          {Array.from({ length: totalEmptyRows }).map((_, i) => (
            <View key={`e-${i}`} style={styles.dataRow}>
              {COLUMN_HEADERS.map((_, j) => (
                <View key={j} style={[styles.dataCell, { width: COL_WIDTHS[j] }]}>
                  <Text />
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Notes */}
        <View style={styles.notesSection}>
          <Text>NOTE: * Has photo requirements.</Text>
          <Text>
            NOTE:** Measurements for Ovality check are to be done at evenly spaced intervals
            approximately 2Pi/3 around the inside of the pipe
          </Text>
          <Text>
            NOTE: *** Max deviation and deflection in WR joint is 1.1deg. Max Deflection in RRJ is
            0.6deg. Max Deflection with Site Weld Band is 6 deg. No reverse grade permitted- Any
            exceedance in alignment to be RFI'd.
          </Text>
        </View>
      </Page>
    </Document>
  );

  const buffer = (await renderToBuffer(doc)) as Buffer;
  const safeName = (section.name ?? "section").replace(/\s+/g, "-");
  return {
    buffer,
    contentType: "application/pdf",
    fileName: `ITR-PLA-001_${safeName}_ITR-${pageNumber}_${Date.now()}.pdf`,
  };
}
