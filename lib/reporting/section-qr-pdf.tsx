import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";

export async function generateSectionQrPdf(
  sectionName: string,
  qrUrl: string
): Promise<Buffer> {
  const qrBuffer = await QRCode.toBuffer(qrUrl, { width: 300, margin: 2 });

  // A5 portrait: 420 x 595 pt
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([420, 595]);
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const qrImage = await pdfDoc.embedPng(qrBuffer);
  const qrSize = 260;

  const titleSize = 14;
  const titleText = String(sectionName ?? "");
  const titleWidth = font.widthOfTextAtSize(titleText, titleSize);
  page.drawText(titleText, {
    x: (width - titleWidth) / 2,
    y: height - 100,
    size: titleSize,
    font,
    color: rgb(0.1, 0.31, 0.47),
  });

  page.drawImage(qrImage, {
    x: (width - qrSize) / 2,
    y: (height - qrSize) / 2 - 20,
    width: qrSize,
    height: qrSize,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
