/**
 * Offer Letter PDF Generator
 *
 * For managing new hires with formal job offers including compensation,
 * benefits, and required documents checklist.
 */

import {
  createPDFDocument,
  addCompanyHeader,
  addDocumentTitle,
  addSectionHeading,
  addParagraph,
  addLabeledField,
  addPageFooter,
  addPageNumbers,
  pdfToBuffer,
} from "../index";
import PDFDocument from "pdfkit";

export interface OfferLetterEmployeeInfo {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  email?: string | null;
  phone?: string | null;
  presentAddressLine1?: string | null;
  presentAddressLine2?: string | null;
  presentCity?: string | null;
  presentProvince?: string | null;
  hiringEntity?: string | null; // Legal entity name that hired the employee
}

export interface OfferLetterCompanyInfo {
  name: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  province?: string | null;
}

export interface OfferLetterOptions {
  // Position Details
  jobTitle: string;
  department?: string | null;
  reportsTo?: string | null;
  employmentType?: "probationary" | "regular" | "project_based" | "contractual";

  // Compensation
  dailySalaryRate: number;
  payFrequency?: "semi_monthly" | "monthly";

  // Dates
  targetStartDate: string;
  probationPeriodMonths?: number;

  // Work Schedule
  officeLocation?: string | null;
  workSchedule?: string | null; // e.g., "Monday to Saturday, 9:00 AM - 6:00 PM"

  // Benefits
  benefits?: string[];

  // Required Documents
  requiredDocuments?: string[];

  // Offer validity
  offerValidUntil?: string;

  // Signatory
  hrManagerName?: string;
  hrManagerTitle?: string;
}

// Helper function to add a checklist item
function addChecklistItem(
  doc: typeof PDFDocument.prototype,
  text: string,
  x: number,
  y: number
): number {
  const boxSize = 10;

  // Draw checkbox
  doc
    .strokeColor("#4a4a4a")
    .lineWidth(1)
    .rect(x, y, boxSize, boxSize)
    .stroke();

  // Add text
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#1a1a1a")
    .text(text, x + boxSize + 8, y, { width: 420, lineGap: 2 });

  return doc.y;
}

