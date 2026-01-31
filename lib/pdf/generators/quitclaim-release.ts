/**
 * Quitclaim and Release PDF Generator
 *
 * Legal document for employee separation acknowledging receipt of final pay
 * and releasing the company from any further claims.
 */

import {
  createPDFDocument,
  addDocumentTitle,
  addParagraph,
  addPageFooter,
  addPageNumbers,
  pdfToBuffer,
} from "../index";

export interface QuitclaimEmployeeInfo {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  civilStatus?: "single" | "married" | "widowed" | "separated" | null;
  presentAddressLine1?: string | null;
  presentAddressLine2?: string | null;
  presentCity?: string | null;
  presentProvince?: string | null;
}

export interface QuitclaimCompanyInfo {
  name: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  province?: string | null;
}

export interface QuitclaimOptions {
  // Final pay amount
  lastPayAmount: number;

  // Separation details
  separationReason:
    | "resignation"
    | "end_of_contract"
    | "probation_failed"
    | "termination"
    | "redundancy"
    | "retrenchment";
  effectiveDate: string;

  // For probation failed
  evaluationNote?: string;

  // Location where signed
  signingLocation?: string;
  signingDate?: string;

  // Notary fields (optional - for notarized version)
  includeNotary?: boolean;

  // Manager and witnesses
  managerName?: string;
  managerPosition?: string;
  witness1Name?: string;
  witness1Position?: string;
  witness2Name?: string;
  witness2Position?: string;
}

