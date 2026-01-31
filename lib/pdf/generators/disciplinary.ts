/**
 * Disciplinary Document PDF Generators
 * - Disciplinary Warning Letter
 * - Disciplinary Action Letter (with Suspension)
 */

import {
  createPDFDocument,
  addCompanyHeader,
  addDocumentTitle,
  addSectionHeading,
  addParagraph,
  addBulletList,
  addNumberedList,
  addLabeledField,
  addSignatureBlock,
  addHorizontalRule,
  addPageFooter,
  pdfToBuffer,
} from "../index";

export interface DisciplinaryEmployeeInfo {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  employeeNumber: string;
  jobTitle?: string | null;
  department?: string | null;
}

export interface DisciplinaryCompanyInfo {
  name: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  province?: string | null;
}

export interface DisciplinaryWarningOptions {
  unsatisfactoryAspects: string[];
  suggestionsForImprovement: string[];
  improvementPeriodDays?: number;
  improvementDeadlineDate?: string;
  requiresWrittenExplanation?: boolean;
  hrManagerName?: string;
  hrManagerTitle?: string;
}

export interface DisciplinaryActionOptions {
  violations: Array<{
    title: string;
    description: string;
  }>;
  suspensionDays?: number;
  suspensionStartDate?: string;
  suspensionEndDate?: string;
  isUnpaid?: boolean;
  requiredActions: string[];
  hrManagerName?: string;
  hrManagerTitle?: string;
}

/**
 * Generate Disciplinary Warning Letter
 */
export async function generateDisciplinaryWarningPDF(
  employee: DisciplinaryEmployeeInfo,
  company: DisciplinaryCompanyInfo,
  options: DisciplinaryWarningOptions
): Promise<Buffer> {
  const doc = createPDFDocument({
    title: `Disciplinary Warning - ${employee.firstName} ${employee.lastName}`,
    author: company.name,
    subject: "Disciplinary Warning Letter",
  });

  const fullName = [employee.firstName, employee.middleName, employee.lastName]
    .filter(Boolean)
    .join(" ");

  const today = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const hrManager = options.hrManagerName || "HR Manager";
  const hrTitle = options.hrManagerTitle || "People Manager";
  const improvementDays = options.improvementPeriodDays || 30;

  // Header
  addCompanyHeader(doc, company);

  // Title
  addDocumentTitle(doc, "Disciplinary Warning Letter");

  // Greeting
  doc.moveDown(1);
  addParagraph(doc, `Dear ${fullName}:`);

  doc.moveDown(0.5);

  // Opening paragraph
  addParagraph(
    doc,
    `This letter is to draw your attention to certain unsatisfactory aspects of your current job ` +
      `performance during the past month, specifically:`
  );

  // List unsatisfactory aspects
  doc.moveDown(0.5);
  addBulletList(doc, options.unsatisfactoryAspects);

  doc.moveDown(0.5);

  // Suggestions for improvement
  addParagraph(
    doc,
    `In order to improve your performance, we require the following during the next ` +
      `${improvementDays} day period:`
  );

  doc.moveDown(0.5);
  addBulletList(doc, options.suggestionsForImprovement);

  doc.moveDown(0.5);

  // Support and consequences
  addParagraph(
    doc,
    `We will assist you in any reasonable way to meet the Company's requirements. However, ` +
      `we will conduct a further investigation regarding the concern. Further violations may result ` +
      `in immediate dismissal.`
  );

  doc.moveDown(0.5);

  if (options.improvementDeadlineDate) {
    addParagraph(
      doc,
      `If your job performance does not significantly improve by ${options.improvementDeadlineDate}, ` +
        `we will have no alternative but to terminate your employment for cause.`
    );
  } else {
    addParagraph(
      doc,
      `If your job performance does not significantly improve within the specified period, ` +
        `we will have no alternative but to terminate your employment for cause.`
    );
  }

  // Written explanation requirement
  if (options.requiresWrittenExplanation !== false) {
    doc.moveDown(0.5);
    addParagraph(
      doc,
      `You are required to write a letter to explain/reason out for your actions. Without ` +
        `submitting your written letter you are not allowed to resume your duties.`
    );
  }

  // Closing
  doc.moveDown(1.5);
  addParagraph(doc, "Yours truly,", { align: "left" });

  doc.moveDown(2);
  addSignatureBlock(doc, hrManager, hrTitle);

  // Employee acknowledgment section
  addHorizontalRule(doc);

  doc.moveDown(1);
  addParagraph(
    doc,
    `I have read and understood the nature of this warning. I have made my comments on ` +
      `the back of this letter.`
  );

  doc.moveDown(2);
  addSignatureBlock(doc, fullName, employee.jobTitle || undefined, true);

  // Footer
  addPageFooter(doc, `${company.name} | Generated: ${today}`);

  return pdfToBuffer(doc);
}