export async function generateOfferLetterPDF(
  candidate: OfferLetterEmployeeInfo,
  company: OfferLetterCompanyInfo,
  options: OfferLetterOptions
): Promise<Buffer> {
  const doc = createPDFDocument({
    title: `Offer Letter - ${candidate.firstName} ${candidate.lastName}`,
    author: company.name,
    subject: "Employment Offer Letter",
  });

  const fullName = [candidate.firstName, candidate.middleName, candidate.lastName]
    .filter(Boolean)
    .join(" ");

  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const candidateAddress = [
    candidate.presentAddressLine1,
    candidate.presentAddressLine2,
    candidate.presentCity,
    candidate.presentProvince,
  ]
    .filter(Boolean)
    .join(", ");

  const hrManagerName = options.hrManagerName || "Brixter Del Mundo";
  const hrManagerTitle = options.hrManagerTitle || "People Manager";

  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Calculate monthly equivalent (26 working days)
  const monthlyEquivalent = options.dailySalaryRate * 26;

  // Default benefits if not provided
  const benefits = options.benefits || [
    "Health Maintenance Organization (HMO) coverage upon regularization",
    "Service Incentive Leave (SIL) as per Philippine labor law",
    "13th Month Pay",
    "Government-mandated benefits (SSS, PhilHealth, Pag-IBIG)",
  ];

  // Default required documents if not provided
  const requiredDocuments = options.requiredDocuments || [
    "Updated Resume/CV",
    "2x2 ID Photos (4 pieces)",
    "Valid Government-issued IDs (2 types)",
    "Birth Certificate (PSA/NSO authenticated)",
    "NBI Clearance (dated within 6 months)",
    "SSS E-1 / E-4 Form or SSS Number",
    "PhilHealth MDR or PhilHealth Number",
    "Pag-IBIG MID Number",
    "TIN (Tax Identification Number)",
    "Certificate of Employment from previous employer (if applicable)",
    "Diploma / Transcript of Records",
    "BIR Form 2316 from previous employer (if applicable)",
  ];

  const probationMonths = options.probationPeriodMonths || 6;

  // Header
  addCompanyHeader(doc, company);

  // Title
  addDocumentTitle(doc, "OFFER LETTER");

  // Date
  doc.moveDown(0.5);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#4a4a4a")
    .text(formattedDate, { align: "left" });

  doc.moveDown(1);

  // Recipient Info
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#1a1a1a")
    .text(fullName);

  if (candidateAddress) {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#4a4a4a")
      .text(candidateAddress);
  }

  if (candidate.email) {
    doc.text(candidate.email);
  }

  if (candidate.phone) {
    doc.text(candidate.phone);
  }

  doc.moveDown(1.5);

  // Salutation
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#1a1a1a")
    .text(`Dear ${candidate.firstName},`);

  doc.moveDown(0.5);

  // Opening paragraph
  addParagraph(
    doc,
    `We are pleased to extend to you this offer of employment with ${company.name}. ` +
      `After careful consideration of your qualifications, we believe you would be a valuable ` +
      `addition to our team. Below are the details of your employment offer:`
  );

  // Position Details Section
  addSectionHeading(doc, "Position Details", 2);

  const leftCol = 50;
  const rightCol = 180;
  let currentY = doc.y + 5;

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#4a4a4a")
    .text("Position:", leftCol, currentY);
  doc
    .font("Helvetica")
    .fillColor("#1a1a1a")
    .text(options.jobTitle, rightCol, currentY);

  currentY = doc.y + 3;
  if (options.department) {
    doc
      .font("Helvetica-Bold")
      .fillColor("#4a4a4a")
      .text("Department:", leftCol, currentY);
    doc
      .font("Helvetica")
      .fillColor("#1a1a1a")
      .text(options.department, rightCol, currentY);
    currentY = doc.y + 3;
  }

  if (options.reportsTo) {
    doc
      .font("Helvetica-Bold")
      .fillColor("#4a4a4a")
      .text("Reports To:", leftCol, currentY);
    doc
      .font("Helvetica")
      .fillColor("#1a1a1a")
      .text(options.reportsTo, rightCol, currentY);
    currentY = doc.y + 3;
  }

  const employmentTypeLabels: Record<string, string> = {
    probationary: "Probationary",
    regular: "Regular",
    project_based: "Project-Based",
    contractual: "Contractual",
  };

  doc
    .font("Helvetica-Bold")
    .fillColor("#4a4a4a")
    .text("Employment Status:", leftCol, currentY);
  doc
    .font("Helvetica")
    .fillColor("#1a1a1a")
    .text(
      employmentTypeLabels[options.employmentType || "probationary"],
      rightCol,
      currentY
    );

  currentY = doc.y + 3;
  doc
    .font("Helvetica-Bold")
    .fillColor("#4a4a4a")
    .text("Target Start Date:", leftCol, currentY);
  doc
    .font("Helvetica")
    .fillColor("#1a1a1a")
    .text(options.targetStartDate, rightCol, currentY);

  doc.y = doc.y + 10;

  // Compensation Section
  addSectionHeading(doc, "Compensation", 2);

  currentY = doc.y + 5;

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#4a4a4a")
    .text("Daily Rate:", leftCol, currentY);
  doc
    .font("Helvetica")
    .fillColor("#1a1a1a")
    .text(`PHP ${formatCurrency(options.dailySalaryRate)}`, rightCol, currentY);

  currentY = doc.y + 3;
  doc
    .font("Helvetica-Bold")
    .fillColor("#4a4a4a")
    .text("Monthly Equivalent:", leftCol, currentY);
  doc
    .font("Helvetica")
    .fillColor("#1a1a1a")
    .text(
      `PHP ${formatCurrency(monthlyEquivalent)} (based on 26 working days)`,
      rightCol,
      currentY
    );

  currentY = doc.y + 3;
  doc
    .font("Helvetica-Bold")
    .fillColor("#4a4a4a")
    .text("Pay Frequency:", leftCol, currentY);
  doc
    .font("Helvetica")
    .fillColor("#1a1a1a")
    .text(
      options.payFrequency === "monthly" ? "Monthly" : "Semi-Monthly (15th and 30th)",
      rightCol,
      currentY
    );

  doc.y = doc.y + 10;

  // Work Schedule Section
  if (options.officeLocation || options.workSchedule) {
    addSectionHeading(doc, "Work Schedule", 2);

    currentY = doc.y + 5;

    if (options.officeLocation) {
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#4a4a4a")
        .text("Office Location:", leftCol, currentY);
      doc
        .font("Helvetica")
        .fillColor("#1a1a1a")
        .text(options.officeLocation, rightCol, currentY, { width: 350 });
      currentY = doc.y + 3;
    }

    if (options.workSchedule) {
      doc
        .font("Helvetica-Bold")
        .fillColor("#4a4a4a")
        .text("Working Hours:", leftCol, currentY);
      doc
        .font("Helvetica")
        .fillColor("#1a1a1a")
        .text(options.workSchedule, rightCol, currentY, { width: 350 });
    }

    doc.y = doc.y + 10;
  }

  // Probationary Period
  addSectionHeading(doc, "Probationary Period", 2);

  addParagraph(
    doc,
    `Your employment will begin with a probationary period of ${probationMonths} months. ` +
      `During this time, your performance will be evaluated against the requirements of the position. ` +
      `Upon successful completion of the probationary period, you will be considered for regularization.`
  );

  // Benefits Section
  addSectionHeading(doc, "Benefits", 2);

  addParagraph(doc, "Upon joining, you will be entitled to the following benefits:");

  doc.moveDown(0.3);

  benefits.forEach((benefit) => {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#1a1a1a")
      .text(`• ${benefit}`, 70, doc.y, { width: 450, lineGap: 2 });
    doc.moveDown(0.2);
  });

  // Check if we need a new page for required documents
  if (doc.y > doc.page.height - 400) {
    doc.addPage();
  }

  // Required Documents Section
  addSectionHeading(doc, "Required Documents", 2);

  addParagraph(
    doc,
    "Please prepare and submit the following documents on or before your first day of work:"
  );

  doc.moveDown(0.5);

  currentY = doc.y;
  requiredDocuments.forEach((docItem, index) => {
    currentY = addChecklistItem(doc, docItem, 70, currentY);
    currentY = doc.y + 5;

    // Check for page break
    if (currentY > doc.page.height - 150 && index < requiredDocuments.length - 1) {
      doc.addPage();
      currentY = doc.y;
    }
  });

  doc.y = currentY + 10;

  // Offer Validity
  if (options.offerValidUntil) {
    addParagraph(
      doc,
      `This offer is valid until ${options.offerValidUntil}. ` +
        `Please indicate your acceptance by signing below and returning a copy of this letter.`
    );
  } else {
    addParagraph(
      doc,
      `Please indicate your acceptance by signing below and returning a copy of this letter ` +
        `within five (5) business days of receipt.`
    );
  }

  // Closing
  doc.moveDown(1);
  addParagraph(
    doc,
    `We are excited about the possibility of you joining our team and look forward to your ` +
      `positive response. Should you have any questions regarding this offer, please do not ` +
      `hesitate to contact us.`
  );

  doc.moveDown(1);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#1a1a1a")
    .text("Sincerely,");

  doc.moveDown(2);

  // HR Signature
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("_____________________________");
  doc.text(hrManagerName);
  doc
    .font("Helvetica")
    .fillColor("#4a4a4a")
    .text(hrManagerTitle);
  doc.text(company.name);

  // Check if we need a new page for acceptance
  if (doc.y > doc.page.height - 200) {
    doc.addPage();
  }

  // Acceptance Section
  doc.moveDown(2);
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#1a1a1a")
    .text("ACCEPTANCE", { align: "center" });

  doc.moveDown(1);
  addParagraph(
    doc,
    `I, ${fullName}, hereby accept the offer of employment as ${options.jobTitle} ` +
      `with ${company.name} under the terms and conditions stated above.`
  );

  doc.moveDown(2);

  // Candidate Signature
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#1a1a1a")
    .text("_____________________________", 50);
  doc.text(fullName);
  doc
    .font("Helvetica")
    .fillColor("#4a4a4a")
    .text("Signature over Printed Name");

  doc.moveDown(1);
  doc
    .font("Helvetica-Bold")
    .fillColor("#1a1a1a")
    .text("Date: _____________________________", 50);

  // Page numbers
  addPageNumbers(doc);

  // Footer
  addPageFooter(doc, `${company.name} | Generated: ${formattedDate}`);

  return pdfToBuffer(doc);
}
