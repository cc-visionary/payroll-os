"use server";

// =============================================================================
// PeopleOS PH - Applicant Import/Export Actions
// =============================================================================
// Server actions for importing applicants from XLSX and exporting templates/data.
// =============================================================================

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertPermission, Permission } from "@/lib/rbac";
import { createAuditLogger } from "@/lib/audit";
import { headers } from "next/headers";
import * as XLSX from "xlsx";

// =============================================================================
// XLSX Template Structure
// =============================================================================

const TEMPLATE_HEADERS = [
  "first_name",           // Required: First name
  "middle_name",          // Optional: Middle name
  "last_name",            // Required: Last name
  "suffix",               // Optional: Suffix (Jr., Sr., III)
  "email",                // Required: Email address
  "phone_number",         // Optional: Phone number
  "mobile_number",        // Optional: Mobile number
  "role_scorecard_title", // Optional: Position applied for (job title from role scorecard)
  "custom_job_title",     // Optional: Custom job title (if no role scorecard)
  "department_code",      // Optional: Department code
  "hiring_entity_code",   // Optional: Hiring entity code
  "source",               // Optional: Source (e.g., LinkedIn, Referral, Job Board)
  "referred_by_employee_number", // Optional: Referrer's employee number
  "resume_url",           // Optional: Link to resume
  "portfolio_url",        // Optional: Portfolio URL
  "linkedin_url",         // Optional: LinkedIn profile URL
  "expected_salary_min",  // Optional: Expected minimum salary
  "expected_salary_max",  // Optional: Expected maximum salary
  "expected_start_date",  // Optional: Expected start date (YYYY-MM-DD)
  "notes",                // Optional: Initial notes
];

// =============================================================================
// Download XLSX Template
// =============================================================================