/**
 * Generate Disciplinary Action Letter (with Suspension)
 */
export async function generateDisciplinaryActionPDF(
  employee: DisciplinaryEmployeeInfo,
  company: DisciplinaryCompanyInfo,
  options: DisciplinaryActionOptions
): Promise<Buffer> {
  const doc = createPDFDocument({
    title: `Disciplinary Action - ${employee.firstName} ${employee.lastName}`,
    author: company.name,
    subject: "Disciplinary Action Letter",
  });

  const fullName = [employee.firstName, employee.middleName, employee.lastName]
    .filter(Boolean)
    .join(" ");

  const today = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const hrManager = options.hrManagerName || "HR Manager";
  const hrTitle = options.hrManagerTitle || "People Manager";

  // Header
  addCompanyHeader(doc, company);

  // Memo header fields
  doc.moveDown(1);
  addLabeledField(doc, "Date", today, 80);
  addLabeledField(doc, "To", fullName, 80);
  addLabeledField(doc, "From", hrManager, 80);
  addLabeledField(
    doc,
    "Subject",
    "Disciplinary Action - Suspension Due to Policy Violations",
    80
  );

  addHorizontalRule(doc);

  // Greeting
  doc.moveDown(0.5);
  addParagraph(doc, `Dear ${fullName},`);

  doc.moveDown(0.5);

  // Opening paragraph
  addParagraph(
    doc,
    `This letter is to formally inform you of a disciplinary action being taken due to significant ` +
      `violations of company policies, as outlined below. After careful consideration and multiple ` +
      `discussions regarding expected conduct and responsibilities, it has been determined that a ` +
      `suspension is warranted due to continued non-compliance and misconduct.`
  );

  // Violations section
  doc.moveDown(0.5);
  addSectionHeading(doc, "Violations Noted:", 2);

  options.violations.forEach((violation, index) => {
    doc.moveDown(0.3);
    addParagraph(doc, `${index + 1}. ${violation.title}`, { align: "left" });
    addParagraph(doc, violation.description, { indent: 20 });
  });

  // Required Actions section
  doc.moveDown(0.5);
  addSectionHeading(doc, "Required Actions:", 2);

  // Suspension details
  if (options.suspensionDays) {
    doc.moveDown(0.3);
    addParagraph(doc, "1. Suspension", { align: "left" });

    let suspensionText = `Effective immediately, you are suspended from duties for ${options.suspensionDays} working days.`;

    if (options.suspensionStartDate && options.suspensionEndDate) {
      suspensionText += ` You are not to report to work starting ${options.suspensionStartDate} until ${options.suspensionEndDate}.`;
    }

    addParagraph(doc, suspensionText, { indent: 20 });

    if (options.isUnpaid !== false) {
      addParagraph(
        doc,
        `Please note that this suspension is unpaid. You will not receive compensation for the ` +
          `duration of the suspension period.`,
        { indent: 20 }
      );
    }
  }

  // Other required actions
  const actionStartIndex = options.suspensionDays ? 2 : 1;
  options.requiredActions.forEach((action, index) => {
    doc.moveDown(0.3);
    addParagraph(doc, `${actionStartIndex + index}. ${action}`, {
      align: "left",
    });
  });

  // Check if we need a new page
  if (doc.y > doc.page.height - 250) {
    doc.addPage();
  }

  // Commitment statement
  doc.moveDown(0.5);
  addParagraph(
    doc,
    `We are committed to supporting you in meeting the company's standards. However, any further ` +
      `policy violations will result in more severe consequences.`
  );

  doc.moveDown(0.5);
  addParagraph(
    doc,
    `Please acknowledge receipt of this letter by signing below and return a copy to HR.`
  );

  // Closing
  doc.moveDown(1);
  addParagraph(doc, "Sincerely,", { align: "left" });

  doc.moveDown(2);
  addSignatureBlock(doc, hrManager, hrTitle);

  // Employee acknowledgment section
  addHorizontalRule(doc);

  addSectionHeading(doc, "Employee Acknowledgment:", 2);

  addParagraph(
    doc,
    `I have read and understood the contents of this letter and the nature of the disciplinary action. ` +
      `I have noted my comments on the reverse side of this letter.`
  );

  doc.moveDown(2);
  addSignatureBlock(doc, fullName, employee.jobTitle || undefined, true);

  // Footer
  addPageFooter(doc, `${company.name} | Generated: ${today}`);

  return pdfToBuffer(doc);
}

