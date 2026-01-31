/**
 * PeopleOS PH - PDF Generation Module
 *
 * Uses PDFKit for professional PDF generation with proper fonts and formatting.
 */

import PDFDocument from "pdfkit";

// Font configuration - using standard fonts that PDFKit supports
// For Google Sans, you would need to register the font files
const FONTS = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
  italic: "Helvetica-Oblique",
  boldItalic: "Helvetica-BoldOblique",
};

// Document styles
const STYLES = {
  title: { font: FONTS.bold, size: 18 },
  heading1: { font: FONTS.bold, size: 14 },
  heading2: { font: FONTS.bold, size: 12 },
  heading3: { font: FONTS.bold, size: 11 },
  body: { font: FONTS.regular, size: 10 },
  small: { font: FONTS.regular, size: 9 },
  footer: { font: FONTS.italic, size: 8 },
};

// Colors
const COLORS = {
  primary: "#1a1a1a",
  secondary: "#4a4a4a",
  accent: "#2563eb",
  muted: "#6b7280",
  border: "#e5e7eb",
};

// Page margins
const MARGINS = {
  top: 60,
  bottom: 60,
  left: 50,
  right: 50,
};

export interface PDFGeneratorOptions {
  title?: string;
  author?: string;
  subject?: string;
}

/**
 * Create a new PDF document with consistent styling
 */
export function createPDFDocument(options?: PDFGeneratorOptions): typeof PDFDocument.prototype {
  const doc = new PDFDocument({
    size: "A4",
    margins: MARGINS,
    info: {
      Title: options?.title || "Document",
      Author: options?.author || "PeopleOS PH",
      Subject: options?.subject,
    },
    bufferPages: true,
  });

  return doc;
}

/**
 * Add company header to document
 */
export function addCompanyHeader(
  doc: typeof PDFDocument.prototype,
  company: {
    name: string;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    province?: string | null;
  }
): void {
  const pageWidth = doc.page.width - MARGINS.left - MARGINS.right;

  // Company name
  doc
    .font(STYLES.title.font)
    .fontSize(STYLES.title.size)
    .fillColor(COLORS.primary)
    .text(company.name.toUpperCase(), MARGINS.left, MARGINS.top, {
      width: pageWidth,
      align: "center",
    });

  doc.moveDown(0.3);

  // Address
  const addressParts = [
    company.addressLine1,
    company.addressLine2,
    [company.city, company.province].filter(Boolean).join(", "),
  ].filter(Boolean);

  if (addressParts.length > 0) {
    doc
      .font(STYLES.small.font)
      .fontSize(STYLES.small.size)
      .fillColor(COLORS.secondary)
      .text(addressParts.join(" | "), { width: pageWidth, align: "center" });
  }

  // Divider line
  doc.moveDown(0.8);
  const y = doc.y;
  doc
    .strokeColor(COLORS.border)
    .lineWidth(1)
    .moveTo(MARGINS.left, y)
    .lineTo(doc.page.width - MARGINS.right, y)
    .stroke();

  doc.moveDown(1);
}

/**
 * Add document title
 */
export function addDocumentTitle(
  doc: typeof PDFDocument.prototype,
  title: string
): void {
  const pageWidth = doc.page.width - MARGINS.left - MARGINS.right;

  doc
    .font(STYLES.heading1.font)
    .fontSize(STYLES.heading1.size)
    .fillColor(COLORS.primary)
    .text(title.toUpperCase(), { width: pageWidth, align: "center" });

  doc.moveDown(1.5);
}

/**
 * Add section heading
 */
export function addSectionHeading(
  doc: typeof PDFDocument.prototype,
  heading: string,
  level: 1 | 2 | 3 = 1
): void {
  const style = level === 1 ? STYLES.heading1 : level === 2 ? STYLES.heading2 : STYLES.heading3;

  doc.moveDown(0.5);
  doc
    .font(style.font)
    .fontSize(style.size)
    .fillColor(COLORS.primary)
    .text(heading);

  // Add underline for level 1 headings
  if (level === 1) {
    const y = doc.y + 2;
    doc
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .moveTo(MARGINS.left, y)
      .lineTo(doc.page.width - MARGINS.right, y)
      .stroke();
  }

  doc.moveDown(0.5);
}

/**
 * Add paragraph text
 */
export function addParagraph(
  doc: typeof PDFDocument.prototype,
  text: string,
  options?: { indent?: number; align?: "left" | "center" | "right" | "justify" }
): void {
  const pageWidth = doc.page.width - MARGINS.left - MARGINS.right - (options?.indent || 0);

  doc
    .font(STYLES.body.font)
    .fontSize(STYLES.body.size)
    .fillColor(COLORS.primary)
    .text(text, MARGINS.left + (options?.indent || 0), doc.y, {
      width: pageWidth,
      align: options?.align || "justify",
      lineGap: 3,
    });

  doc.moveDown(0.5);
}

