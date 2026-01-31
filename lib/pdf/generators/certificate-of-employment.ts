/**
 * Certificate of Employment (COE) PDF Generator
 */

import {
  createPDFDocument,
  addCompanyHeader,
  addDocumentTitle,
  addParagraph,
  addSignatureBlock,
  addPageFooter,
  pdfToBuffer,
} from "../index";

export interface COEEmployeeInfo {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  employeeNumber: string;
  jobTitle?: string | null;
  hireDate: Date;
  department?: string | null;
  hiringEntity?: string | null; // Legal entity name that hired the employee
}

export interface COECompanyInfo {
  name: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  province?: string | null;
}

export async function generateCertificateOfEmploymentPDF(
  employee: COEEmployeeInfo,
  company: COECompanyInfo
): Promise<Buffer> {
  const doc = createPDFDocument({
    title: `Certificate of Employment - ${employee.firstName} ${employee.lastName}`,
    author: company.name,
    subject: "Certificate of Employment",
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
  doc.moveDown(2);
  addDocumentTitle(doc, "Certificate of Employment");

  // Date
  doc.moveDown(1);
  addParagraph(doc, `Date: ${today}`, { align: "left" });

  doc.moveDown(1);
  addParagraph(doc, "TO WHOM IT MAY CONCERN:", { align: "left" });

  doc.moveDown(1);

  // Determine display company name based on hiring entity
  const hiringEntityName = employee.hiringEntity === "LUXIUM" ? "Luxium" : "GameCove";
  const displayCompanyName = employee.hiringEntity ? `${hiringEntityName} (${company.name})` : company.name;

  // Main content
  addParagraph(
    doc,
    `This is to certify that ${fullName.toUpperCase()} (Employee No. ${employee.employeeNumber}) ` +
    `has been employed with ${displayCompanyName} since ${hireDate}.`
  );

  doc.moveDown(0.5);

  if (employee.jobTitle && employee.department) {
    addParagraph(
      doc,
      `${fullName} currently holds the position of ${employee.jobTitle} in the ${employee.department} department.`
    );
  } else if (employee.jobTitle) {
    addParagraph(doc, `${fullName} currently holds the position of ${employee.jobTitle}.`);
  } else if (employee.department) {
    addParagraph(doc, `${fullName} is currently assigned to the ${employee.department} department.`);
  }

  doc.moveDown(0.5);

  addParagraph(
    doc,
    "This certificate is issued upon the request of the above-named employee for whatever legal " +
    "purpose it may serve."
  );

  // Signature
  doc.moveDown(3);
  addSignatureBlock(doc, "Authorized Signatory", company.name);

  // Footer
  addPageFooter(doc, `${company.name} | Generated: ${today}`);

  return pdfToBuffer(doc);
}
