/**
 * PDF Document Generators
 */

export {
  generateEmploymentContractPDF,
  type EmployeeInfo as ContractEmployeeInfo,
  type CompanyInfo as ContractCompanyInfo,
  type RoleScorecardData,
  type ContractOptions,
} from "./employment-contract";

export {
  generateCertificateOfEmploymentPDF,
  type COEEmployeeInfo,
  type COECompanyInfo,
} from "./certificate-of-employment";

export {
  generateSalaryChangMemoPDF,
  generateRegularizationMemoPDF,
  type MemoEmployeeInfo,
  type MemoCompanyInfo,
  type SalaryChangeOptions,
  type RegularizationOptions,
} from "./memos";

export {
  generateSeparationClearancePDF,
  type SeparationEmployeeInfo,
  type SeparationCompanyInfo,
  type SeparationOptions,
} from "./separation-clearance";

export {
  generatePayslipPDF,
  type PayslipEmployeeInfo,
  type PayslipCompanyInfo,
  type PayslipPeriodInfo,
  type PayslipData,
  type PayslipLineItem,
} from "./payslip";

export {
  generateDisciplinaryWarningPDF,
  generateDisciplinaryActionPDF,
  generateNoticeToExplainPDF,
  generateNoticeOfDecisionPDF,
  type DisciplinaryEmployeeInfo,
  type DisciplinaryCompanyInfo,
  type DisciplinaryWarningOptions,
  type DisciplinaryActionOptions,
} from "./disciplinary";

export {
  generateRepaymentAgreementPDF,
  type RepaymentEmployeeInfo,
  type RepaymentCompanyInfo,
  type RepaymentItem,
  type RepaymentAgreementOptions,
} from "./repayment-agreement";

export {
  generateOfferLetterPDF,
  type OfferLetterEmployeeInfo,
  type OfferLetterCompanyInfo,
  type OfferLetterOptions,
} from "./offer-letter";

export {
  generateQuitclaimReleasePDF,
  type QuitclaimEmployeeInfo,
  type QuitclaimCompanyInfo,
  type QuitclaimOptions,
} from "./quitclaim-release";

export {
  generateLateralTransferPDF,
  type LateralTransferEmployeeInfo,
  type LateralTransferCompanyInfo,
  type LateralTransferOptions,
} from "./lateral-transfer";
