/**
 * Employment Contract PDF Generator
 *
 * Generates a professional employment contract document
 * with Role Scorecard (Annex A) and Standards for Regularization (Annex B).
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
  addDualSignatureBlock,
  addPageNumbers,
  addPageFooter,
  addHorizontalRule,
  pdfToBuffer,
} from "../index";

export interface EmployeeInfo {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  employeeNumber: string;
  jobTitle: string;
  hireDate: Date;
  address?: string;
  hiringEntity?: string | null; // Legal entity name that hired the employee
}

export interface CompanyInfo {
  name: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  province?: string | null;
}

export interface RoleScorecardData {
  missionStatement: string;
  keyResponsibilities: Array<{
    area: string;
    tasks: string[];
  }>;
  kpis: Array<{
    metric: string;
    frequency: string;
  }>;
  workHoursPerDay?: number;
  workDaysPerWeek?: string;
  baseSalary?: number; // Retrieved from role scorecard
}

export interface ContractOptions {
  dailySalaryRate: number;
  probationStartDate: string;
  probationEndDate: string;
  employerRepresentative: {
    name: string;
    title: string;
  };
  witnesses?: Array<{
    name: string;
    position: string;
  }>;
  roleScorecard?: RoleScorecardData;
}

export async function generateEmploymentContractPDF(
  employee: EmployeeInfo,
  company: CompanyInfo,
  options: ContractOptions
): Promise<Buffer> {
  const doc = createPDFDocument({
    title: `Employment Contract - ${employee.firstName} ${employee.lastName}`,
    author: company.name,
    subject: "Employment Contract",
  });

  const fullName = [employee.firstName, employee.middleName, employee.lastName]
    .filter(Boolean)
    .join(" ");

  // Use hiring entity name as the display company name
  const displayCompanyName = employee.hiringEntity || company.name;

  const today = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // === PAGE 1: Contract Header ===
  addCompanyHeader(doc, company);
  addDocumentTitle(doc, "Employment Contract");

  // Contract preamble
  addParagraph(
    doc,
    `This Agreement entered into this ${options.probationStartDate}, at ${company.city || "[City]"}, ` +
    `${company.province || "[Province]"}, Philippines, by and between:`
  );

  doc.moveDown(0.5);

  // Employer
  addParagraph(
    doc,
    `${displayCompanyName.toUpperCase()}, a company duly organized and registered under the laws of ` +
    `the Philippines, with principal office address at ${[company.addressLine1, company.addressLine2, company.city, company.province].filter(Boolean).join(", ")}, ` +
    `herein represented by its ${options.employerRepresentative.title}, ${options.employerRepresentative.name}, ` +
    `herein referred to as the "EMPLOYER"`,
    { indent: 20 }
  );

  addParagraph(doc, "- and -", { align: "center" });

  // Employee
  addParagraph(
    doc,
    `${fullName.toUpperCase()}, of legal age, with address at ${employee.address || "[Address]"}, ` +
    `hereinafter referred to as the "EMPLOYEE".`,
    { indent: 20 }
  );

  doc.moveDown(0.5);
  addParagraph(doc, "WITNESSETH THAT:", { align: "center" });
  doc.moveDown(0.5);

  addNumberedList(doc, [
    "WHEREAS, the EMPLOYER is a corporation engaged in the Retail Industry;",
    "WHEREAS, the EMPLOYEE has qualified in the pre-employment requirements conducted by the EMPLOYER;",
    `WHEREAS, the EMPLOYER is interested in engaging the services of the EMPLOYEE as ${employee.jobTitle};`,
  ]);

  addParagraph(
    doc,
    "NOW, THEREFORE, for and in consideration of the foregoing premises, the parties hereby agree as follows:"
  );

  // === CONTRACT SECTIONS ===

  // Section 1: Probationary Employment
  addSectionHeading(doc, "1. PROBATIONARY EMPLOYMENT");
  addParagraph(
    doc,
    "Subject to the job performance, the EMPLOYER agrees to employ EMPLOYEE and EMPLOYEE agrees to " +
    "remain in the employ of EMPLOYER on probation under the terms and conditions hereinafter set forth."
  );

  // Section 2: Job Title and Description
  addSectionHeading(doc, "2. JOB TITLE AND DESCRIPTION");
  addParagraph(
    doc,
    `The EMPLOYEE's probationary employment is as a ${employee.jobTitle}. A more specific description ` +
    `of the EMPLOYEE's duties, responsibilities and work hours is outlined in Annex "A" and made an ` +
    `integral part of this contract.`
  );

  // Section 3: Period of Probationary Employment
  addSectionHeading(doc, "3. PERIOD OF PROBATIONARY EMPLOYMENT");
  addParagraph(
    doc,
    `The EMPLOYEE is employed on probationary status for a period of 6 months or 180 calendar days ` +
    `beginning on ${options.probationStartDate} and ending on ${options.probationEndDate}. Prior to the ` +
    `expiration of the EMPLOYEE's probationary employment, he/she shall be notified in writing if ` +
    `he/she qualified as a regular employee.`
  );
  addParagraph(
    doc,
    `This employment is subject to the standards for regularization, which EMPLOYEE hereby acknowledges ` +
    `to have received and is aware of. These standards are outlined in Annex "B" which is made an ` +
    `integral part of this Contract.`
  );

  // Section 4: Probationary Evaluation
  addSectionHeading(doc, "4. PROBATIONARY EVALUATION");
  addParagraph(
    doc,
    "The EMPLOYER will evaluate an employee's performance during the probationary period. The EMPLOYEE's " +
    "immediate superior shall make evaluation or such other representative appointed by the EMPLOYER. " +
    "The evaluation of the EMPLOYEE shall be made in writing. The EMPLOYEE agrees that it is the " +
    "prerogative of the EMPLOYER to evaluate his/her performance and decide whether he/she is qualified " +
    "to be a regular employee."
  );

  // Section 5: Compensation
  addSectionHeading(doc, "5. COMPENSATION");
  // Use base salary from role scorecard if available, otherwise fall back to options.dailySalaryRate
  const dailySalaryRate = options.roleScorecard?.baseSalary || options.dailySalaryRate;
  addParagraph(
    doc,
    `The EMPLOYEE will be paid a daily salary rate of PHP ${dailySalaryRate.toLocaleString("en-PH", { minimumFractionDigits: 2 })}.`
  );
  addParagraph(
    doc,
    `The EMPLOYEE acknowledges that this engagement follows the "No Work, No Pay" policy. Consequently, ` +
    `the semi-monthly salary shall be computed based on the actual number of days worked by the EMPLOYEE ` +
    `during the applicable payroll cutoff period.`
  );
  addParagraph(
    doc,
    `The EMPLOYEE's salary will be paid in two installments, once on the 15th and at the end of the month. ` +
    `The salary will be paid either through ATM, in cash, by a bank check, or by a bank or postal transfer, ` +
    `from which shall be deducted, where applicable, the EMPLOYEE's social security contribution, ` +
    `withholding taxes and other government mandated deductions.`
  );

  // New page for remaining sections
  doc.addPage();

  // Section 6: Work Hours
  addSectionHeading(doc, "6. WORK HOURS");
  const workHours = options.roleScorecard?.workHoursPerDay || 8;
  const workDays = options.roleScorecard?.workDaysPerWeek || "Monday to Saturday";
  addParagraph(
    doc,
    `The EMPLOYEE shall work for a period of ${workHours} hours per day from ${workDays}. In case of ` +
    `unusual volume of work, the EMPLOYER may require the EMPLOYEE to work on Sundays. Any work ` +
    `rendered in excess of ${workHours} hours per day shall be subject to payment of applicable overtime rate.`
  );

  // Section 7: Assignment of Tasks
  addSectionHeading(doc, "7. ASSIGNMENT OF TASKS");
  addParagraph(
    doc,
    "On signing this Contract, the EMPLOYEE recognizes EMPLOYER's right and prerogative, to assign and " +
    "re-assign him/her to perform such other tasks within EMPLOYER's organization, in any branch or unit, " +
    "as may be deemed necessary or in the interest of the service."
  );

  // Section 8: Medical/Drug Tests
  addSectionHeading(doc, "8. MEDICAL/DRUG TESTS");
  addParagraph(
    doc,
    "By signing this contract, the EMPLOYEE consents and agrees to, upon request from the EMPLOYER, " +
    "undergo at a government accredited institute to be nominated by the EMPLOYER, a medical/drug tests " +
    "at the expense of the EMPLOYEE."
  );

  // Section 9: Company Rules
  addSectionHeading(doc, "9. COMPANY RULES AND REGULATIONS");
  addParagraph(
    doc,
    "All existing as well as future rules and regulations issued by the EMPLOYER are hereby deemed " +
    "incorporated with this Contract. The EMPLOYEE recognizes that by signing this Contract, he/she " +
    "shall be bound by all such rules and regulations."
  );

  // Section 10: Deductions
  addSectionHeading(doc, "10. DEDUCTIONS FOR COMPANY-INCURRED COSTS");
  addParagraph(
    doc,
    "The EMPLOYEE agrees and acknowledges that the EMPLOYER has the right to deduct from the EMPLOYEE's " +
    "salary any amounts corresponding to costs or expenses incurred by the EMPLOYER as a direct result " +
    "of the EMPLOYEE's actions, negligence, or non-compliance with company policies."
  );
  addBulletList(doc, [
    "Damage to or loss of company property due to the EMPLOYEE's negligence",
    "Unauthorized expenses charged to the company",
    "Costs arising from failure to return company-issued items",
  ]);

  // Section 11: Disciplinary Measures
  addSectionHeading(doc, "11. DISCIPLINARY MEASURES");
  addParagraph(
    doc,
    "On signing this Contract, the EMPLOYEE hereby recognizes the EMPLOYER's right to impose disciplinary " +
    "measures or sanctions, which may include, but are not limited to, termination of employment, " +
    "suspensions, fines, salary deductions, withdrawal of benefits, loss of privileges."
  );

  // Section 12: Non-Compete
  addSectionHeading(doc, "12. NON-COMPETE AGREEMENT");
  addParagraph(
    doc,
    "The EMPLOYEE agrees that for a period of 24 months following the termination of their employment, " +
    "they will not:"
  );
  addBulletList(doc, [
    "Directly or indirectly engage in any business or activity that competes with the business of the EMPLOYER within the Philippines.",
    "Solicit or attempt to solicit any of the EMPLOYER's clients, customers, or employees for purposes that would result in competition with the EMPLOYER.",
  ]);

  // New page
  doc.addPage();

  // Section 13: Termination
  addSectionHeading(doc, "13. TERMINATION OF EMPLOYMENT");
  addParagraph(
    doc,
    "Aside from the just and authorized causes for the termination of employment enumerated in " +
    "Arts. 282 to 284 of the Labor Code, the following acts and/or omissions shall constitute " +
    "grounds for termination:"
  );
  addBulletList(doc, [
    "Intentional or unintentional violation of the EMPLOYER's policies, rules, and regulations",
    "Commission of an act which effects a loss of confidence on the part of the EMPLOYER",
    "Incapacity by ill health for an aggregate period of 90 days in any calendar year",
    "Failure to pass two (2) consecutive evaluations of work performance",
    "Failure to meet the standards for regularization",
  ]);
  addParagraph(
    doc,
    "In the event that the EMPLOYEE wishes to terminate this Contract of Employment for any reason, " +
    "he/she must give thirty (30) days written notice to EMPLOYER prior to the effective date of termination."
  );

  // Section 14: Final Pay
  addSectionHeading(doc, "14. FINAL PAY");
  addParagraph(
    doc,
    "In case of termination of the EMPLOYEE's employment for whatever causes, the EMPLOYER shall have " +
    "the right to withhold the EMPLOYEE's last salary or any other benefits accrued, pending liquidation " +
    "of whatever obligations which the EMPLOYEE may have with the EMPLOYER."
  );

  // Section 15: Confidentiality
  addSectionHeading(doc, "15. CONFIDENTIALITY");
  addParagraph(
    doc,
    "It is the EMPLOYEE's responsibility to ensure that no information gained by virtue of employment " +
    "with the EMPLOYER is disclosed to outsiders unless the disclosure is for necessary business purposes " +
    "and pursuant to properly approved and written agreements."
  );

  // Section 16: Separability
  addSectionHeading(doc, "16. SEPARABILITY CLAUSE");
  addParagraph(
    doc,
    "If any provisions of this document shall be construed to be illegal or invalid, they shall not " +
    "affect the legality, validity, and enforceability of the other provisions of this document."
  );

  // Section 17: Entire Agreement
  addSectionHeading(doc, "17. ENTIRE AGREEMENT");
  addParagraph(
    doc,
    "This Contract represents the entire agreement between the EMPLOYER and the EMPLOYEE and supersedes " +
    "all previous oral and written communications, representations or agreements between the parties."
  );

  // === SIGNATURES ===
  doc.moveDown(2);
  addParagraph(
    doc,
    "IN WITNESS WHEREOF, the parties have executed this document as of the date and place first mentioned.",
    { align: "left" }
  );

  doc.moveDown(1);
  addDualSignatureBlock(
    doc,
    { name: options.employerRepresentative.name, title: options.employerRepresentative.title },
    { name: fullName, title: employee.jobTitle }
  );

  doc.moveDown(2);
  addParagraph(doc, "SIGNED IN THE PRESENCE OF:", { align: "left" });
  doc.moveDown(1);

  const witnesses = options.witnesses || [
    { name: "[Witness 1]", position: "[Position]" },
    { name: "[Witness 2]", position: "[Position]" },
  ];
  addDualSignatureBlock(
    doc,
    { name: witnesses[0].name, title: witnesses[0].position },
    { name: witnesses[1]?.name || "[Witness 2]", title: witnesses[1]?.position || "[Position]" }
  );

  // === ANNEX A: Role Scorecard ===
  doc.addPage();
  addDocumentTitle(doc, "Annex A: Duties, Responsibilities, and Work Hours");

  addLabeledField(doc, "Position Title", employee.jobTitle);
  doc.moveDown(0.5);

  if (options.roleScorecard) {
    const scorecard = options.roleScorecard;

    // Mission Statement
    addSectionHeading(doc, "MISSION STATEMENT", 2);
    addParagraph(doc, scorecard.missionStatement);

    // Key Responsibilities
    addSectionHeading(doc, "DUTIES AND RESPONSIBILITIES", 2);

    scorecard.keyResponsibilities.forEach((area, index) => {
      doc.moveDown(0.3);
      addSectionHeading(doc, `${String.fromCharCode(65 + index)}) ${area.area}`, 3);
      addNumberedList(doc, area.tasks);
    });

    // KPIs
    addSectionHeading(doc, "KEY PERFORMANCE INDICATORS (KPIs)", 2);
    scorecard.kpis.forEach((kpi, index) => {
      addParagraph(doc, `${index + 1}. ${kpi.metric} (${kpi.frequency})`);
    });

    // Work Hours
    addSectionHeading(doc, "WORK HOURS", 2);
    addParagraph(
      doc,
      `The EMPLOYEE is expected to render ${scorecard.workHoursPerDay || 8} hours per day and a total of ` +
      `${(scorecard.workHoursPerDay || 8) * 6} hours per week.`
    );
    addParagraph(
      doc,
      `The EMPLOYEE's work schedule shall follow the assigned shift template as determined by the EMPLOYER.`
    );
  } else {
    addParagraph(doc, "[Role scorecard not defined - please configure in the system]");
  }

  // Performance Evaluation
  addSectionHeading(doc, "PERFORMANCE EVALUATION", 2);
  addParagraph(doc, "Evaluation Timeline:");
  addNumberedList(doc, [
    "End of the 1st Month: Focus on initial performance and onboarding progress",
    "End of the 3rd Month: Assess progress and improvements based on feedback",
    "End of the 6th Month: Comprehensive review for regularization decision",
  ]);

  // === ANNEX B: Standards for Regularization ===
  doc.addPage();
  addDocumentTitle(doc, "Annex B: Standards for Regularization");

  addSectionHeading(doc, "1. PERFORMANCE STANDARDS", 2);
  addParagraph(doc, "The EMPLOYEE's performance will be evaluated based on:");
  addBulletList(doc, [
    "Quality of Work: Produces accurate, reliable, and high-quality outputs that meet deadlines",
    "Productivity: Efficiently completes tasks within the required time frame",
    "Adaptability: Quickly learns and applies new skills, adjusts to changes",
    "Initiative and Problem-Solving: Proactively addresses challenges and suggests improvements",
    "Teamwork and Communication: Collaborates effectively and maintains professional communication",
  ]);

  addSectionHeading(doc, "2. BEHAVIORAL STANDARDS", 2);
  addBulletList(doc, [
    "Punctuality and Attendance: Reports to work on time and follows attendance policies",
    "Compliance with Company Policies: Adheres to the EMPLOYER's rules and confidentiality standards",
    "Professionalism: Maintains a positive attitude, appropriate appearance, and professional demeanor",
  ]);

  addSectionHeading(doc, "3. TECHNICAL COMPETENCIES", 2);
  addParagraph(
    doc,
    "The EMPLOYEE must demonstrate the necessary role-specific skills and knowledge to perform their " +
    "job effectively."
  );

  addSectionHeading(doc, "4. EVALUATION PROCESS", 2);
  addBulletList(doc, [
    "Frequency: The EMPLOYEE will be evaluated at least twice during the probationary period",
    "Criteria: Based on the above performance and behavioral standards",
    "Feedback and Improvement: Areas for improvement will be discussed, with possible training",
    "Final Decision: Regularization will depend on overall performance and meeting expectations",
  ]);

  addSectionHeading(doc, "5. CONSEQUENCES OF NON-COMPLIANCE", 2);
  addParagraph(doc, "Failure to meet these standards may result in:");
  addBulletList(doc, [
    "Termination of probationary employment",
    "Additional probationary measures if necessary",
  ]);

  // Add page numbers to all pages
  addPageNumbers(doc);

  // Add footer to last page
  addPageFooter(doc, `Generated: ${today} | This is a computer-generated document`);

  return pdfToBuffer(doc);
}
