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
import path from "path";
import fs from "fs";

const LOGO_URL = "https://raw.githubusercontent.com/federonco/readx-assets/main/Alkimos_logo.png";

const DOC_NO = "9823-PW-QAT-ITC-0009";
const EFFECTIVE_DATE = "08/07/2025";
const REVISION_NO = "1";

const ITR_PAGE_SIZE = 9;

/** Column widths (px, landscape A4 ~801 usable): A-N per Excel template */
const COL_WIDTHS = [55, 48, 75, 40, 45, 45, 95, 48, 42, 55, 52, 52, 58, 55];

const DARK_BLUE = "#1e3a5f";

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 6,
    flexDirection: "column",
  },
  // Header: single row, 3 sections ~25% | ~45% | ~30%
  headerGrid: {
    flexDirection: "row",
    marginBottom: 8,
  },
  headerLeft: {
    width: "25%",
    minWidth: 160,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#333",
  },
  headerLeftCell: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: "#333",
    padding: 3,
    fontSize: 6,
  },
  headerLeftCellLast: {
    flexDirection: "row",
    padding: 3,
    fontSize: 6,
  },
  headerLeftLabel: { width: 70 },
  headerLeftValue: { flex: 1 },
  headerCenter: {
    width: "45%",
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  titleLine1: { fontSize: 12, fontWeight: "bold" },
  titleLine2: { fontSize: 10, fontWeight: "bold", marginTop: 2 },
  headerRight: {
    width: "30%",
    minWidth: 100,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#333",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: 4,
  },
  logoPlaceholder: {
    fontSize: 7,
    color: "#1e3a5f",
    fontWeight: "bold",
    textAlign: "center",
  },
  logoImg: { maxHeight: 40, maxWidth: 110 },
  // Project info
  projectSection: {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#333",
    marginBottom: 6,
  },
  projectTitleRow: {
    backgroundColor: DARK_BLUE,
    padding: 4,
  },
  projectTitle: {
    color: "white",
    fontWeight: "bold",
    fontSize: 8,
    textAlign: "center",
  },
  projectRow: {
    flexDirection: "row",
    backgroundColor: DARK_BLUE,
  },
  projectCell: {
    flex: 1,
    padding: 4,
    borderTopWidth: 0.5,
    borderColor: "rgba(255,255,255,0.3)",
  },
  projectCellText: { color: "white", fontSize: 7 },
  // Pipe records table
  pipeRecordsSection: {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#333",
  },
  pipeRecordsTitle: {
    backgroundColor: DARK_BLUE,
    padding: 4,
  },
  pipeRecordsTitleText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 8,
    textAlign: "center",
  },
  groupHeaderRow: {
    flexDirection: "row",
    backgroundColor: DARK_BLUE,
  },
  groupHeaderCell: {
    flex: 1,
    padding: 3,
    borderTopWidth: 0.5,
    borderColor: "rgba(255,255,255,0.3)",
  },
  groupHeaderText: { color: "white", fontSize: 6, textAlign: "center" },
  colHeaderRow: {
    flexDirection: "row",
    backgroundColor: DARK_BLUE,
  },
  cell: {
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: "#333",
    padding: 2,
  },
  headerCell: {
    color: "white",
    fontSize: 5,
    textAlign: "center",
  },
  subheaderRow: {
    flexDirection: "row",
    backgroundColor: "#e5e7eb",
  },
  subheaderCell: { fontSize: 5, fontStyle: "italic" },
  dataRow: { flexDirection: "row", minHeight: 16 },
  dataRowAlt: { flexDirection: "row", minHeight: 16, backgroundColor: "#f3f4f6" },
  notesRow: {
    marginTop: 4,
    paddingHorizontal: 4,
    fontSize: 5,
    lineHeight: 1.3,
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

const HEADERS = [
  "Date Installed",
  "Pipe Chainage",
  "Pipe No Stamp or Fitting ID",
  "Joint Type (WR, RRJ, WB, or CWB)",
  "Pipe Installed to Witness Mark (Y/N)",
  "Internal Rubber Seal Check (Y/N)",
  "Alignment & Deflection Check — Hor ±100mm / Vert ±50mm — Joint Deflection: see note below",
  "CP Lugs Installed @ 12 O'clock (RRJ ONLY)",
  "Ovality Check **",
  "Joint Air Test RRJ-WR ONLY (80kPa hold for 2 min)",
  "Internal Cement Liner (OK/Patch)",
  "Spark Testing (OK/Patched)",
  "APA Signoff — NAME",
  "APA Signoff — SIGNATURE",
];

const SUBHEADER_NOTES: Record<number, string> = {
  2: "*",
  4: "*",
  6: "***",
  7: "*",
  8: "**",
  9: "*",
  10: "*(If Patched)",
  11: "*(If Patched)",
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

function formatAlignment(r: RecordRow) {
  const vSign = r.deflection_v_sign ?? "+";
  const vMm = r.deflection_v_mm ?? 0;
  const hSide = r.deflection_h_side ?? "L";
  const hMm = r.deflection_h_mm ?? 0;
  return `V: ${vSign}${vMm}mm / H: ${hSide}${hMm}mm`;
}

function yn(val: boolean | null | undefined) {
  if (val == null) return "";
  return val ? "Y" : "";
}

function cpLugsVal(r: RecordRow) {
  const jt = (r.joint_type ?? "").toString().toUpperCase().trim();
  if (jt !== "RRJ") return "N/A";
  return yn(r.cp_lugs);
}

function jointAirTestVal(r: RecordRow) {
  const jt = (r.joint_type ?? "").toString().toUpperCase().trim();
  // WB, CWB, Transition: N/A (no air test required)
  if (["WB", "CWB", "TRANSITION"].includes(jt)) return "N/A";
  // RRJ and WR: show Y when checked, else empty
  if (jt === "RRJ" || jt === "WR") return yn(r.joint_air_test);
  return "N/A";
}

async function fetchLogoDataUrl(): Promise<string | null> {
  // 1. Try local: public/alkimos-logo.png
  try {
    const publicPath = path.join(process.cwd(), "public", "alkimos-logo.png");
    if (fs.existsSync(publicPath)) {
      const buf = fs.readFileSync(publicPath);
      return `data:image/png;base64,${buf.toString("base64")}`;
    }
  } catch {
    /* ignore */
  }
  // 2. Try local: app/uploads (Alkimos_logo.png or Alkimos logo.png)
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
  // 3. Try remote URL
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
  totalPages: number
) {
  const pageRecords = records.slice(0, ITR_PAGE_SIZE);
  const emptyRows = ITR_PAGE_SIZE - pageRecords.length;
  const logoDataUrl = await fetchLogoDataUrl();

  const doc = (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* HEADER: 2-row grid + title + logo */}
        <View style={styles.headerGrid}>
          <View style={styles.headerLeft}>
            <View style={styles.headerLeftCell}>
              <Text style={styles.headerLeftLabel}>Doc No:</Text>
              <Text style={styles.headerLeftValue}>{DOC_NO}</Text>
            </View>
            <View style={styles.headerLeftCell}>
              <Text style={styles.headerLeftLabel}>Effective Date:</Text>
              <Text style={styles.headerLeftValue}>{EFFECTIVE_DATE}</Text>
            </View>
            <View style={styles.headerLeftCell}>
              <Text style={styles.headerLeftLabel}>Revision No:</Text>
              <Text style={styles.headerLeftValue}>{REVISION_NO}</Text>
            </View>
            <View style={styles.headerLeftCellLast}>
              <Text style={styles.headerLeftLabel}>Page No:</Text>
              <Text style={styles.headerLeftValue}>{pageNumber} of {totalPages}</Text>
            </View>
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.titleLine1}>PIPE LAYING INSPECTION FIELD RECORD</Text>
            <Text style={styles.titleLine2}>ITR-PLA-001</Text>
          </View>
          <View style={styles.headerRight}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.logoImg} />
            ) : (
              <Text style={styles.logoPlaceholder}>ALKIMOS PIPELINE ALLIANCE</Text>
            )}
          </View>
        </View>

        {/* PROJECT INFO SECTION */}
        <View style={styles.projectSection}>
          <View style={styles.projectTitleRow}>
            <Text style={styles.projectTitle}>PROJECT INFORMATION</Text>
          </View>
          <View style={styles.projectRow}>
            <View style={styles.projectCell}>
              <Text style={styles.projectCellText}>PROJECT NAME: {section.project_name ?? "—"}</Text>
            </View>
            <View style={[styles.projectCell, { borderLeftWidth: 0.5, borderColor: "rgba(255,255,255,0.3)" }]}>
              <Text style={styles.projectCellText}>PROJECT NUMBER: {section.project_number ?? "—"}</Text>
            </View>
          </View>
          <View style={styles.projectRow}>
            <View style={styles.projectCell}>
              <Text style={styles.projectCellText}>SECTION-SUBLOT: {section.name}</Text>
            </View>
            <View style={[styles.projectCell, { borderLeftWidth: 0.5, borderColor: "rgba(255,255,255,0.3)" }]}>
              <Text style={styles.projectCellText}>ITP: {section.itp_number ?? "—"}</Text>
            </View>
          </View>
        </View>

        {/* PIPE RECORDS TABLE */}
        <View style={styles.pipeRecordsSection}>
          <View style={styles.pipeRecordsTitle}>
            <Text style={styles.pipeRecordsTitleText}>PIPE RECORDS</Text>
          </View>
          {/* Group headers */}
          <View style={styles.groupHeaderRow}>
            <View style={[styles.groupHeaderCell, { flex: 4.8 }]}>
              <Text style={styles.groupHeaderText}>Pipe/Fitting Details</Text>
            </View>
            <View style={[styles.groupHeaderCell, { flex: 1.55 }]}>
              <Text style={styles.groupHeaderText}>PIPE SPECIFICS</Text>
            </View>
            <View style={[styles.groupHeaderCell, { flex: 1.1 }]}>
              <Text style={styles.groupHeaderText}>FINAL CHECK</Text>
            </View>
            <View style={[styles.groupHeaderCell, { flex: 1.15 }]}>
              <Text style={styles.groupHeaderText}>APA Signoff</Text>
            </View>
          </View>
          {/* Column headers */}
          <View style={styles.colHeaderRow}>
            {HEADERS.map((label, idx) => (
              <Text
                key={idx}
                style={[
                  styles.cell,
                  styles.headerCell,
                  { width: COL_WIDTHS[idx], minHeight: 24 },
                ]}
              >
                {label}
              </Text>
            ))}
          </View>
          {/* Asterisk subheader */}
          <View style={styles.subheaderRow}>
            {HEADERS.map((_, idx) => (
              <Text
                key={idx}
                style={[
                  styles.cell,
                  styles.subheaderCell,
                  { width: COL_WIDTHS[idx] },
                ]}
              >
                {SUBHEADER_NOTES[idx] ?? ""}
              </Text>
            ))}
          </View>
          {/* Data rows (9) */}
          {pageRecords.map((r, idx) => (
            <View key={idx} style={idx % 2 === 0 ? styles.dataRow : styles.dataRowAlt}>
              <Text style={[styles.cell, { width: COL_WIDTHS[0] }]}>{formatDate(r.date_installed)}</Text>
              <Text style={[styles.cell, { width: COL_WIDTHS[1] }]}>{String(r.chainage)}</Text>
              <Text style={[styles.cell, { width: COL_WIDTHS[2] }]}>{r.pipe_fitting_id ?? ""}</Text>
              <Text style={[styles.cell, { width: COL_WIDTHS[3] }]}>{r.joint_type ?? ""}</Text>
              <Text style={[styles.cell, { width: COL_WIDTHS[4] }]}>{yn(r.witness_mark)}</Text>
              <Text style={[styles.cell, { width: COL_WIDTHS[5] }]}>{yn(r.internal_seal)}</Text>
              <Text style={[styles.cell, { width: COL_WIDTHS[6] }]}>{formatAlignment(r)}</Text>
              <Text style={[styles.cell, { width: COL_WIDTHS[7] }]}>{cpLugsVal(r)}</Text>
              <Text style={[styles.cell, { width: COL_WIDTHS[8] }]}>{yn(r.ovality_check)}</Text>
              <Text style={[styles.cell, { width: COL_WIDTHS[9] }]}>{jointAirTestVal(r)}</Text>
              <Text style={[styles.cell, { width: COL_WIDTHS[10] }]}>{yn(r.cement_liner)}</Text>
              <Text style={[styles.cell, { width: COL_WIDTHS[11] }]}>{yn(r.spark_testing)}</Text>
              <Text style={[styles.cell, { width: COL_WIDTHS[12] }]}>{r.inspector_name ?? ""}</Text>
              <Text style={[styles.cell, { width: COL_WIDTHS[13] }]} />
            </View>
          ))}
          {Array.from({ length: emptyRows }).map((_, i) => (
            <View key={`e-${i}`} style={(pageRecords.length + i) % 2 === 0 ? styles.dataRow : styles.dataRowAlt}>
              {HEADERS.map((_, j) => (
                <Text key={j} style={[styles.cell, { width: COL_WIDTHS[j] }]} />
              ))}
            </View>
          ))}
        </View>

        {/* Notes */}
        <View style={styles.notesRow}>
          <Text>NOTE: * Has photo requirements.</Text>
          <Text>NOTE:** Measurements for Ovality check are to be done at evenly spaced intervals approximately 2Pi/3 around the inside of the pipe</Text>
          <Text>NOTE: *** Max deviation and deflection in WR joint is 1.1deg. Max Deflection in RRJ is 0.6deg. Max Deflection with Site Weld Band is 6 deg. No reverse grade permitted - Any exceedance in alignment to be RFI'd.</Text>
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