/**
 * Add bullet list
 */
export function addBulletList(
  doc: typeof PDFDocument.prototype,
  items: string[],
  bulletChar: string = "•"
): void {
  const indent = 20;
  const bulletWidth = 15;
  const textX = MARGINS.left + indent + bulletWidth;
  const textWidth = doc.page.width - MARGINS.right - textX;

  for (const item of items) {
    const startY = doc.y;

    // Draw bullet
    doc
      .font(STYLES.body.font)
      .fontSize(STYLES.body.size)
      .fillColor(COLORS.primary)
      .text(bulletChar, MARGINS.left + indent, startY);

    // Draw text at fixed position
    doc
      .font(STYLES.body.font)
      .fontSize(STYLES.body.size)
      .fillColor(COLORS.primary)
      .text(item, textX, startY, { width: textWidth, lineGap: 2 });

    doc.moveDown(0.3);
  }
}

/**
 * Add numbered list
 */
export function addNumberedList(
  doc: typeof PDFDocument.prototype,
  items: string[],
  startNumber: number = 1
): void {
  const indent = 20;
  const numberWidth = 25;
  const textX = MARGINS.left + indent + numberWidth;
  const textWidth = doc.page.width - MARGINS.right - textX;

  items.forEach((item, index) => {
    const number = `${startNumber + index}.`;
    const startY = doc.y;

    // Draw number
    doc
      .font(STYLES.body.font)
      .fontSize(STYLES.body.size)
      .fillColor(COLORS.primary)
      .text(number, MARGINS.left + indent, startY, { width: numberWidth });

    // Draw text at fixed position
    doc
      .font(STYLES.body.font)
      .fontSize(STYLES.body.size)
      .fillColor(COLORS.primary)
      .text(item, textX, startY, { width: textWidth, lineGap: 2 });

    doc.moveDown(0.3);
  });
}

/**
 * Add labeled field (e.g., "Employee Name: John Doe")
 */
export function addLabeledField(
  doc: typeof PDFDocument.prototype,
  label: string,
  value: string,
  labelWidth: number = 120
): void {
  const startX = MARGINS.left;
  const valueX = startX + labelWidth;
  const valueWidth = doc.page.width - MARGINS.right - valueX;
  const startY = doc.y;

  // Draw label
  doc
    .font(STYLES.body.font)
    .fontSize(STYLES.body.size)
    .fillColor(COLORS.secondary)
    .text(label + ":", startX, startY, { width: labelWidth });

  // Draw value at fixed position
  doc
    .font(STYLES.body.font)
    .fontSize(STYLES.body.size)
    .fillColor(COLORS.primary)
    .text(value, valueX, startY, { width: valueWidth });
}

/**
 * Add signature block
 */
export function addSignatureBlock(
  doc: typeof PDFDocument.prototype,
  name: string,
  title?: string,
  date?: boolean
): void {
  doc.moveDown(2);

  // Signature line
  doc
    .strokeColor(COLORS.primary)
    .lineWidth(0.5)
    .moveTo(MARGINS.left, doc.y)
    .lineTo(MARGINS.left + 200, doc.y)
    .stroke();

  doc.moveDown(0.3);

  // Name
  doc
    .font(STYLES.body.font)
    .fontSize(STYLES.body.size)
    .fillColor(COLORS.primary)
    .text(name, MARGINS.left);

  // Title
  if (title) {
    doc
      .font(STYLES.small.font)
      .fontSize(STYLES.small.size)
      .fillColor(COLORS.secondary)
      .text(title);
  }

  // Date line if requested
  if (date) {
    doc.moveDown(1);
    doc
      .font(STYLES.small.font)
      .fontSize(STYLES.small.size)
      .fillColor(COLORS.secondary)
      .text("Date: _______________________");
  }
}

/**
 * Add two-column signature block (side by side)
 */
export function addDualSignatureBlock(
  doc: typeof PDFDocument.prototype,
  left: { name: string; title?: string },
  right: { name: string; title?: string }
): void {
  doc.moveDown(2);

  const startY = doc.y;
  const columnWidth = (doc.page.width - MARGINS.left - MARGINS.right - 40) / 2;

  // Left signature
  doc
    .strokeColor(COLORS.primary)
    .lineWidth(0.5)
    .moveTo(MARGINS.left, startY)
    .lineTo(MARGINS.left + 180, startY)
    .stroke();

  doc
    .font(STYLES.body.font)
    .fontSize(STYLES.body.size)
    .fillColor(COLORS.primary)
    .text(left.name, MARGINS.left, startY + 5);

  if (left.title) {
    doc
      .font(STYLES.small.font)
      .fontSize(STYLES.small.size)
      .fillColor(COLORS.secondary)
      .text(left.title, MARGINS.left);
  }

  // Right signature
  const rightX = MARGINS.left + columnWidth + 40;
  doc
    .strokeColor(COLORS.primary)
    .lineWidth(0.5)
    .moveTo(rightX, startY)
    .lineTo(rightX + 180, startY)
    .stroke();

  doc
    .font(STYLES.body.font)
    .fontSize(STYLES.body.size)
    .fillColor(COLORS.primary)
    .text(right.name, rightX, startY + 5);

  if (right.title) {
    doc
      .font(STYLES.small.font)
      .fontSize(STYLES.small.size)
      .fillColor(COLORS.secondary)
      .text(right.title, rightX);
  }

  // Reset position
  doc.y = startY + 50;
}

