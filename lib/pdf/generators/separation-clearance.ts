/**
 * Separation Clearance Form PDF Generator
 */

import {
  createPDFDocument,
  addCompanyHeader,
  addDocumentTitle,
  addSectionHeading,
  addParagraph,
  addLabeledField,
  addHorizontalRule,
  addPageFooter,
  pdfToBuffer,
} from "../index";
import PDFDocument from "pdfkit";

export interface SeparationEmployeeInfo {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  employeeNumber: string;
  jobTitle?: string | null;
  department?: string | null;
  hireDate: Date;
}

export interface SeparationCompanyInfo {
  name: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  province?: string | null;
}

export interface SeparationOptions {
  lastWorkingDay?: string;
  separationReason?: string;
}

// Helper to add checkbox
function addCheckbox(
  doc: typeof PDFDocument.prototype,
  label: string,
  x: number,
  y: number
): void {
  const boxSize = 12;

  // Draw checkbox
  doc
    .strokeColor("#4a4a4a")
    .lineWidth(1)
    .rect(x, y, boxSize, boxSize)
    .stroke();

  // Label
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#1a1a1a")
    .text(label, x + boxSize + 8, y + 1);
}

export async function generateSeparationClearancePDF(
  employee: SeparationEmployeeInfo,
  company: SeparationCompanyInfo,
  options?: SeparationOptions
): Promise<Buffer> {
  const doc = createPDFDocument({
    title: `Separation Clearance - ${employee.firstName} ${employee.lastName}`,
    author: company.name,
    subject: "Employee Separation Clearance Form",
  });

  const fullName = [employee.firstName, employee.middleName, employee.lastName]
    .filter(Boolean)
    .join(" ");

  const today = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const hireDate = employee.hireDate.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Header
  addCompanyHeader(doc, company);

  // Title
  addDocumentTitle(doc, "Employee Separation Clearance Form");

  // Employee Information
  addSectionHeading(doc, "EMPLOYEE INFORMATION");

  addLabeledField(doc, "Employee Name", fullName);
  addLabeledField(doc, "Employee No", employee.employeeNumber);
  addLabeledField(doc, "Department", employee.department || "N/A");
  addLabeledField(doc, "Position", employee.jobTitle || "N/A");
  addLabeledField(doc, "Hire Date", hireDate);
  addLabeledField(doc, "Last Working Day", options?.lastWorkingDay || "[TO BE DETERMINED]");

  if (options?.separationReason) {
    addLabeledField(doc, "Reason", options.separationReason);
  }

  addHorizontalRule(doc);

  // Clearance Checklist
  addSectionHeading(doc, "CLEARANCE CHECKLIST");

  doc.moveDown(0.5);
  addParagraph(
    doc,
    "Please ensure all items below are cleared before the employee's last day:",
    { align: "left" }
  );

  doc.moveDown(0.5);

  const checklistItems = [
    "ID Card Returned",
    "Company Equipment Returned (laptop, phone, etc.)",
    "Access Cards/Keys Surrendered",
    "Email Access Deactivated",
    "Pending Tasks Handed Over",
    "Company Documents Returned",
    "Loans/Advances Settled",
    "Exit Interview Conducted",
  ];

  const startX = 70;
  let currentY = doc.y;

  checklistItems.forEach((item, index) => {
    if (currentY > doc.page.height - 150) {
      doc.addPage();
      currentY = 60;
    }
    addCheckbox(doc, item, startX, currentY);
    currentY += 25;
  });

  doc.y = currentY + 10;

  addHorizontalRule(doc);

  // Department Clearances
  addSectionHeading(doc, "DEPARTMENT CLEARANCES");

  doc.moveDown(0.5);

  const departments = [
    { dept: "Immediate Supervisor", name: "", date: "" },
    { dept: "Department Head", name: "", date: "" },
    { dept: "Human Resources", name: "", date: "" },
    { dept: "Finance/Accounting", name: "", date: "" },
    { dept: "IT Department", name: "", date: "" },
    { dept: "Admin/Facilities", name: "", date: "" },
  ];

  // Table header
  const colWidths = [150, 180, 100];
  const tableX = 50;
  let tableY = doc.y;

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#1a1a1a");

  doc.text("Department", tableX, tableY, { width: colWidths[0] });
  doc.text("Signature/Name", tableX + colWidths[0], tableY, { width: colWidths[1] });
  doc.text("Date", tableX + colWidths[0] + colWidths[1], tableY, { width: colWidths[2] });

  tableY += 20;

  // Draw header line
  doc
    .strokeColor("#e5e7eb")
    .lineWidth(1)
    .moveTo(tableX, tableY)
    .lineTo(tableX + colWidths[0] + colWidths[1] + colWidths[2], tableY)
    .stroke();

  tableY += 10;

  // Table rows
  doc.font("Helvetica").fontSize(10);

  departments.forEach((item) => {
    doc.text(item.dept, tableX, tableY, { width: colWidths[0] });
    doc.text("_______________________", tableX + colWidths[0], tableY, { width: colWidths[1] });
    doc.text("____________", tableX + colWidths[0] + colWidths[1], tableY, { width: colWidths[2] });

    tableY += 30;
  });

  doc.y = tableY + 10;

  addHorizontalRule(doc);

  // Final Pay Section
  addSectionHeading(doc, "FINAL PAY COMPUTATION");

  addParagraph(
    doc,
    "Final pay will be computed and released within 30 days from the last working day, " +
    "subject to completion of all clearance requirements."
  );

  doc.moveDown(1);

  addLabeledField(doc, "Computed By", "_______________________");
  doc.moveDown(0.3);
  addLabeledField(doc, "Date Computed", "_______________________");
  doc.moveDown(0.3);
  addLabeledField(doc, "Approved By", "_______________________");

  // Footer
  addPageFooter(doc, `${company.name} | Generated: ${today}`);

  return pdfToBuffer(doc);
}
