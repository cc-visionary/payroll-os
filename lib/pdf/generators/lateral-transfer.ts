/**
 * Notice of Lateral Transfer / Reassignment PDF Generator
 *
 * For formally notifying employees of position transfers or reassignments
 * within the company, exercising management prerogative.
 */

import {
  createPDFDocument,
  addParagraph,
  addPageFooter,
  addPageNumbers,
  pdfToBuffer,
} from "../index";

export interface LateralTransferEmployeeInfo {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  employeeNumber: string;
  jobTitle?: string | null;
  department?: string | null;
  employmentStatus?: "probationary" | "regular" | "contractual" | null;
}

export interface LateralTransferCompanyInfo {
  name: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  province?: string | null;
}

export interface LateralTransferOptions {
  // Transfer details
  effectiveDate: string;
  oldPosition: string;
  newPosition: string;
  newDepartment?: string | null;
  newSupervisorName?: string | null;

  // Reason for transfer
  transferReason:
    | "departmental_restructuring"
    | "discontinuance_of_role"
    | "operational_necessity"
    | "employee_request"
    | "performance_based"
    | "other";
  customReason?: string | null;

  // Signatory
  managerName?: string;
  managerPosition?: string;

  // Date of issuance
  issuanceDate?: string;
}

export async function generateLateralTransferPDF(
  employee: LateralTransferEmployeeInfo,
  company: LateralTransferCompanyInfo,
  options: LateralTransferOptions
): Promise<Buffer> {
  const doc = createPDFDocument({
    title: `Lateral Transfer Notice - ${employee.firstName} ${employee.lastName}`,
    author: company.name,
    subject: "Notice of Lateral Transfer / Reassignment",
  });

  const fullName = [employee.firstName, employee.middleName, employee.lastName]
    .filter(Boolean)
    .join(" ");

  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const issuanceDate = options.issuanceDate || formattedDate;
  const managerName = options.managerName || "Brixter Del Mundo";
  const managerPosition = options.managerPosition || "People Manager";

  const getReasonText = (): string => {
    switch (options.transferReason) {
      case "departmental_restructuring":
        return "departmental restructuring";
      case "discontinuance_of_role":
        return "discontinuance of old role";
      case "operational_necessity":
        return "operational necessity";
      case "employee_request":
        return "employee request";
      case "performance_based":
        return "performance-based reassignment";
      case "other":
        return options.customReason || "business requirements";
      default:
        return "operational necessity";
    }
  };

  const employmentStatusLabels: Record<string, string> = {
    probationary: "PROBATIONARY",
    regular: "REGULAR",
    contractual: "CONTRACTUAL",
  };

  const employmentStatus = employee.employmentStatus
    ? employmentStatusLabels[employee.employmentStatus]
    : "REGULAR";

  // Header info
  doc.moveDown(1);

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#1a1a1a")
    .text("TO:", 50, doc.y, { continued: true })
    .font("Helvetica")
    .text(`  ${fullName}`);

  doc.moveDown(0.5);

  doc
    .font("Helvetica-Bold")
    .text("FROM:", { continued: true })
    .font("Helvetica")
    .text(`  ${managerName}`);

  doc.moveDown(0.5);

  doc
    .font("Helvetica-Bold")
    .text("DATE:", { continued: true })
    .font("Helvetica")
    .text(`  ${issuanceDate}`);

  doc.moveDown(1.5);

  // Subject line
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("#1a1a1a")
    .text("SUBJECT: NOTICE OF LATERAL TRANSFER / REASSIGNMENT", {
      align: "left",
    });

  doc.moveDown(1.5);

  // Salutation
  doc
    .font("Helvetica")
    .fontSize(11)
    .text(`Dear ${employee.firstName},`);

  doc.moveDown(1);

  // First paragraph - Notification
  doc
    .font("Helvetica")
    .fontSize(11)
    .text(
      `This is to formally inform you that effective `,
      { continued: true }
    )
    .font("Helvetica-Bold")
    .text(options.effectiveDate, { continued: true })
    .font("Helvetica")
    .text(
      `, you will be transferred/reassigned from your current position as `,
      { continued: true }
    )
    .font("Helvetica-Bold")
    .text(options.oldPosition, { continued: true })
    .font("Helvetica")
    .text(` to `, { continued: true })
    .font("Helvetica-Bold")
    .text(options.newPosition, { continued: true })
    .font("Helvetica")
    .text(`.`, { lineGap: 4 });

  doc.moveDown(1);

  // Second paragraph - Reason
  addParagraph(
    doc,
    `This decision is made in the exercise of Management Prerogative to regulate employment and ` +
      `assign personnel where they can be most effective for the business, specifically due to ` +
      `${getReasonText()}.`
  );

  doc.moveDown(1);

  // Terms section
  doc
    .font("Helvetica")
    .fontSize(11)
    .text("Please be advised of the following terms regarding this transfer:");

  doc.moveDown(0.5);

  // Term 1 - Lateral Transfer
  doc
    .font("Helvetica")
    .fontSize(11)
    .text("1. ", 70, doc.y, { continued: true })
    .font("Helvetica-Bold")
    .text("Lateral Transfer: ", { continued: true })
    .font("Helvetica")
    .text("This transfer is lateral in nature. There will be ", { continued: true })
    .font("Helvetica-Bold")
    .text("NO DIMINUTION", { continued: true })
    .font("Helvetica")
    .text(" (reduction) in your basic salary, rank, or existing benefits.", { lineGap: 4 });

  doc.moveDown(0.5);

  // Term 2 - Duties and Responsibilities
  doc
    .font("Helvetica")
    .fontSize(11)
    .text("2. ", 70, doc.y, { continued: true })
    .font("Helvetica-Bold")
    .text("Duties and Responsibilities: ", { continued: true })
    .font("Helvetica")
    .text("You will now report directly to ", { continued: true })
    .font("Helvetica-Bold")
    .text(options.newSupervisorName || "[New Supervisor Name]", { continued: true })
    .font("Helvetica")
    .text(
      ". Your new duties are outlined in the attached Job Description.",
      { lineGap: 4 }
    );

  doc.moveDown(0.5);

  // Term 3 - Tenure & Probation
  doc
    .font("Helvetica")
    .fontSize(11)
    .text("3. ", 70, doc.y, { continued: true })
    .font("Helvetica-Bold")
    .text("Tenure & Probation: ", { continued: true })
    .font("Helvetica")
    .text("Your employment status remains ", { continued: true })
    .font("Helvetica-Bold")
    .text(employmentStatus, { continued: true })
    .font("Helvetica")
    .text(
      ". Your tenure is continuous, and your probationary period (if applicable) will " +
        "continue to run its course without interruption.",
      { lineGap: 4 }
    );

  doc.moveDown(1.5);

  // Closing
  addParagraph(
    doc,
    `We trust that you will extend the same cooperation and dedication in your new assignment.`
  );

  doc.moveDown(1);

  doc
    .font("Helvetica")
    .fontSize(11)
    .text("Sincerely,");

  doc.moveDown(2.5);

  // Manager signature
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("_____________________________", 50);

  doc
    .font("Helvetica-Bold")
    .text(managerName);

  doc
    .font("Helvetica")
    .fillColor("#4a4a4a")
    .text(managerPosition);

  // Conforme section
  doc.moveDown(2);

  doc
    .strokeColor("#cccccc")
    .lineWidth(0.5)
    .moveTo(50, doc.y)
    .lineTo(550, doc.y)
    .stroke();

  doc.moveDown(1);

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#1a1a1a")
    .text(
      "CONFORME: ",
      50,
      doc.y,
      { continued: true }
    )
    .font("Helvetica")
    .text(
      "I acknowledge receipt of this transfer order and understand my new duties."
    );

  doc.moveDown(2.5);

  // Employee signature
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("_____________________________", 50);

  doc
    .font("Helvetica-Bold")
    .text(fullName);

  doc.moveDown(0.5);

  doc
    .font("Helvetica")
    .fillColor("#4a4a4a")
    .text("Date: ________________");

  // Page numbers
  addPageNumbers(doc);

  // Footer
  addPageFooter(doc, `${company.name} | Generated: ${formattedDate}`);

  return pdfToBuffer(doc);
}