/**
 * Add page footer (deprecated - use addPageFooterAndNumbers instead)
 */
export function addPageFooter(
  doc: typeof PDFDocument.prototype,
  text: string
): void {
  // This function is kept for backwards compatibility
  // It now calls addPageFooterAndNumbers internally
  addPageFooterAndNumbers(doc, text);
}

/**
 * Add page number to all pages (deprecated - use addPageFooterAndNumbers instead)
 */
export function addPageNumbers(doc: typeof PDFDocument.prototype): void {
  // This function is now a no-op since addPageFooter handles it
  // Kept for backwards compatibility
}

/**
 * Add page footer and page numbers to all pages
 * This should be called at the end of document generation, before pdfToBuffer
 */
export function addPageFooterAndNumbers(
  doc: typeof PDFDocument.prototype,
  footerText: string
): void {
  const pages = doc.bufferedPageRange();
  const pageWidth = doc.page.width - MARGINS.left - MARGINS.right;

  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);

    // Check if page has content (not empty) - skip if page y position is at the top margin
    // This helps avoid adding footer to accidentally created empty pages

    // Add footer text
    const footerY = doc.page.height - MARGINS.bottom + 15;
    doc
      .font(STYLES.footer.font)
      .fontSize(STYLES.footer.size)
      .fillColor(COLORS.muted)
      .text(footerText, MARGINS.left, footerY, { width: pageWidth, align: "center" });

    // Add page number below footer
    const pageNumY = doc.page.height - MARGINS.bottom + 28;
    doc
      .font(STYLES.footer.font)
      .fontSize(STYLES.footer.size)
      .fillColor(COLORS.muted)
      .text(`Page ${i + 1} of ${pages.count}`, MARGINS.left, pageNumY, {
        width: pageWidth,
        align: "center",
      });
  }
}

/**
 * Convert PDF document to Buffer
 */
export function pdfToBuffer(doc: typeof PDFDocument.prototype): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.end();
  });
}

/**
 * Add a horizontal rule
 */
export function addHorizontalRule(doc: typeof PDFDocument.prototype): void {
  const y = doc.y;
  doc
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .moveTo(MARGINS.left, y)
    .lineTo(doc.page.width - MARGINS.right, y)
    .stroke();

  doc.moveDown(0.5);
}

/**
 * Add table
 */
export function addTable(
  doc: typeof PDFDocument.prototype,
  headers: string[],
  rows: string[][],
  columnWidths?: number[]
): void {
  const tableWidth = doc.page.width - MARGINS.left - MARGINS.right;
  const defaultColWidth = tableWidth / headers.length;
  const colWidths = columnWidths || headers.map(() => defaultColWidth);
  const rowHeight = 25;
  const padding = 5;

  let startX = MARGINS.left;
  let startY = doc.y;

  // Draw header
  doc.font(STYLES.heading3.font).fontSize(STYLES.body.size);

  // Header background
  doc
    .fillColor("#f3f4f6")
    .rect(startX, startY, tableWidth, rowHeight)
    .fill();

  // Header text
  doc.fillColor(COLORS.primary);
  headers.forEach((header, i) => {
    const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.text(header, x + padding, startY + padding, {
      width: colWidths[i] - padding * 2,
      align: "left",
    });
  });

  startY += rowHeight;

  // Draw rows
  doc.font(STYLES.body.font).fontSize(STYLES.body.size);

  rows.forEach((row, rowIndex) => {
    // Check for page break
    if (startY + rowHeight > doc.page.height - MARGINS.bottom) {
      doc.addPage();
      startY = MARGINS.top;
    }

    // Alternating row background
    if (rowIndex % 2 === 1) {
      doc
        .fillColor("#f9fafb")
        .rect(startX, startY, tableWidth, rowHeight)
        .fill();
    }

    // Row border
    doc
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .rect(startX, startY, tableWidth, rowHeight)
      .stroke();

    // Row text
    doc.fillColor(COLORS.primary);
    row.forEach((cell, i) => {
      const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.text(cell, x + padding, startY + padding, {
        width: colWidths[i] - padding * 2,
        align: "left",
      });
    });

    startY += rowHeight;
  });

  doc.y = startY + 10;
}