/**
 * Generate Notice to Explain (NTE) Letter
 */
export async function generateNoticeToExplainPDF(
  employee: DisciplinaryEmployeeInfo,
  company: DisciplinaryCompanyInfo,
  options: {
    incidentDate: string;
    incidentDescription: string;
    allegedViolations: string[];
    responseDeadline: string;
    hrManagerName?: string;
    hrManagerTitle?: string;
  }
): Promise<Buffer> {
  const doc = createPDFDocument({
    title: `Notice to Explain - ${employee.firstName} ${employee.lastName}`,
    author: company.name,
    subject: "Notice to Explain",
  });

  const fullName = [employee.firstName, employee.middleName, employee.lastName]
    .filter(Boolean)
    .join(" ");

  const today = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const hrManager = options.hrManagerName || "HR Manager";
  const hrTitle = options.hrManagerTitle || "People Manager";

  // Header
  addCompanyHeader(doc, company);

  // Title
  addDocumentTitle(doc, "Notice to Explain (NTE)");

  // Memo header
  doc.moveDown(1);
  addLabeledField(doc, "Date", today, 80);
  addLabeledField(doc, "To", fullName, 80);
  addLabeledField(doc, "From", hrManager, 80);
  addLabeledField(doc, "Subject", "Notice to Explain", 80);

  addHorizontalRule(doc);

  // Greeting
  doc.moveDown(0.5);
  addParagraph(doc, `Dear ${fullName},`);

  doc.moveDown(0.5);

  // Opening
  addParagraph(
    doc,
    `This is to formally notify you that the company is requiring you to explain in writing ` +
      `regarding the following incident/behavior:`
  );

  doc.moveDown(0.5);

  // Incident details
  addSectionHeading(doc, "Incident Details:", 2);
  addLabeledField(doc, "Date of Incident", options.incidentDate, 140);
  doc.moveDown(0.3);
  addParagraph(doc, options.incidentDescription, { indent: 20 });

  doc.moveDown(0.5);

  // Alleged violations
  addSectionHeading(doc, "Alleged Violations:", 2);
  addBulletList(doc, options.allegedViolations);

  doc.moveDown(0.5);

  // Response requirement
  addParagraph(
    doc,
    `You are hereby directed to submit your written explanation within ${options.responseDeadline}. ` +
      `Your explanation should address the allegations stated above.`
  );

  doc.moveDown(0.5);

  addParagraph(
    doc,
    `Failure to submit your written explanation within the specified period shall be construed ` +
      `as a waiver of your right to be heard and the company shall proceed with the investigation ` +
      `and decision-making process based on the available evidence.`
  );

  doc.moveDown(0.5);

  addParagraph(
    doc,
    `Please be guided accordingly.`
  );

  // Closing
  doc.moveDown(1.5);
  addSignatureBlock(doc, hrManager, hrTitle);

  // Receipt acknowledgment
  addHorizontalRule(doc);

  addParagraph(
    doc,
    `I acknowledge receipt of this Notice to Explain.`
  );

  doc.moveDown(2);
  addSignatureBlock(doc, fullName, employee.jobTitle || undefined, true);

  // Footer
  addPageFooter(doc, `${company.name} | Generated: ${today}`);

  return pdfToBuffer(doc);
}