export async function generateQuitclaimReleasePDF(
  employee: QuitclaimEmployeeInfo,
  company: QuitclaimCompanyInfo,
  options: QuitclaimOptions
): Promise<Buffer> {
  const doc = createPDFDocument({
    title: `Quitclaim and Release - ${employee.firstName} ${employee.lastName}`,
    author: company.name,
    subject: "Quitclaim and Release",
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

  const signingDate = options.signingDate || formattedDate;

  const employeeAddress = [
    employee.presentAddressLine1,
    employee.presentAddressLine2,
    employee.presentCity,
    employee.presentProvince,
  ]
    .filter(Boolean)
    .join(", ");

  const companyAddress = [
    company.addressLine1,
    company.addressLine2,
    company.city,
    company.province,
  ]
    .filter(Boolean)
    .join(", ");

  const signingLocation = options.signingLocation || companyAddress || "Philippines";

  const civilStatusLabels: Record<string, string> = {
    single: "single",
    married: "married",
    widowed: "widowed",
    separated: "separated",
  };

  const civilStatus = employee.civilStatus
    ? civilStatusLabels[employee.civilStatus]
    : "of legal age";

  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Get separation reason text
  const getSeparationReasonText = (): string => {
    switch (options.separationReason) {
      case "resignation":
        return "my voluntary resignation";
      case "end_of_contract":
        return "the expiration of my employment contract";
      case "probation_failed":
        return "my failure to qualify as a regular employee in accordance with the reasonable standards made known to me at the time of my engagement";
      case "termination":
        return "the termination of my employment";
      case "redundancy":
        return "redundancy of my position";
      case "retrenchment":
        return "the company's retrenchment program";
      default:
        return "the termination of my employment";
    }
  };

  // Title
  doc.moveDown(2);
  addDocumentTitle(doc, "QUITCLAIM AND RELEASE");

  doc.moveDown(1);

  // First paragraph - Introduction
  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor("#1a1a1a")
    .text(
      `I, `,
      50,
      doc.y,
      { continued: true }
    )
    .font("Helvetica-Bold")
    .text(fullName, { continued: true })
    .font("Helvetica")
    .text(
      `, of legal age, ${civilStatus} and residing at `,
      { continued: true }
    )
    .font("Helvetica-Oblique")
    .text(employeeAddress || "[Employee Address]", { continued: true })
    .font("Helvetica")
    .text(
      `, for and in consideration of the amount of `,
      { continued: true }
    )
    .font("Helvetica-Bold")
    .text(`₱${formatCurrency(options.lastPayAmount)}`, { continued: true })
    .font("Helvetica")
    .text(
      ` (Sum of Last Pay) paid to me by `,
      { continued: true }
    )
    .font("Helvetica-Bold")
    .text(company.name.toUpperCase(), { continued: true })
    .font("Helvetica")
    .text(
      ` and receipt of which is hereby acknowledged to my full and complete satisfaction, do hereby release and forever discharge said Company, its officers and stockholders from any and all claims arising out of and in connection with my dismissal.`,
      { lineGap: 4, align: "justify" }
    );

  doc.moveDown(1);

  // Second paragraph - Declaration of no further claims
  addParagraph(
    doc,
    `I hereby declare that I have no further claims whatsoever against my employer, ` +
      `its President, members of the Board, officers or any of its staff and that I hereby release ` +
      `and forever discharge all of them from any and all claims, demands, cause of action of ` +
      `whatever nature arising out of my employment with the latter;`,
    { align: "justify" }
  );

  doc.moveDown(0.5);

  // Third paragraph - Acknowledgment of separation reason
  const separationText =
    options.separationReason === "probation_failed" && options.evaluationNote
      ? `I acknowledge that my separation from the Company is due to ${getSeparationReasonText()}. ` +
        `${options.evaluationNote} ` +
        `I accept the results of the evaluation and the termination of my probationary employment ` +
        `effective ${options.effectiveDate}.`
      : `I acknowledge that my separation from the Company is due to ${getSeparationReasonText()}. ` +
        `I accept the terms of my separation effective ${options.effectiveDate}.`;

  addParagraph(doc, separationText, { align: "justify" });

  doc.moveDown(0.5);

  // Fourth paragraph - Final declaration
  addParagraph(
    doc,
    `As such, I finally make manifest that I have no further claim(s) or cause of action ` +
      `against my employer nor against any person(s) connected with the administration and ` +
      `operation of the latter and forever release the latter from any and all liability.`,
    { align: "justify" }
  );

  doc.moveDown(1);

  // Witness clause
  doc
    .font("Helvetica")
    .fontSize(11)
    .text(
      `IN WITNESS WHEREOF, I have hereunto signed these presents this `,
      50,
      doc.y,
      { continued: true }
    )
    .font("Helvetica-Bold")
    .text(signingDate, { continued: true })
    .font("Helvetica")
    .text(` at `, { continued: true })
    .font("Helvetica-Bold")
    .text(signingLocation, { continued: true })
    .font("Helvetica")
    .text(`.`, { lineGap: 4 });

  // Signature section
  doc.moveDown(3);

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#1a1a1a")
    .text("_____________________________________", 50, doc.y, { align: "center" });

  doc.moveDown(0.3);
  doc
    .font("Helvetica")
    .fontSize(10)
    .text("Name and signature of Employee", { align: "center" });

  doc.moveDown(2);

  // Witness section
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("SIGNED IN THE PRESENCE OF:", 50, doc.y);

  doc.moveDown(1.5);

  // Witness 1
  const witness1Name = options.witness1Name || "______________________";
  const witness1Position = options.witness1Position || "";
  doc
    .font("Helvetica")
    .fontSize(10)
    .text("_____________________________________", 50)
    .text(witness1Name, 50)
    .fillColor("#4a4a4a")
    .text(witness1Position || "Witness 1", 50);

  doc.fillColor("#1a1a1a");
  doc.moveDown(1);

  // Witness 2
  const witness2Name = options.witness2Name || "______________________";
  const witness2Position = options.witness2Position || "";
  doc
    .font("Helvetica")
    .fontSize(10)
    .text("_____________________________________", 50)
    .text(witness2Name, 50)
    .fillColor("#4a4a4a")
    .text(witness2Position || "Witness 2", 50);

  doc.fillColor("#1a1a1a");
  doc.moveDown(1.5);

  // Notary section (optional)
  if (options.includeNotary !== false) {
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("ACKNOWLEDGMENT", 50, doc.y, { align: "center" });

    doc.moveDown(0.5);

    const managerName = options.managerName || "[Manager Name]";
    const managerPosition = options.managerPosition || "[Manager Position]";

    doc
      .font("Helvetica")
      .fontSize(10)
      .text(
        `REPUBLIC OF THE PHILIPPINES )`,
        50
      )
      .text(`${signingLocation.toUpperCase()} ) S.S.`)
      .moveDown(0.5)
      .text(
        `BEFORE ME, a Notary Public for and in ${signingLocation}, Philippines, personally ` +
        `appeared the following persons with their respective competent evidence of identities:`
      );

    doc.moveDown(0.5);

    // Table of signatories
    doc
      .font("Helvetica")
      .fontSize(9)
      .text("NAME", 70, doc.y, { width: 200 })
      .text("COMPETENT EVIDENCE OF IDENTITY", 270, doc.y - 12, { width: 200 });

    doc.moveDown(0.5);

    doc
      .text(fullName, 70, doc.y, { width: 200 })
      .text("_______________________", 270, doc.y - 12, { width: 200 });

    doc.moveDown(0.3);

    doc
      .text(managerName, 70, doc.y, { width: 200 })
      .text("_______________________", 270, doc.y - 12, { width: 200 });

    doc.moveDown(0.5);

    doc
      .font("Helvetica")
      .fontSize(10)
      .text(
        `known to me and to me known to be the same persons who executed the foregoing instrument ` +
        `and acknowledged to me that the same is their free and voluntary act and deed.`,
        50
      );

    doc.moveDown(0.5);

    doc.text(
      `WITNESS MY HAND AND SEAL, this ${signingDate} at ${signingLocation}, Philippines.`
    );

    doc.moveDown(2);

    doc
      .font("Helvetica")
      .fontSize(10)
      .text("_____________________________________", 300)
      .text("NOTARY PUBLIC", 300);

    doc.moveDown(1.5);

    doc
      .font("Helvetica")
      .fontSize(9)
      .text("Doc. No. _____;", 50)
      .text("Page No. _____;")
      .text("Book No. _____;")
      .text("Series of 20___.");
  }

  // Page numbers
  addPageNumbers(doc);

  // Footer
  addPageFooter(doc, `${company.name} | Generated: ${formattedDate}`);

  return pdfToBuffer(doc);
}