export async function downloadApplicantTemplate() {
  const auth = await assertPermission(Permission.HIRING_VIEW);

  // Get reference data
  const [departments, roleScorecards, hiringEntities, employees] = await Promise.all([
    prisma.department.findMany({
      where: { companyId: auth.user.companyId, deletedAt: null },
      select: { code: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.roleScorecard.findMany({
      where: { companyId: auth.user.companyId, isActive: true },
      select: { jobTitle: true },
      orderBy: { jobTitle: "asc" },
    }),
    prisma.hiringEntity.findMany({
      where: { companyId: auth.user.companyId, isActive: true },
      select: { code: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: { companyId: auth.user.companyId, deletedAt: null, employmentStatus: "ACTIVE" },
      select: { employeeNumber: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    }),
  ]);

  // Create workbook with multiple sheets
  const wb = XLSX.utils.book_new();

  // Main data sheet with example row
  const exampleRow = {
    first_name: "Maria",
    middle_name: "Santos",
    last_name: "Garcia",
    suffix: "",
    email: "maria.garcia@gmail.com",
    phone_number: "02-8123-4567",
    mobile_number: "09171234567",
    role_scorecard_title: "Software Engineer",
    custom_job_title: "",
    department_code: "ENG",
    hiring_entity_code: "",
    source: "LinkedIn",
    referred_by_employee_number: "",
    resume_url: "https://drive.google.com/resume.pdf",
    portfolio_url: "https://github.com/mariagarcia",
    linkedin_url: "https://linkedin.com/in/mariagarcia",
    expected_salary_min: 40000,
    expected_salary_max: 55000,
    expected_start_date: "2025-02-01",
    notes: "Strong candidate from referral",
  };

  const dataSheet = XLSX.utils.json_to_sheet([exampleRow], { header: TEMPLATE_HEADERS });

  // Set column widths
  dataSheet["!cols"] = [
    { wch: 15 }, // first_name
    { wch: 15 }, // middle_name
    { wch: 15 }, // last_name
    { wch: 8 },  // suffix
    { wch: 30 }, // email
    { wch: 15 }, // phone_number
    { wch: 15 }, // mobile_number
    { wch: 25 }, // role_scorecard_title
    { wch: 25 }, // custom_job_title
    { wch: 15 }, // department_code
    { wch: 18 }, // hiring_entity_code
    { wch: 15 }, // source
    { wch: 25 }, // referred_by_employee_number
    { wch: 40 }, // resume_url
    { wch: 35 }, // portfolio_url
    { wch: 35 }, // linkedin_url
    { wch: 18 }, // expected_salary_min
    { wch: 18 }, // expected_salary_max
    { wch: 18 }, // expected_start_date
    { wch: 40 }, // notes
  ];

  XLSX.utils.book_append_sheet(wb, dataSheet, "Applicants");

  // Instructions sheet
  const instructionsData = [
    { Field: "Instructions", Description: "" },
    { Field: "", Description: "Fill in the 'Applicants' sheet with your applicant data." },
    { Field: "", Description: "Delete the example row before importing." },
    { Field: "", Description: "" },
    { Field: "Required Fields", Description: "" },
    { Field: "first_name", Description: "First name of the applicant" },
    { Field: "last_name", Description: "Last name of the applicant" },
    { Field: "email", Description: "Email address (must be unique)" },
    { Field: "", Description: "" },
    { Field: "Optional Fields", Description: "" },
    { Field: "middle_name", Description: "Middle name" },
    { Field: "suffix", Description: "Name suffix (Jr., Sr., III, etc.)" },
    { Field: "phone_number", Description: "Landline phone number" },
    { Field: "mobile_number", Description: "Mobile phone number" },
    { Field: "role_scorecard_title", Description: "Position from Role Scorecards (see reference sheet)" },
    { Field: "custom_job_title", Description: "Custom job title (if no role scorecard)" },
    { Field: "department_code", Description: "Department code (see reference sheet)" },
    { Field: "hiring_entity_code", Description: "Hiring entity code (see reference sheet)" },
    { Field: "source", Description: "Where applicant came from (LinkedIn, Referral, etc.)" },
    { Field: "referred_by_employee_number", Description: "Referrer's employee number" },
    { Field: "resume_url", Description: "Link to resume (Google Drive, Dropbox, etc.)" },
    { Field: "portfolio_url", Description: "Portfolio website URL" },
    { Field: "linkedin_url", Description: "LinkedIn profile URL" },
    { Field: "expected_salary_min", Description: "Expected minimum salary (number)" },
    { Field: "expected_salary_max", Description: "Expected maximum salary (number)" },
    { Field: "expected_start_date", Description: "Expected start date (YYYY-MM-DD)" },
    { Field: "notes", Description: "Initial notes about the applicant" },
    { Field: "", Description: "" },
    { Field: "Common Sources", Description: "" },
    { Field: "", Description: "LinkedIn, Indeed, JobStreet, Referral, Company Website, Job Fair, Walk-in" },
  ];
  const instructionsSheet = XLSX.utils.json_to_sheet(instructionsData);
  instructionsSheet["!cols"] = [{ wch: 28 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, instructionsSheet, "Instructions");

  // Departments reference sheet
  if (departments.length > 0) {
    const deptData = departments.map((d) => ({ Code: d.code, Name: d.name }));
    const deptSheet = XLSX.utils.json_to_sheet(deptData);
    deptSheet["!cols"] = [{ wch: 15 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, deptSheet, "Departments");
  }

  // Role Scorecards (Positions) reference sheet
  if (roleScorecards.length > 0) {
    const roleData = roleScorecards.map((r) => ({ "Job Title": r.jobTitle }));
    const roleSheet = XLSX.utils.json_to_sheet(roleData);
    roleSheet["!cols"] = [{ wch: 35 }];
    XLSX.utils.book_append_sheet(wb, roleSheet, "Positions");
  }

  // Hiring Entities reference sheet
  if (hiringEntities.length > 0) {
    const entityData = hiringEntities.map((h) => ({ Code: h.code, Name: h.name }));
    const entitySheet = XLSX.utils.json_to_sheet(entityData);
    entitySheet["!cols"] = [{ wch: 15 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, entitySheet, "Hiring Entities");
  }

  // Employees reference sheet (for referrals)
  if (employees.length > 0) {
    const empData = employees.slice(0, 100).map((e) => ({
      "Employee Number": e.employeeNumber,
      Name: `${e.firstName} ${e.lastName}`,
    }));
    const empSheet = XLSX.utils.json_to_sheet(empData);
    empSheet["!cols"] = [{ wch: 18 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, empSheet, "Employees (Referrers)");
  }

  // Generate buffer
  const buffer = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

  return {
    success: true,
    fileName: "applicant-import-template.xlsx",
    content: buffer,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    isBase64: true,
  };
}

// =============================================================================
// Parse XLSX Content
// =============================================================================

interface ParsedApplicant {
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  email: string;
  phoneNumber: string | null;
  mobileNumber: string | null;
  roleScorecardTitle: string | null;
  customJobTitle: string | null;
  departmentCode: string | null;
  hiringEntityCode: string | null;
  source: string | null;
  referredByEmployeeNumber: string | null;
  resumeUrl: string | null;
  portfolioUrl: string | null;
  linkedinUrl: string | null;
  expectedSalaryMin: number | null;
  expectedSalaryMax: number | null;
  expectedStartDate: string | null;
  notes: string | null;
  rowNumber: number;
}

interface ParseResult {
  success: boolean;
  applicants: ParsedApplicant[];
  errors: { row: number; message: string }[];
}

function parseXLSXContent(base64Content: string): ParseResult {
  try {
    // Decode base64 and read workbook
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const wb = XLSX.read(bytes, { type: "array" });

    // Get the first sheet (Applicants)
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];

    if (!sheet) {
      return { success: false, applicants: [], errors: [{ row: 0, message: "No data sheet found" }] };
    }

    // Convert to JSON
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    if (rows.length === 0) {
      return { success: false, applicants: [], errors: [{ row: 0, message: "No data rows found" }] };
    }

    const applicants: ParsedApplicant[] = [];
    const errors: { row: number; message: string }[] = [];

    // Helper to get value from row (handles various header formats)
    const getValue = (row: Record<string, unknown>, keys: string[]): string => {
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
          return String(row[key]).trim();
        }
      }
      return "";
    };

    // Helper to parse date (handles Excel date numbers)
    const parseDate = (row: Record<string, unknown>, keys: string[]): string | null => {
      for (const key of keys) {
        const value = row[key];
        if (value === undefined || value === null || value === "") continue;

        if (typeof value === "number") {
          // Excel stores dates as numbers
          const date = XLSX.SSF.parse_date_code(value);
          return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
        }

        const strValue = String(value).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
          return strValue;
        }
      }
      return null;
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 for header row and 0-index

      const firstName = getValue(row, ["first_name", "First Name", "FirstName", "first name"]);
      const middleName = getValue(row, ["middle_name", "Middle Name", "MiddleName", "middle name"]);
      const lastName = getValue(row, ["last_name", "Last Name", "LastName", "last name"]);
      const suffix = getValue(row, ["suffix", "Suffix"]);
      const email = getValue(row, ["email", "Email", "email_address", "Email Address"]);
      const phoneNumber = getValue(row, ["phone_number", "Phone Number", "PhoneNumber", "phone number"]);
      const mobileNumber = getValue(row, ["mobile_number", "Mobile Number", "MobileNumber", "mobile number"]);
      const roleScorecardTitle = getValue(row, ["role_scorecard_title", "Role Scorecard Title", "Position", "position"]);
      const customJobTitle = getValue(row, ["custom_job_title", "Custom Job Title", "CustomJobTitle", "custom job title"]);
      const departmentCode = getValue(row, ["department_code", "Department Code", "DepartmentCode", "department code"]);
      const hiringEntityCode = getValue(row, ["hiring_entity_code", "Hiring Entity Code", "HiringEntityCode", "hiring entity code"]);
      const source = getValue(row, ["source", "Source"]);
      const referredByEmployeeNumber = getValue(row, ["referred_by_employee_number", "Referred By", "ReferredBy", "referred by"]);
      const resumeUrl = getValue(row, ["resume_url", "Resume URL", "ResumeUrl", "resume url"]);
      const portfolioUrl = getValue(row, ["portfolio_url", "Portfolio URL", "PortfolioUrl", "portfolio url"]);
      const linkedinUrl = getValue(row, ["linkedin_url", "LinkedIn URL", "LinkedinUrl", "linkedin url"]);
      const expectedSalaryMinStr = getValue(row, ["expected_salary_min", "Expected Salary Min", "ExpectedSalaryMin"]);
      const expectedSalaryMaxStr = getValue(row, ["expected_salary_max", "Expected Salary Max", "ExpectedSalaryMax"]);
      const expectedStartDate = parseDate(row, ["expected_start_date", "Expected Start Date", "ExpectedStartDate"]);
      const notes = getValue(row, ["notes", "Notes"]);

      // Validate required fields
      if (!firstName) {
        errors.push({ row: rowNumber, message: "first_name is required" });
        continue;
      }
      if (!lastName) {
        errors.push({ row: rowNumber, message: "last_name is required" });
        continue;
      }
      if (!email) {
        errors.push({ row: rowNumber, message: "email is required" });
        continue;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push({ row: rowNumber, message: `Invalid email format: ${email}` });
        continue;
      }

      // Parse salary fields
      const parseSalary = (value: string): number | null => {
        if (!value) return null;
        const num = parseFloat(value.replace(/,/g, ""));
        return isNaN(num) ? null : num;
      };

      applicants.push({
        firstName,
        middleName: middleName || null,
        lastName,
        suffix: suffix || null,
        email,
        phoneNumber: phoneNumber || null,
        mobileNumber: mobileNumber || null,
        roleScorecardTitle: roleScorecardTitle || null,
        customJobTitle: customJobTitle || null,
        departmentCode: departmentCode || null,
        hiringEntityCode: hiringEntityCode || null,
        source: source || null,
        referredByEmployeeNumber: referredByEmployeeNumber || null,
        resumeUrl: resumeUrl || null,
        portfolioUrl: portfolioUrl || null,
        linkedinUrl: linkedinUrl || null,
        expectedSalaryMin: parseSalary(expectedSalaryMinStr),
        expectedSalaryMax: parseSalary(expectedSalaryMaxStr),
        expectedStartDate,
        notes: notes || null,
        rowNumber,
      });
    }

    return {
      success: errors.length === 0,
      applicants,
      errors,
    };
  } catch (error) {
    console.error("Failed to parse XLSX:", error);
    return {
      success: false,
      applicants: [],
      errors: [{ row: 0, message: `Failed to parse XLSX file: ${error instanceof Error ? error.message : "Unknown error"}` }],
    };
  }
}

// =============================================================================
// Validate Import (Preview)
// =============================================================================

export interface ApplicantImportValidationResult {
  success: boolean;
  validApplicants: {
    name: string;
    email: string;
    position: string | null;
    departmentName: string | null;
    source: string | null;
    expectedSalary: string | null;
  }[];
  errors: { row: number; message: string }[];
  warnings: { row: number; message: string }[];
}

export async function validateApplicantImport(
  base64Content: string
): Promise<ApplicantImportValidationResult> {
  const auth = await assertPermission(Permission.HIRING_CREATE);

  // Parse XLSX
  const parseResult = parseXLSXContent(base64Content);

  if (parseResult.errors.length > 0 && parseResult.applicants.length === 0) {
    return {
      success: false,
      validApplicants: [],
      errors: parseResult.errors,
      warnings: [],
    };
  }

  // Lookup reference data
  const [departments, roleScorecards, hiringEntities, employees, existingApplicants] = await Promise.all([
    prisma.department.findMany({
      where: { companyId: auth.user.companyId, deletedAt: null },
      select: { id: true, code: true, name: true },
    }),
    prisma.roleScorecard.findMany({
      where: { companyId: auth.user.companyId, isActive: true },
      select: { id: true, jobTitle: true, departmentId: true },
    }),
    prisma.hiringEntity.findMany({
      where: { companyId: auth.user.companyId, isActive: true },
      select: { id: true, code: true },
    }),
    prisma.employee.findMany({
      where: { companyId: auth.user.companyId, deletedAt: null },
      select: { id: true, employeeNumber: true },
    }),
    prisma.applicant.findMany({
      where: { companyId: auth.user.companyId },
      select: { email: true },
    }),
  ]);

  const deptByCode = new Map(departments.map((d) => [d.code.toLowerCase(), d]));
  const roleByTitle = new Map(roleScorecards.map((r) => [r.jobTitle.toLowerCase(), r]));
  const entityByCode = new Map(hiringEntities.map((e) => [e.code.toLowerCase(), e]));
  const employeeByNumber = new Map(employees.map((e) => [e.employeeNumber.toLowerCase(), e]));
  const existingEmails = new Set(existingApplicants.map((a) => a.email.toLowerCase()));

  const validApplicants: ApplicantImportValidationResult["validApplicants"] = [];
  const warnings: { row: number; message: string }[] = [];
  const errors: { row: number; message: string }[] = [...parseResult.errors];

  for (const app of parseResult.applicants) {
    // Check for duplicate email
    if (existingEmails.has(app.email.toLowerCase())) {
      errors.push({
        row: app.rowNumber,
        message: `Applicant with email '${app.email}' already exists`,
      });
      continue;
    }

    // Validate role scorecard if provided
    let position: string | null = null;
    let departmentName: string | null = null;
    if (app.roleScorecardTitle) {
      const role = roleByTitle.get(app.roleScorecardTitle.toLowerCase());
      if (!role) {
        warnings.push({
          row: app.rowNumber,
          message: `Position '${app.roleScorecardTitle}' not found - will use custom_job_title instead`,
        });
        position = app.customJobTitle;
      } else {
        position = role.jobTitle;
        const dept = departments.find((d) => d.id === role.departmentId);
        if (dept) departmentName = dept.name;
      }
    } else {
      position = app.customJobTitle;
    }

    // Validate department code if provided
    if (app.departmentCode && !departmentName) {
      const dept = deptByCode.get(app.departmentCode.toLowerCase());
      if (!dept) {
        warnings.push({
          row: app.rowNumber,
          message: `Department code '${app.departmentCode}' not found - will be left blank`,
        });
      } else {
        departmentName = dept.name;
      }
    }

    // Validate hiring entity code if provided
    if (app.hiringEntityCode) {
      const entity = entityByCode.get(app.hiringEntityCode.toLowerCase());
      if (!entity) {
        warnings.push({
          row: app.rowNumber,
          message: `Hiring entity code '${app.hiringEntityCode}' not found - will be left blank`,
        });
      }
    }

    // Validate referrer if provided
    if (app.referredByEmployeeNumber) {
      const referrer = employeeByNumber.get(app.referredByEmployeeNumber.toLowerCase());
      if (!referrer) {
        warnings.push({
          row: app.rowNumber,
          message: `Referrer '${app.referredByEmployeeNumber}' not found - will be left blank`,
        });
      }
    }

    // Format expected salary
    let expectedSalary: string | null = null;
    if (app.expectedSalaryMin || app.expectedSalaryMax) {
      const formatter = new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 0,
      });
      if (app.expectedSalaryMin && app.expectedSalaryMax) {
        expectedSalary = `${formatter.format(app.expectedSalaryMin)} - ${formatter.format(app.expectedSalaryMax)}`;
      } else if (app.expectedSalaryMin) {
        expectedSalary = `${formatter.format(app.expectedSalaryMin)}+`;
      } else if (app.expectedSalaryMax) {
        expectedSalary = `Up to ${formatter.format(app.expectedSalaryMax)}`;
      }
    }

    validApplicants.push({
      name: `${app.firstName} ${app.middleName ? app.middleName + " " : ""}${app.lastName}${app.suffix ? " " + app.suffix : ""}`,
      email: app.email,
      position,
      departmentName,
      source: app.source,
      expectedSalary,
    });
  }

  return {
    success: errors.length === 0,
    validApplicants,
    errors,
    warnings,
  };
}

// =============================================================================
// Import Applicants
// =============================================================================

export interface ApplicantImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export async function importApplicants(base64Content: string): Promise<ApplicantImportResult> {
  const auth = await assertPermission(Permission.HIRING_CREATE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  // Parse XLSX
  const parseResult = parseXLSXContent(base64Content);

  if (parseResult.errors.length > 0 && parseResult.applicants.length === 0) {
    return {
      success: false,
      imported: 0,
      skipped: parseResult.errors.length,
      errors: parseResult.errors,
    };
  }

  // Lookup reference data
  const [departments, roleScorecards, hiringEntities, employees, existingApplicants] = await Promise.all([
    prisma.department.findMany({
      where: { companyId: auth.user.companyId, deletedAt: null },
      select: { id: true, code: true },
    }),
    prisma.roleScorecard.findMany({
      where: { companyId: auth.user.companyId, isActive: true },
      select: { id: true, jobTitle: true, departmentId: true },
    }),
    prisma.hiringEntity.findMany({
      where: { companyId: auth.user.companyId, isActive: true },
      select: { id: true, code: true },
    }),
    prisma.employee.findMany({
      where: { companyId: auth.user.companyId, deletedAt: null },
      select: { id: true, employeeNumber: true },
    }),
    prisma.applicant.findMany({
      where: { companyId: auth.user.companyId },
      select: { email: true },
    }),
  ]);

  const deptByCode = new Map(departments.map((d) => [d.code.toLowerCase(), d.id]));
  const roleByTitle = new Map(roleScorecards.map((r) => [r.jobTitle.toLowerCase(), r]));
  const entityByCode = new Map(hiringEntities.map((e) => [e.code.toLowerCase(), e.id]));
  const employeeByNumber = new Map(employees.map((e) => [e.employeeNumber.toLowerCase(), e.id]));
  const existingEmails = new Set(existingApplicants.map((a) => a.email.toLowerCase()));

  let imported = 0;
  const errors: { row: number; message: string }[] = [...parseResult.errors];

  // Import each applicant
  for (const app of parseResult.applicants) {
    try {
      // Skip if email already exists
      if (existingEmails.has(app.email.toLowerCase())) {
        errors.push({
          row: app.rowNumber,
          message: `Applicant with email '${app.email}' already exists`,
        });
        continue;
      }

      // Resolve references
      let roleScorecardId: string | null = null;
      let departmentId: string | null = null;

      // If role scorecard is provided, use it
      if (app.roleScorecardTitle) {
        const role = roleByTitle.get(app.roleScorecardTitle.toLowerCase());
        if (role) {
          roleScorecardId = role.id;
          departmentId = role.departmentId;
        }
      }

      // If no role scorecard, use department code directly
      if (!departmentId && app.departmentCode) {
        departmentId = deptByCode.get(app.departmentCode.toLowerCase()) || null;
      }

      const hiringEntityId = app.hiringEntityCode
        ? entityByCode.get(app.hiringEntityCode.toLowerCase()) || null
        : null;

      const referredById = app.referredByEmployeeNumber
        ? employeeByNumber.get(app.referredByEmployeeNumber.toLowerCase()) || null
        : null;

      const applicant = await prisma.applicant.create({
        data: {
          companyId: auth.user.companyId,
          firstName: app.firstName,
          middleName: app.middleName,
          lastName: app.lastName,
          suffix: app.suffix,
          email: app.email,
          phoneNumber: app.phoneNumber,
          mobileNumber: app.mobileNumber,
          roleScorecardId,
          customJobTitle: !roleScorecardId ? app.customJobTitle : null,
          departmentId,
          hiringEntityId,
          source: app.source,
          referredById,
          portfolioUrl: app.portfolioUrl,
          linkedinUrl: app.linkedinUrl,
          expectedSalaryMin: app.expectedSalaryMin,
          expectedSalaryMax: app.expectedSalaryMax,
          expectedStartDate: app.expectedStartDate ? new Date(app.expectedStartDate) : undefined,
          notes: app.notes,
          status: "NEW",
          createdById: auth.user.id,
        },
      });

      // Add to set to prevent duplicates within same import
      existingEmails.add(app.email.toLowerCase());

      await audit.create("Applicant", applicant.id, {
        name: `${app.firstName} ${app.lastName}`,
        email: app.email,
        importedFrom: "XLSX",
      });

      imported++;
    } catch (error) {
      console.error(`Failed to import row ${app.rowNumber}:`, error);
      errors.push({
        row: app.rowNumber,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  revalidatePath("/hiring");

  return {
    success: errors.length === 0,
    imported,
    skipped: errors.length,
    errors,
  };
}

// =============================================================================
// Export Existing Applicants
// =============================================================================

export async function exportApplicants() {
  const auth = await assertPermission(Permission.HIRING_VIEW);

  const applicants = await prisma.applicant.findMany({
    where: { companyId: auth.user.companyId },
    include: {
      department: { select: { code: true } },
      roleScorecard: { select: { jobTitle: true } },
      hiringEntity: { select: { code: true } },
      referredBy: { select: { employeeNumber: true } },
    },
    orderBy: { appliedAt: "desc" },
  });

  // Build data rows
  const dataRows = applicants.map((a) => ({
    first_name: a.firstName,
    middle_name: a.middleName || "",
    last_name: a.lastName,
    suffix: a.suffix || "",
    email: a.email,
    phone_number: a.phoneNumber || "",
    mobile_number: a.mobileNumber || "",
    role_scorecard_title: a.roleScorecard?.jobTitle || "",
    custom_job_title: a.customJobTitle || "",
    department_code: a.department?.code || "",
    hiring_entity_code: a.hiringEntity?.code || "",
    source: a.source || "",
    referred_by_employee_number: a.referredBy?.employeeNumber || "",
    resume_url: a.resumePath || "",
    portfolio_url: a.portfolioUrl || "",
    linkedin_url: a.linkedinUrl || "",
    expected_salary_min: a.expectedSalaryMin ? Number(a.expectedSalaryMin) : "",
    expected_salary_max: a.expectedSalaryMax ? Number(a.expectedSalaryMax) : "",
    expected_start_date: a.expectedStartDate?.toISOString().split("T")[0] || "",
    notes: a.notes || "",
  }));

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(dataRows, { header: TEMPLATE_HEADERS });

  // Set column widths
  ws["!cols"] = [
    { wch: 15 }, // first_name
    { wch: 15 }, // middle_name
    { wch: 15 }, // last_name
    { wch: 8 },  // suffix
    { wch: 30 }, // email
    { wch: 15 }, // phone_number
    { wch: 15 }, // mobile_number
    { wch: 25 }, // role_scorecard_title
    { wch: 25 }, // custom_job_title
    { wch: 15 }, // department_code
    { wch: 18 }, // hiring_entity_code
    { wch: 15 }, // source
    { wch: 25 }, // referred_by_employee_number
    { wch: 40 }, // resume_url
    { wch: 35 }, // portfolio_url
    { wch: 35 }, // linkedin_url
    { wch: 18 }, // expected_salary_min
    { wch: 18 }, // expected_salary_max
    { wch: 18 }, // expected_start_date
    { wch: 40 }, // notes
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Applicants");

  // Generate buffer
  const buffer = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

  return {
    success: true,
    fileName: `applicants-export-${new Date().toISOString().split("T")[0]}.xlsx`,
    content: buffer,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    isBase64: true,
    recordCount: applicants.length,
  };
}