/**
 * Generate Notice of Decision (NOD)
 */
export async function generateNoticeOfDecisionPDF(
  employee: DisciplinaryEmployeeInfo,
  company: DisciplinaryCompanyInfo,
  options: {
    originalIncidentDate: string;
    originalViolations: string[];
    investigationSummary: string;
    decision: "warning" | "suspension" | "termination";
    decisionDetails: string;
    effectiveDate: string;
    suspensionDays?: number;
    hrManagerName?: string;
    hrManagerTitle?: string;
  }
): Promise<Buffer> {
  const doc = createPDFDocument({
    title: `Notice of Decision - ${employee.firstName} ${employee.lastName}`,
    author: company.name,
    subject: "Notice of Decision",
  });

  const fullName = [employee.firstName, employee.middleName, employee.lastName]
    .filter(Boolean)
    .join(" ");

  const today = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const hrManager = options.hrManagerName || "HR Manager";
  const hrTitle = options.hrManagerTitle || "People Manager";

  const decisionLabels = {
    warning: "Written Warning",
    suspension: `Suspension (${options.suspensionDays || "N/A"} days)`,
    termination: "Termination of Employment",
  };

  // Header
  addCompanyHeader(doc, company);

  // Title
  addDocumentTitle(doc, "Notice of Decision (NOD)");

  // Memo header
  doc.moveDown(1);
  addLabeledField(doc, "Date", today, 80);
  addLabeledField(doc, "To", fullName, 80);
  addLabeledField(doc, "From", hrManager, 80);
  addLabeledField(doc, "Subject", "Notice of Decision - Disciplinary Action", 80);

  addHorizontalRule(doc);

  // Greeting
  doc.moveDown(0.5);
  addParagraph(doc, `Dear ${fullName},`);

  doc.moveDown(0.5);

  // Reference to NTE
  addParagraph(
    doc,
    `This is with reference to the Notice to Explain (NTE) issued to you on ${options.originalIncidentDate} ` +
      `regarding the following violations:`
  );

  doc.moveDown(0.5);
  addBulletList(doc, options.originalViolations);

  doc.moveDown(0.5);

  // Investigation summary
  addSectionHeading(doc, "Investigation Summary:", 2);
  addParagraph(doc, options.investigationSummary);

  doc.moveDown(0.5);

  // Decision
  addSectionHeading(doc, "Decision:", 2);
  addParagraph(
    doc,
    `After thorough review and consideration of all facts and circumstances, the management has decided ` +
      `to impose the following disciplinary action:`
  );

  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#1a1a1a");
  doc.text(`${decisionLabels[options.decision]}`, { indent: 20 });
  doc.font("Helvetica").fontSize(10);

  doc.moveDown(0.5);
  addParagraph(doc, options.decisionDetails, { indent: 20 });

  doc.moveDown(0.5);
  addLabeledField(doc, "Effective Date", options.effectiveDate, 140);

  doc.moveDown(0.5);

  // Closing remarks based on decision
  if (options.decision === "termination") {
    addParagraph(
      doc,
      `Please coordinate with the HR Department for the processing of your final pay and other ` +
        `separation requirements.`
    );
  } else {
    addParagraph(
      doc,
      `Please be advised that any further violations will result in more severe disciplinary action, ` +
        `up to and including termination.`
    );
  }

  // Closing
  doc.moveDown(1.5);
  addSignatureBlock(doc, hrManager, hrTitle);

  // Receipt acknowledgment
  addHorizontalRule(doc);

  addParagraph(
    doc,
    `I acknowledge receipt of this Notice of Decision.`
  );

  doc.moveDown(2);
  addSignatureBlock(doc, fullName, employee.jobTitle || undefined, true);

  // Footer
  addPageFooter(doc, `${company.name} | Generated: ${today}`);

  return pdfToBuffer(doc);
}
