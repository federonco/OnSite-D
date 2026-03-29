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

const LOGO_URL =
  "https://raw.githubusercontent.com/federonco/readx-assets/main/readX%20blue.png";

/* Neutral QA/audit style: restrained, professional */
const palette = {
  black: "#1a1a1a",
  greyDark: "#374151",
  grey: "#6b7280",
  greyLight: "#9ca3af",
  greyBg: "#f3f4f6",
  greyBorder: "#e5e7eb",
  white: "#ffffff",
};

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 8,
    fontFamily: "Helvetica",
  },

  /* Title block */
  titleBlock: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.greyBorder,
    paddingBottom: 10,
  },
  titleMain: {
    fontSize: 14,
    fontWeight: "bold",
    color: palette.black,
    letterSpacing: 0.5,
  },
  titleSub: {
    fontSize: 9,
    color: palette.grey,
    marginTop: 2,
  },

  /* Metadata block */
  metaBlock: {
    backgroundColor: palette.greyBg,
    borderWidth: 0.5,
    borderColor: palette.greyBorder,
    padding: 10,
    marginBottom: 12,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  metaItem: {
    width: "33.33%",
    marginBottom: 4,
    flexDirection: "row",
  },
  metaLabel: {
    fontSize: 7,
    color: palette.grey,
    width: 70,
    flexShrink: 0,
  },
  metaValue: {
    fontSize: 8,
    color: palette.black,
    fontWeight: "normal",
  },

  /* Audit summary block - single metric */
  summaryBlock: {
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: palette.greyBorder,
  },
  summaryHeader: {
    backgroundColor: palette.greyBg,
    padding: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: palette.greyBorder,
  },
  summaryHeaderText: {
    fontSize: 9,
    fontWeight: "bold",
    color: palette.black,
  },
  summaryContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
  },
  summaryLabel: {
    fontSize: 8,
    color: palette.grey,
    marginRight: 8,
  },
  summaryValue: {
    fontSize: 10,
    fontWeight: "bold",
    color: palette.black,
  },

  /* Table */
  table: {
    borderWidth: 0.5,
    borderColor: palette.greyBorder,
    marginBottom: 16,
  },
  tableGroupHeader: {
    flexDirection: "row",
    backgroundColor: palette.greyDark,
  },
  tableGroupHeaderCell: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 7,
    fontWeight: "bold",
    color: palette.white,
    borderRightWidth: 0.5,
    borderColor: "rgba(255,255,255,0.3)",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: palette.greyBg,
    borderBottomWidth: 0.5,
    borderColor: palette.greyBorder,
  },
  tableHeaderCell: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 7,
    fontWeight: "bold",
    color: palette.black,
    borderRightWidth: 0.5,
    borderColor: palette.greyBorder,
  },
  tableHeaderCellLast: {
    borderRightWidth: 0,
  },
  tableHeaderPipeChecks: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 7,
    fontWeight: "bold",
    color: palette.black,
    backgroundColor: "#eaeaea",
    borderRightWidth: 0.5,
    borderColor: palette.greyBorder,
    textAlign: "center",
  },
  tableDataRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: palette.greyBorder,
  },
  tableDataRowZebra: {
    backgroundColor: palette.greyBg,
  },
  tableDataCell: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    fontSize: 7,
    color: palette.black,
    borderRightWidth: 0.5,
    borderColor: palette.greyBorder,
  },
  tableDataCellLast: {
    borderRightWidth: 0,
  },
  tableDataCellCenter: {
    textAlign: "center",
  },
  tableDataCellFail: {
    fontWeight: "bold",
    color: palette.black,
  },
  tableDataCellAlign: {
    fontSize: 6.5,
  },

  /* Footer */
  footer: {
    position: "absolute",
    bottom: 16,
    left: 24,
    right: 24,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 0.5,
    borderTopColor: palette.greyBorder,
    paddingTop: 8,
  },
  footerLine1: {
    fontSize: 7,
    color: palette.grey,
    marginBottom: 2,
  },
  footerLine2: {
    fontSize: 6,
    color: palette.greyLight,
  },
  logo: {
    height: 12,
    marginBottom: 4,
  },
});

