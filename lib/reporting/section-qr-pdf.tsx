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
  page: {
    padding: 48,
    fontSize: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  qrWrapper: {
    marginVertical: 24,
    padding: 24,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
    textAlign: "center",
  },
  hint: {
    fontSize: 10,
    color: "#666",
    marginTop: 24,
  },
});

export async function generateSectionQRPdf(params: {
  sectionId: string;
  sectionName: string;
  qrDataUrl: string;
}) {
  const { sectionName, qrDataUrl } = params;
  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Section QR Code</Text>
        <View style={styles.qrWrapper}>
          <Image src={qrDataUrl} style={{ width: 300, height: 300 }} />
          <Text style={styles.sectionLabel}>{sectionName}</Text>
        </View>
        <Text style={styles.hint}>Scan to open this section in the app</Text>
      </Page>
    </Document>
  );
  const buffer = await renderToBuffer(doc);
  return {
    buffer: Buffer.from(buffer),
    fileName: `qr-${sectionName.replace(/[^a-zA-Z0-9-_]/g, "-")}.pdf`,
  };
}
