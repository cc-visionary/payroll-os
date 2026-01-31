/**
 * Employee Acknowledgment and Repayment Agreement PDF Generator
 *
 * For tracking employee financial obligations (e.g., damage to property,
 * cash shortages, etc.) with repayment options.
 */

import {
  createPDFDocument,
  addCompanyHeader,
  addDocumentTitle,
  addSectionHeading,
  addParagraph,
  addLabeledField,
  addTable,
  addDualSignatureBlock,
  addPageFooter,
  addPageNumbers,
  pdfToBuffer,
} from "../index";
import PDFDocument from "pdfkit";

export interface RepaymentEmployeeInfo {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  employeeNumber: string;
  jobTitle?: string | null;
  department?: string | null;
}

export interface RepaymentCompanyInfo {
  name: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  province?: string | null;
}

export interface RepaymentItem {
  date: string;
  explanation: string;
  amount: number;
}

export interface RepaymentAgreementOptions {
  items: RepaymentItem[];
  totalAmount: number;
  repaymentMethod: "lump_sum" | "salary_deduction" | "thirteenth_month";
  // For lump sum
  lumpSumDueDate?: string;
  // For salary deduction
  installmentAmount?: number;
  installmentStartDate?: string;
  // CEO/Authorized signatory
  authorizedSignatoryName?: string;
  authorizedSignatoryTitle?: string;
}

// Helper to add checkbox
function addCheckbox(
  doc: typeof PDFDocument.prototype,
  label: string,
  x: number,
  y: number,
  checked: boolean = false,
  description?: string
): number {
  const boxSize = 12;

  // Draw checkbox
  doc
    .strokeColor("#4a4a4a")
    .lineWidth(1)
    .rect(x, y, boxSize, boxSize)
    .stroke();

  // Draw checkmark if checked
  if (checked) {
    doc
      .strokeColor("#1a1a1a")
      .lineWidth(2)
      .moveTo(x + 2, y + 6)
      .lineTo(x + 5, y + 10)
      .lineTo(x + 10, y + 2)
      .stroke();
  }

  // Label (bold)
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#1a1a1a")
    .text(label, x + boxSize + 8, y + 1, { continued: !!description });

  if (description) {
    doc
      .font("Helvetica")
      .fontSize(10)
      .text(`: ${description}`, { lineGap: 2 });
  }

  return doc.y;
}