type SectionInfo = {
  name: string;
  project: { name: string | null; number: string | null } | null;
  direction?: string | null;
  start_ch?: number | null;
  end_ch?: number | null;
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

/* Column config: [label, width, alignCenter, isPipeCheck] — scaled for A4 landscape ~794pt */
const COLUMNS: Array<[string, number, boolean, boolean]> = [
  ["Date", 65, false, false],
  ["Ch", 65, false, false],
  ["Pipe ID", 145, false, false],
  ["Joint", 51, false, false],
  ["Witness", 44, true, false],
  ["Seal", 44, true, false],
  ["Alignment", 130, false, false],
  ["CP", 33, true, true],
  ["Ovality", 33, true, true],
  ["Air", 33, true, true],
  ["Cement", 33, true, true],
  ["Spark", 33, true, true],
  ["Inspector", 87, false, false],
];

function formatDate(d: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-AU", {
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
  return `V: ${vSign}${vMm}  H: ${hSide}${hMm}`;
}

function yn(val: boolean | null | undefined): "Y" | "N" | "" {
  if (val == null) return "";
  return val ? "Y" : "N";
}

function getChainageRange(records: RecordRow[]): string {
  if (records.length === 0) return "—";
  const min = Math.min(...records.map((r) => r.chainage));
  const max = Math.max(...records.map((r) => r.chainage));
  return `${min.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → ${max.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const Footer = () => (
  <View style={styles.footer} fixed>
    <Image src={LOGO_URL} style={styles.logo} />
    <Text style={styles.footerLine1}>Generated by OnSite QA System</Text>
    <Text style={styles.footerLine2}>Audit report — Raw Pipe Records</Text>
    <Text style={styles.footerLine2}>APA Quality Management Systems</Text>
  </View>
);

export type AuditReportParams = {
  section: SectionInfo;
  records: RecordRow[];
  generatedBy?: string | null;
};

export async function generateAuditReportPdf(params: AuditReportParams) {
  const { section, records, generatedBy } = params;
  const chainageRange = getChainageRange(records);
  const generatedDate = new Date().toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const doc = (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* 1. Title block */}
        <View style={styles.titleBlock}>
          <Text style={styles.titleMain}>SECTION AUDIT REPORT</Text>
          <Text style={styles.titleSub}>Raw Pipe Installation Records</Text>
        </View>

        {/* 2. Metadata block */}
        <View style={styles.metaBlock}>
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Project</Text>
              <Text style={styles.metaValue}>
                {section.project?.name ?? "—"}
                {section.project?.number ? ` (${section.project.number})` : ""}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Section</Text>
              <Text style={styles.metaValue}>{section.name}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Direction</Text>
              <Text style={styles.metaValue}>
                {section.direction ? String(section.direction) : "—"}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Chainage range</Text>
              <Text style={styles.metaValue}>{chainageRange}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Total records</Text>
              <Text style={styles.metaValue}>{records.length}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Generated</Text>
              <Text style={styles.metaValue}>{generatedDate}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Generated by</Text>
              <Text style={styles.metaValue}>{generatedBy ?? "—"}</Text>
            </View>
          </View>
        </View>

        {/* 3. Audit summary block */}
        <View style={styles.summaryBlock}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryHeaderText}>Audit Summary</Text>
          </View>
          <View style={styles.summaryContent}>
            <Text style={styles.summaryLabel}>Total Records:</Text>
            <Text style={styles.summaryValue}>{records.length}</Text>
          </View>
        </View>

        {/* 4. Raw records table */}
        <View style={styles.table}>
          {/* Grouped header: Pipe Details | Pipe Checks | Inspector */}
          <View style={styles.tableGroupHeader}>
            <Text
              style={[styles.tableGroupHeaderCell, { width: 544 }]}
            >
              Pipe Details
            </Text>
            <Text
              style={[styles.tableGroupHeaderCell, { width: 165 }]}
            >
              Pipe Checks
            </Text>
            <Text
              style={[styles.tableGroupHeaderCell, { width: 87, borderRightWidth: 0 }]}
            >
              Inspector
            </Text>
          </View>
          <View style={styles.tableHeaderRow}>
            {COLUMNS.map(([label, width], i) => {
              const isPipeCheck = COLUMNS[i][3];
              const center = COLUMNS[i][2];
              const last = i === COLUMNS.length - 1;
              return (
                <Text
                  key={label}
                  style={[
                    isPipeCheck ? styles.tableHeaderPipeChecks : styles.tableHeaderCell,
                    { width },
                    ...(center ? [styles.tableDataCellCenter] : []),
                    ...(last ? [styles.tableHeaderCellLast] : []),
                  ]}
                >
                  {label}
                </Text>
              );
            })}
          </View>
          {records.map((r, idx) => (
            <View
              key={idx}
              style={[
                styles.tableDataRow,
                ...(idx % 2 === 1 ? [styles.tableDataRowZebra] : []),
              ]}
            >
              <TableDataCells record={r} columns={COLUMNS} />
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

function TableDataCells({
  record: r,
  columns,
}: {
  record: RecordRow;
  columns: Array<[string, number, boolean, boolean]>;
}) {
  const values: (string | number)[] = [
    formatDate(r.date_installed),
    r.chainage,
    r.pipe_fitting_id ?? "",
    r.joint_type ?? "",
    yn(r.witness_mark),
    yn(r.internal_seal),
    formatAlignment(r),
    yn(r.cp_lugs),
    yn(r.ovality_check),
    yn(r.joint_air_test),
    yn(r.cement_liner),
    yn(r.spark_testing),
    r.inspector_name ?? "",
  ];

  const isFail = (val: string | number, colIdx: number): boolean => {
    if (val !== "N") return false;
    const [label] = columns[colIdx];
    if (label === "CP") return (r.joint_type ?? "").toString().toUpperCase() === "RRJ";
    if (label === "Ovality" || label === "Cement" || label === "Spark")
      return true;
    if (label === "Air") {
      const jt = (r.joint_type ?? "").toString().toUpperCase();
      return jt === "RRJ" || jt === "WR";
    }
    if (label === "Witness" || label === "Seal") return true;
    return false;
  };

  return (
    <>
      {columns.map(([, width, alignCenter, _], i) => {
        const val = values[i];
        const fail = isFail(val, i);
        const isAlign = columns[i][0] === "Alignment";
        const last = i === columns.length - 1;
        return (
          <Text
            key={i}
            wrap={isAlign}
            style={[
              styles.tableDataCell,
              { width },
              ...(alignCenter ? [styles.tableDataCellCenter] : []),
              ...(last ? [styles.tableDataCellLast] : []),
              ...(fail ? [styles.tableDataCellFail] : []),
              ...(isAlign ? [styles.tableDataCellAlign] : []),
            ]}
          >
            {String(val)}
          </Text>
        );
      })}
    </>
  );
}
