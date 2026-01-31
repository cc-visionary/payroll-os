/**
 * Memo PDF Generators
 * - Salary Change Memo
 * - Regularization Memo
 */

import {
  createPDFDocument,
  addCompanyHeader,
  addSectionHeading,
  addParagraph,
  addLabeledField,
  addSignatureBlock,
  addHorizontalRule,
  addPageFooter,
  pdfToBuffer,
} from "../index";

export interface MemoEmployeeInfo {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  employeeNumber: string;
  jobTitle?: string | null;
  department?: string | null;
}

export interface MemoCompanyInfo {
  name: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  province?: string | null;
}

export interface SalaryChangeOptions {
  effectiveDate: string;
  previousSalary?: number;
  newSalary?: number;
  reason?: string;
}

export interface RegularizationOptions {
  effectiveDate: string;
  probationStartDate?: string;
}

/**
 * Generate Salary Change Memorandum
 */
export async function generateSalaryChangMemoPDF(
  employee: MemoEmployeeInfo,
  company: MemoCompanyInfo,
  options?: SalaryChangeOptions
): Promise<Buffer> {
  const doc = createPDFDocument({
    title: `Salary Change Memo - ${employee.firstName} ${employee.lastName}`,
    author: company.name,
    subject: "Salary Change Memorandum",
  });

  const fullName = [employee.firstName, employee.middleName, employee.lastName]
    .filter(Boolean)
    .join(" ");

  const today = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Header
  addCompanyHeader(doc, company);

  // Memo header
  doc.moveDown(1);
  addSectionHeading(doc, "MEMORANDUM");

  doc.moveDown(0.5);
  addLabeledField(doc, "TO", fullName);
  addLabeledField(doc, "FROM", "Human Resources");
  addLabeledField(doc, "DATE", today);
  addLabeledField(doc, "SUBJECT", "Salary Adjustment Notice");

  addHorizontalRule(doc);

  doc.moveDown(1);
  addParagraph(doc, `Dear ${employee.firstName},`);

  doc.moveDown(0.5);
  addParagraph(
    doc,
    `This memorandum serves to inform you of a change in your compensation effective ` +
    `${options?.effectiveDate || "[EFFECTIVE DATE]"}.`
  );

  if (options?.previousSalary && options?.newSalary) {
    doc.moveDown(0.5);
    addParagraph(
      doc,
      `Your daily salary rate has been adjusted from PHP ${options.previousSalary.toLocaleString("en-PH", { minimumFractionDigits: 2 })} ` +
      `to PHP ${options.newSalary.toLocaleString("en-PH", { minimumFractionDigits: 2 })}.`
    );
  }

  if (options?.reason) {
    doc.moveDown(0.5);
    addParagraph(doc, `Reason: ${options.reason}`);
  }

  doc.moveDown(0.5);
  addParagraph(
    doc,
    "Please review the details and acknowledge receipt of this document by signing below."
  );

  doc.moveDown(0.5);
  addParagraph(doc, "For any questions, please contact the HR Department.");

  // Signatures
  doc.moveDown(2);
  addSignatureBlock(doc, "HR Manager", company.name);

  doc.moveDown(2);
  addParagraph(doc, "ACKNOWLEDGED AND RECEIVED BY:", { align: "left" });
  doc.moveDown(1);
  addSignatureBlock(doc, fullName, employee.jobTitle || undefined, true);

  // Footer
  addPageFooter(doc, `${company.name} | Generated: ${today}`);

  return pdfToBuffer(doc);
}

/**
 * Generate Regularization Memorandum
 */
export async function generateRegularizationMemoPDF(
  employee: MemoEmployeeInfo,
  company: MemoCompanyInfo,
  options?: RegularizationOptions
): Promise<Buffer> {
  const doc = createPDFDocument({
    title: `Regularization Memo - ${employee.firstName} ${employee.lastName}`,
    author: company.name,
    subject: "Regularization Memorandum",
  });

  const fullName = [employee.firstName, employee.middleName, employee.lastName]
    .filter(Boolean)
    .join(" ");

  const today = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Header
  addCompanyHeader(doc, company);

  // Memo header
  doc.moveDown(1);
  addSectionHeading(doc, "MEMORANDUM");

  doc.moveDown(0.5);
  addLabeledField(doc, "TO", fullName);
  addLabeledField(doc, "FROM", "Human Resources");
  addLabeledField(doc, "DATE", today);
  addLabeledField(doc, "SUBJECT", "Confirmation of Regular Employment");

  addHorizontalRule(doc);

  doc.moveDown(1);
  addParagraph(doc, `Dear ${employee.firstName},`);

  doc.moveDown(0.5);
  addParagraph(
    doc,
    `Congratulations! We are pleased to inform you that you have successfully completed your ` +
    `probationary period with ${company.name}.`
  );

  doc.moveDown(0.5);
  addParagraph(
    doc,
    `Effective ${options?.effectiveDate || "[EFFECTIVE DATE]"}, you are hereby confirmed as a ` +
    `REGULAR EMPLOYEE of the company.`
  );

  if (employee.jobTitle) {
    doc.moveDown(0.5);
    addParagraph(doc, `You will continue in your role as ${employee.jobTitle}.`);
  }

  doc.moveDown(0.5);
  addParagraph(
    doc,
    "As a regular employee, you are now entitled to additional benefits as outlined in the company's " +
    "employee handbook and policies."
  );

  doc.moveDown(0.5);
  addParagraph(
    doc,
    "We appreciate your dedication and hard work during your probationary period and look forward " +
    "to your continued contribution to our organization."
  );

  doc.moveDown(0.5);
  addParagraph(doc, "Please acknowledge receipt of this memorandum by signing below.");

  // Signatures
  doc.moveDown(2);
  addSignatureBlock(doc, "HR Manager", company.name);

  doc.moveDown(2);
  addParagraph(doc, "ACKNOWLEDGED AND RECEIVED BY:", { align: "left" });
  doc.moveDown(1);
  addSignatureBlock(doc, fullName, employee.jobTitle || undefined, true);

  // Footer
  addPageFooter(doc, `${company.name} | Generated: ${today}`);

  return pdfToBuffer(doc);
}