export async function generateRepaymentAgreementPDF(
  employee: RepaymentEmployeeInfo,
  company: RepaymentCompanyInfo,
  options: RepaymentAgreementOptions
): Promise<Buffer> {
  const doc = createPDFDocument({
    title: `Repayment Agreement - ${employee.firstName} ${employee.lastName}`,
    author: company.name,
    subject: "Employee Acknowledgment and Repayment Agreement",
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

  const companyAddress = [
    company.addressLine1,
    company.addressLine2,
    company.city,
    company.province,
  ]
    .filter(Boolean)
    .join(", ");

  const authorizedName = options.authorizedSignatoryName || "[Authorized Signatory]";
  const authorizedTitle = options.authorizedSignatoryTitle || "CEO";

  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Header
  addCompanyHeader(doc, company);

  // Title
  addDocumentTitle(doc, "Employee Acknowledgment and Repayment Agreement");

  // Introduction
  doc.moveDown(0.5);
  addParagraph(
    doc,
    `This Employee Acknowledgment and Repayment Agreement (the "Agreement") is made and entered ` +
      `into on this ${today.getDate()} day of ${today.toLocaleDateString("en-PH", { month: "long" })}, ` +
      `${today.getFullYear()}, by and between ${company.name}, a company organized and existing ` +
      `under the laws of the Philippines with its principal place of business at ${companyAddress || "[Company Address]"} ` +
      `(the "Company"), and ${fullName} (the "Employee").`
  );

  // Section 1: Reason for Deduction
  addSectionHeading(doc, "1. Reason for Deduction", 2);

  addParagraph(
    doc,
    `The Employee acknowledges that a financial loss was incurred by the Company due to ` +
      `the following actions or omissions on their part:`
  );

  doc.moveDown(0.5);

  // Items table
  if (options.items.length > 0) {
    addTable(
      doc,
      ["Date", "Explanation", "Amount Loss (PHP)"],
      options.items.map((item) => [
        item.date,
        item.explanation,
        formatCurrency(item.amount),
      ]),
      [80, 300, 115]
    );
  }

  // Section 2: Acknowledgment of Responsibility
  addSectionHeading(doc, "2. Acknowledgment of Responsibility", 2);

  addParagraph(
    doc,
    `The Employee hereby acknowledges that they caused a financial loss to the Company due to ` +
      `their actions or omissions in the performance of their duties. This loss has been valued at ` +
      `PHP ${formatCurrency(options.totalAmount)}, which the Employee agrees to repay under the terms stated below.`
  );

  // Section 3: Repayment Options
  addSectionHeading(doc, "3. Repayment Options", 2);

  addParagraph(
    doc,
    `The Employee agrees to reimburse the Company for the loss incurred by selecting one ` +
      `of the following repayment options:`
  );

  doc.moveDown(0.5);

  const startX = 70;
  let currentY = doc.y;

  // Lump Sum Option
  addCheckbox(
    doc,
    "Lump Sum Payment",
    startX,
    currentY,
    options.repaymentMethod === "lump_sum"
  );
  currentY = doc.y + 5;
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#4a4a4a")
    .text(
      `The Employee agrees to pay the full amount of PHP ${formatCurrency(options.totalAmount)} ` +
        `on or before ${options.lumpSumDueDate || "[Due Date]"}.`,
      startX + 20,
      currentY,
      { width: 400, lineGap: 2 }
    );
  currentY = doc.y + 15;

  // Salary Deduction Option
  addCheckbox(
    doc,
    "Salary Deductions",
    startX,
    currentY,
    options.repaymentMethod === "salary_deduction"
  );
  currentY = doc.y + 5;
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#4a4a4a")
    .text(
      `The Employee agrees to repay the amount through deductions from their regular monthly salary. ` +
        `Deductions will be made in installments of PHP ${formatCurrency(options.installmentAmount || 0)} ` +
        `per pay period, beginning ${options.installmentStartDate || "[Start Date]"} and continuing ` +
        `until the full amount is paid.`,
      startX + 20,
      currentY,
      { width: 400, lineGap: 2 }
    );
  currentY = doc.y + 15;

  // 13th Month Option
  addCheckbox(
    doc,
    "Deduction from 13th-Month Pay",
    startX,
    currentY,
    options.repaymentMethod === "thirteenth_month"
  );
  currentY = doc.y + 5;
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#4a4a4a")
    .text(
      `The Employee agrees to have a portion or the entirety of their 13th-month pay deducted ` +
        `to cover the outstanding amount, either partially or fully as required.`,
      startX + 20,
      currentY,
      { width: 400, lineGap: 2 }
    );

  doc.y = doc.y + 15;

  addParagraph(
    doc,
    `The chosen repayment option must be selected by checking the appropriate box and ` +
      `will be documented as a binding choice.`
  );

  // Check if we need a new page
  if (doc.y > doc.page.height - 400) {
    doc.addPage();
  }

  // Section 4: Adjustment of Repayment Schedule
  addSectionHeading(doc, "4. Adjustment of Repayment Schedule", 2);

  addParagraph(
    doc,
    `The Employee may request an adjustment of the repayment schedule due to financial hardship. ` +
      `Any such request must be submitted in writing and is subject to approval by the Company. ` +
      `The Company reserves the right to approve or deny any request based on a review of the ` +
      `Employee's financial situation.`
  );

  // Section 5: Acknowledgment of Responsibility and Compliance
  addSectionHeading(doc, "5. Acknowledgment of Responsibility and Compliance", 2);

  addParagraph(
    doc,
    `The Employee understands that this Agreement does not alter the terms of their existing ` +
      `Employment Contract and is an acknowledgment of responsibility for their actions. This ` +
      `Agreement serves as a commitment to comply with the repayment terms as outlined.`
  );

  // Section 6: Non-Compliance
  addSectionHeading(doc, "6. Non-Compliance", 2);

  addParagraph(
    doc,
    `In the event of non-compliance with the repayment terms, the Company reserves the right ` +
      `to pursue additional legal remedies available under Philippine law.`
  );

  // Section 7: Binding Agreement
  addSectionHeading(doc, "7. Binding Agreement", 2);

  addParagraph(
    doc,
    `This Agreement is binding upon the Employee and the Company and remains in effect ` +
      `until the amount is repaid in full.`
  );

  // Check if we need a new page
  if (doc.y > doc.page.height - 350) {
    doc.addPage();
  }

  // Section 8: Non-Voluntary Termination Clause
  addSectionHeading(doc, "8. Non-Voluntary Termination Clause", 2);

  addParagraph(
    doc,
    `The Employee agrees that they will not voluntarily resign from the Company until the ` +
      `total outstanding balance is fully repaid. Should the Employee choose to resign before ` +
      `completing the repayment, the following conditions will apply:`
  );

  doc.moveDown(0.3);

  // Sub-points
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#1a1a1a")
    .text("1. Immediate Payment Due:", 70, doc.y);
  doc
    .font("Helvetica")
    .fontSize(10)
    .text(
      `The remaining balance of the outstanding amount will become immediately due and payable ` +
        `upon resignation. The Employee agrees to settle this balance before their last working day, ` +
        `or to authorize the Company to deduct the remaining balance from any final pay, 13th-month pay, ` +
        `or other due compensation.`,
      { indent: 20, lineGap: 2 }
    );

  doc.moveDown(0.5);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("2. Legal Action:", 70, doc.y);
  doc
    .font("Helvetica")
    .fontSize(10)
    .text(
      `If the Employee fails to repay the remaining balance upon resignation, the Company reserves ` +
        `the right to pursue legal action to recover the unpaid amount, as permitted by Philippine law.`,
      { indent: 20, lineGap: 2 }
    );

  doc.moveDown(0.5);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("3. Exceptions:", 70, doc.y);
  doc
    .font("Helvetica")
    .fontSize(10)
    .text(
      `This clause does not restrict the Company's right to terminate the Employee for cause or ` +
        `other reasons unrelated to this Agreement. In the event of termination by the Company, ` +
        `the remaining balance shall still be due, and the Employee will be required to settle it ` +
        `immediately or through an agreed-upon payment schedule.`,
      { indent: 20, lineGap: 2 }
    );

  // Signature section
  doc.moveDown(2);
  addParagraph(
    doc,
    `IN WITNESS WHEREOF, the parties hereto have executed this Agreement on the date first above written.`
  );

  doc.moveDown(2);
  addDualSignatureBlock(
    doc,
    { name: authorizedName, title: `${authorizedTitle}\n${company.name}` },
    { name: fullName, title: employee.jobTitle || "Employee" }
  );

  // Add date lines below signatures
  doc.moveDown(1);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#4a4a4a")
    .text("Date: _____________________", 50)
    .text("Date: _____________________", 300, doc.y - 12);

  // Page numbers
  addPageNumbers(doc);

  // Footer
  addPageFooter(doc, `${company.name} | Generated: ${formattedDate}`);

  return pdfToBuffer(doc);
}
