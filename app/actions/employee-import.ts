"use server";

// =============================================================================
// PeopleOS PH - Employee Import/Export Actions
// =============================================================================
// Server actions for importing employees from XLSX and exporting templates/data.
// =============================================================================

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertPermission, Permission } from "@/lib/rbac";
import { createAuditLogger } from "@/lib/audit";
import { headers } from "next/headers";
import * as XLSX from "xlsx";
import { generateEmployeeNumber } from "./employees";

// =============================================================================
// XLSX Template Structure
// =============================================================================

const TEMPLATE_HEADERS = [
  "first_name",          // Required: First name
  "middle_name",         // Optional: Middle name
  "last_name",           // Required: Last name
  "suffix",              // Optional: Suffix (Jr., Sr., III)
  "birth_date",          // Optional: YYYY-MM-DD format
  "gender",              // Optional: Male, Female, Other
  "civil_status",        // Optional: Single, Married, Widowed, Separated
  "nationality",         // Optional: Default "Filipino"
  "personal_email",      // Optional: Personal email
  "work_email",          // Optional: Work email
  "mobile_number",       // Optional: Mobile number
  "phone_number",        // Optional: Phone number
  "present_address",     // Optional: Present address (line 1)
  "present_city",        // Optional: City
  "present_province",    // Optional: Province
  "present_zip_code",    // Optional: Zip code
  "emergency_contact_name",         // Optional: Emergency contact name
  "emergency_contact_number",       // Optional: Emergency contact phone
  "emergency_contact_relationship", // Optional: Relationship to employee
  "sss_number",          // Optional: SSS number
  "philhealth_number",   // Optional: PhilHealth number
  "pagibig_number",      // Optional: Pag-IBIG number
  "tin_number",          // Optional: TIN number
  "metrobank_account",   // Optional: Metrobank account number
  "gcash_number",        // Optional: GCash number
  "role_scorecard_title",// Optional: Job title from role scorecard (determines department)
  "hiring_entity_code",  // Optional: Hiring entity code
  "employment_type",     // Required: REGULAR, PROBATIONARY, CONTRACTUAL, CONSULTANT, INTERN
  "hire_date",           // Required: YYYY-MM-DD format
  "reports_to_employee_number", // Optional: Manager's employee number
  "is_rank_and_file",    // Optional: TRUE or FALSE (default TRUE)
  "is_ot_eligible",      // Optional: TRUE or FALSE (default TRUE)
  "is_nd_eligible",      // Optional: TRUE or FALSE (default TRUE)
];

// =============================================================================
// Download XLSX Template
// =============================================================================

export async function downloadEmployeeTemplate() {
  const auth = await assertPermission(Permission.EMPLOYEE_VIEW);

  // Get departments, role scorecards, and hiring entities for reference
  const [departments, roleScorecards, hiringEntities, managers] = await Promise.all([
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
      select: { employeeNumber: true, firstName: true, lastName: true, jobTitle: true },
      orderBy: { lastName: "asc" },
    }),
  ]);

  // Create workbook with multiple sheets
  const wb = XLSX.utils.book_new();

  // Main data sheet with example row
  const exampleRow = {
    first_name: "Juan",
    middle_name: "Reyes",
    last_name: "Dela Cruz",
    suffix: "",
    birth_date: "1990-05-15",
    gender: "Male",
    civil_status: "Single",
    nationality: "Filipino",
    personal_email: "juan.delacruz@gmail.com",
    work_email: "juan.delacruz@company.com",
    mobile_number: "09171234567",
    phone_number: "",
    present_address: "123 Main Street, Barangay Central",
    present_city: "Makati City",
    present_province: "Metro Manila",
    present_zip_code: "1200",
    emergency_contact_name: "Maria Dela Cruz",
    emergency_contact_number: "09181234567",
    emergency_contact_relationship: "Mother",
    sss_number: "12-3456789-0",
    philhealth_number: "12-345678901-2",
    pagibig_number: "1234-5678-9012",
    tin_number: "123-456-789-000",
    metrobank_account: "1234567890123",
    gcash_number: "09171234567",
    role_scorecard_title: "Software Engineer",
    hiring_entity_code: "",
    employment_type: "PROBATIONARY",
    hire_date: "2025-01-15",
    reports_to_employee_number: "",
    is_rank_and_file: "TRUE",
    is_ot_eligible: "TRUE",
    is_nd_eligible: "TRUE",
  };

  const dataSheet = XLSX.utils.json_to_sheet([exampleRow], { header: TEMPLATE_HEADERS });
  dataSheet["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, dataSheet, "Employees");

  // Instructions sheet
  const instructionsData = [
    { Field: "Instructions", Description: "" },
    { Field: "", Description: "Fill in the 'Employees' sheet with your employee data." },
    { Field: "", Description: "Delete the example row before importing." },
    { Field: "", Description: "" },
    { Field: "Required Fields", Description: "" },
    { Field: "first_name", Description: "Employee's first name" },
    { Field: "last_name", Description: "Employee's last name" },
    { Field: "employment_type", Description: "REGULAR, PROBATIONARY, CONTRACTUAL, CONSULTANT, or INTERN" },
    { Field: "hire_date", Description: "Date (auto-detected: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.)" },
    { Field: "", Description: "" },
    { Field: "Optional Fields", Description: "" },
    { Field: "middle_name", Description: "Middle name" },
    { Field: "suffix", Description: "Name suffix (Jr., Sr., III, etc.)" },
    { Field: "birth_date", Description: "Date (auto-detected: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.)" },
    { Field: "gender", Description: "Male, Female, or Other" },
    { Field: "civil_status", Description: "Single, Married, Widowed, or Separated" },
    { Field: "nationality", Description: "Nationality (default: Filipino)" },
    { Field: "personal_email", Description: "Personal email address" },
    { Field: "work_email", Description: "Work email address" },
    { Field: "mobile_number", Description: "Mobile phone number" },
    { Field: "phone_number", Description: "Landline phone number" },
    { Field: "present_address", Description: "Street address" },
    { Field: "present_city", Description: "City" },
    { Field: "present_province", Description: "Province/Region" },
    { Field: "present_zip_code", Description: "Zip/Postal code" },
    { Field: "", Description: "" },
    { Field: "Emergency Contact", Description: "" },
    { Field: "emergency_contact_name", Description: "Name of emergency contact person" },
    { Field: "emergency_contact_number", Description: "Phone number of emergency contact" },
    { Field: "emergency_contact_relationship", Description: "Relationship to employee (e.g., Mother, Spouse)" },
    { Field: "", Description: "" },
    { Field: "Government IDs (Optional)", Description: "" },
    { Field: "sss_number", Description: "SSS number (e.g., 12-3456789-0)" },
    { Field: "philhealth_number", Description: "PhilHealth number" },
    { Field: "pagibig_number", Description: "Pag-IBIG MID number" },
    { Field: "tin_number", Description: "TIN number" },
    { Field: "", Description: "" },
    { Field: "Bank Accounts (Optional)", Description: "" },
    { Field: "metrobank_account", Description: "Metrobank account number (for payroll)" },
    { Field: "gcash_number", Description: "GCash number (for payroll)" },
    { Field: "", Description: "" },
    { Field: "Employment", Description: "" },
    { Field: "role_scorecard_title", Description: "Job title from role scorecards - determines department (see Roles sheet)" },
    { Field: "hiring_entity_code", Description: "Hiring entity code (see Hiring Entities sheet)" },
    { Field: "reports_to_employee_number", Description: "Manager's employee number" },
    { Field: "is_rank_and_file", Description: "TRUE or FALSE (default: TRUE)" },
    { Field: "is_ot_eligible", Description: "Overtime eligible - TRUE or FALSE (default: TRUE)" },
    { Field: "is_nd_eligible", Description: "Night diff eligible - TRUE or FALSE (default: TRUE)" },
  ];
  const instructionsSheet = XLSX.utils.json_to_sheet(instructionsData);
  instructionsSheet["!cols"] = [{ wch: 25 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, instructionsSheet, "Instructions");

  // Departments reference sheet
  if (departments.length > 0) {
    const deptData = departments.map((d) => ({ Code: d.code, Name: d.name }));
    const deptSheet = XLSX.utils.json_to_sheet(deptData);
    deptSheet["!cols"] = [{ wch: 15 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, deptSheet, "Departments");
  }

  // Role scorecards reference sheet
  if (roleScorecards.length > 0) {
    const roleData = roleScorecards.map((r) => ({ "Job Title": r.jobTitle }));
    const roleSheet = XLSX.utils.json_to_sheet(roleData);
    roleSheet["!cols"] = [{ wch: 40 }];
    XLSX.utils.book_append_sheet(wb, roleSheet, "Roles");
  }

  // Hiring entities reference sheet
  if (hiringEntities.length > 0) {
    const entityData = hiringEntities.map((e) => ({ Code: e.code, Name: e.name }));
    const entitySheet = XLSX.utils.json_to_sheet(entityData);
    entitySheet["!cols"] = [{ wch: 15 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, entitySheet, "Hiring Entities");
  }

  // Managers reference sheet
  if (managers.length > 0) {
    const managerData = managers.slice(0, 100).map((m) => ({
      "Employee Number": m.employeeNumber,
      Name: `${m.firstName} ${m.lastName}`,
      "Job Title": m.jobTitle || "",
    }));
    const managerSheet = XLSX.utils.json_to_sheet(managerData);
    managerSheet["!cols"] = [{ wch: 18 }, { wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, managerSheet, "Managers");
  }

  // Generate buffer
  const buffer = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

  return {
    success: true,
    fileName: "employee-import-template.xlsx",
    content: buffer,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    isBase64: true,
  };
}

// =============================================================================
// Parse XLSX Content
// =============================================================================

interface ParsedEmployee {
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  birthDate: string | null;
  gender: string | null;
  civilStatus: string | null;
  nationality: string;
  personalEmail: string | null;
  workEmail: string | null;
  mobileNumber: string | null;
  phoneNumber: string | null;
  presentAddress: string | null;
  presentCity: string | null;
  presentProvince: string | null;
  presentZipCode: string | null;
  // Emergency Contact
  emergencyContactName: string | null;
  emergencyContactNumber: string | null;
  emergencyContactRelationship: string | null;
  // Statutory IDs
  sssNumber: string | null;
  philhealthNumber: string | null;
  pagibigNumber: string | null;
  tinNumber: string | null;
  // Bank Accounts
  metrobankAccount: string | null;
  gcashNumber: string | null;
  // Employment
  roleScorecardTitle: string | null;
  hiringEntityCode: string | null;
  employmentType: "REGULAR" | "PROBATIONARY" | "CONTRACTUAL" | "CONSULTANT" | "INTERN";
  hireDate: string;
  reportsToEmployeeNumber: string | null;
  isRankAndFile: boolean;
  isOtEligible: boolean;
  isNdEligible: boolean;
  rowNumber: number;
}

interface ParseResult {
  success: boolean;
  employees: ParsedEmployee[];
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

    // Get the first sheet (Employees)
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];

    if (!sheet) {
      return { success: false, employees: [], errors: [{ row: 0, message: "No data sheet found" }] };
    }

    // Convert to JSON
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    if (rows.length === 0) {
      return { success: false, employees: [], errors: [{ row: 0, message: "No data rows found" }] };
    }

    const employees: ParsedEmployee[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 for header row and 0-index

      // Get values (handle various header formats)
      const getValue = (keys: string[]): string => {
        for (const key of keys) {
          if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
            return String(row[key]).trim();
          }
        }
        return "";
      };

      const firstName = getValue(["first_name", "First Name", "FirstName"]);
      const middleName = getValue(["middle_name", "Middle Name", "MiddleName"]);
      const lastName = getValue(["last_name", "Last Name", "LastName"]);
      const suffix = getValue(["suffix", "Suffix"]);
      const birthDate = getValue(["birth_date", "Birth Date", "BirthDate"]);
      const gender = getValue(["gender", "Gender"]);
      const civilStatus = getValue(["civil_status", "Civil Status", "CivilStatus"]);
      const nationality = getValue(["nationality", "Nationality"]) || "Filipino";
      const personalEmail = getValue(["personal_email", "Personal Email", "PersonalEmail"]);
      const workEmail = getValue(["work_email", "Work Email", "WorkEmail"]);
      const mobileNumber = getValue(["mobile_number", "Mobile Number", "MobileNumber"]);
      const phoneNumber = getValue(["phone_number", "Phone Number", "PhoneNumber"]);
      const presentAddress = getValue(["present_address", "Present Address", "PresentAddress"]);
      const presentCity = getValue(["present_city", "Present City", "PresentCity"]);
      const presentProvince = getValue(["present_province", "Present Province", "PresentProvince"]);
      const presentZipCode = getValue(["present_zip_code", "Present Zip Code", "PresentZipCode"]);
      // Emergency Contact
      const emergencyContactName = getValue(["emergency_contact_name", "Emergency Contact Name", "EmergencyContactName"]);
      const emergencyContactNumber = getValue(["emergency_contact_number", "Emergency Contact Number", "EmergencyContactNumber"]);
      const emergencyContactRelationship = getValue(["emergency_contact_relationship", "Emergency Contact Relationship", "EmergencyContactRelationship"]);
      // Statutory IDs
      const sssNumber = getValue(["sss_number", "SSS Number", "SssNumber", "SSS"]);
      const philhealthNumber = getValue(["philhealth_number", "PhilHealth Number", "PhilhealthNumber", "PhilHealth"]);
      const pagibigNumber = getValue(["pagibig_number", "Pag-IBIG Number", "PagibigNumber", "Pag-IBIG", "PAGIBIG"]);
      const tinNumber = getValue(["tin_number", "TIN Number", "TinNumber", "TIN"]);
      // Bank Accounts
      const metrobankAccount = getValue(["metrobank_account", "Metrobank Account", "MetrobankAccount", "Metrobank"]);
      const gcashNumber = getValue(["gcash_number", "GCash Number", "GcashNumber", "GCash"]);
      // Employment
      const roleScorecardTitle = getValue(["role_scorecard_title", "Role Scorecard Title", "RoleScorecardTitle"]);
      const hiringEntityCode = getValue(["hiring_entity_code", "Hiring Entity Code", "HiringEntityCode"]);
      const employmentType = getValue(["employment_type", "Employment Type", "EmploymentType"]).toUpperCase();
      const hireDate = getValue(["hire_date", "Hire Date", "HireDate"]);
      const reportsToEmployeeNumber = getValue(["reports_to_employee_number", "Reports To Employee Number", "ReportsToEmployeeNumber"]);
      const isRankAndFileStr = getValue(["is_rank_and_file", "Is Rank And File", "IsRankAndFile"]);
      const isOtEligibleStr = getValue(["is_ot_eligible", "Is OT Eligible", "IsOtEligible"]);
      const isNdEligibleStr = getValue(["is_nd_eligible", "Is ND Eligible", "IsNdEligible"]);

      // Validate required fields
      if (!firstName) {
        errors.push({ row: rowNumber, message: "first_name is required" });
        continue;
      }
      if (!lastName) {
        errors.push({ row: rowNumber, message: "last_name is required" });
        continue;
      }
      if (!employmentType) {
        errors.push({ row: rowNumber, message: "employment_type is required" });
        continue;
      }
      const validEmploymentTypes = ["REGULAR", "PROBATIONARY", "CONTRACTUAL", "CONSULTANT", "INTERN"];
      if (!validEmploymentTypes.includes(employmentType)) {
        errors.push({ row: rowNumber, message: `employment_type must be one of: ${validEmploymentTypes.join(", ")} (got: ${employmentType})` });
        continue;
      }
      if (!hireDate) {
        errors.push({ row: rowNumber, message: "hire_date is required" });
        continue;
      }

      // Parse dates (auto-detect various formats)
      const parseDate = (value: unknown, fieldName: string): string | null => {
        if (!value) return null;

        // Handle Excel serial date numbers
        if (typeof value === "number") {
          const date = XLSX.SSF.parse_date_code(value);
          return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
        }

        const strValue = String(value).trim();
        if (!strValue) return null;

        // Try to auto-detect and parse various date formats
        let year: number, month: number, day: number;

        // ISO format: YYYY-MM-DD
        const isoMatch = strValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (isoMatch) {
          year = parseInt(isoMatch[1], 10);
          month = parseInt(isoMatch[2], 10);
          day = parseInt(isoMatch[3], 10);
        }
        // US format: MM/DD/YYYY or M/D/YYYY
        else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(strValue)) {
          const parts = strValue.split("/");
          month = parseInt(parts[0], 10);
          day = parseInt(parts[1], 10);
          year = parseInt(parts[2], 10);
        }
        // EU/PH format: DD/MM/YYYY or D/M/YYYY (if day > 12, we know it's day first)
        // Also handles MM-DD-YYYY and DD-MM-YYYY with dashes
        else if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(strValue)) {
          const parts = strValue.split(/[-/]/);
          const first = parseInt(parts[0], 10);
          const second = parseInt(parts[1], 10);
          year = parseInt(parts[2], 10);

          // If first number > 12, it must be day (DD/MM/YYYY)
          // If second number > 12, it must be day (MM/DD/YYYY)
          // Otherwise assume MM/DD/YYYY (US format common in Excel)
          if (first > 12) {
            day = first;
            month = second;
          } else if (second > 12) {
            month = first;
            day = second;
          } else {
            // Ambiguous - assume MM/DD/YYYY
            month = first;
            day = second;
          }
        }
        // Short year formats: MM/DD/YY or DD/MM/YY
        else if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(strValue)) {
          const parts = strValue.split("/");
          const first = parseInt(parts[0], 10);
          const second = parseInt(parts[1], 10);
          let shortYear = parseInt(parts[2], 10);
          // Assume 2000s for years 00-50, 1900s for 51-99
          year = shortYear <= 50 ? 2000 + shortYear : 1900 + shortYear;

          if (first > 12) {
            day = first;
            month = second;
          } else if (second > 12) {
            month = first;
            day = second;
          } else {
            month = first;
            day = second;
          }
        }
        // Format: YYYY/MM/DD
        else if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(strValue)) {
          const parts = strValue.split("/");
          year = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10);
          day = parseInt(parts[2], 10);
        }
        // Format with text month: "Jan 15, 2023" or "15 Jan 2023" or "January 15, 2023"
        else {
          const dateObj = new Date(strValue);
          if (!isNaN(dateObj.getTime())) {
            year = dateObj.getFullYear();
            month = dateObj.getMonth() + 1;
            day = dateObj.getDate();
          } else {
            errors.push({ row: rowNumber, message: `${fieldName}: Could not parse date "${strValue}"` });
            return null;
          }
        }

        // Validate the parsed date
        if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
          errors.push({ row: rowNumber, message: `${fieldName}: Invalid date values in "${strValue}"` });
          return null;
        }

        // Return in ISO format
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      };

      // Get raw date values for parsing
      const rawHireDate = row["hire_date"] ?? row["Hire Date"] ?? row["HireDate"];
      const rawBirthDate = row["birth_date"] ?? row["Birth Date"] ?? row["BirthDate"];

      const parsedHireDate = parseDate(rawHireDate, "hire_date");
      const parsedBirthDate = parseDate(rawBirthDate, "birth_date");

      if (!parsedHireDate) {
        continue; // Error already added in parseDate
      }

      // Parse boolean fields
      const parseBoolean = (value: string, defaultValue: boolean): boolean => {
        if (!value) return defaultValue;
        return value.toUpperCase() === "TRUE";
      };

      employees.push({
        firstName,
        middleName: middleName || null,
        lastName,
        suffix: suffix || null,
        birthDate: parsedBirthDate,
        gender: gender || null,
        civilStatus: civilStatus || null,
        nationality,
        personalEmail: personalEmail || null,
        workEmail: workEmail || null,
        mobileNumber: mobileNumber || null,
        phoneNumber: phoneNumber || null,
        presentAddress: presentAddress || null,
        presentCity: presentCity || null,
        presentProvince: presentProvince || null,
        presentZipCode: presentZipCode || null,
        // Emergency Contact
        emergencyContactName: emergencyContactName || null,
        emergencyContactNumber: emergencyContactNumber || null,
        emergencyContactRelationship: emergencyContactRelationship || null,
        // Statutory IDs
        sssNumber: sssNumber || null,
        philhealthNumber: philhealthNumber || null,
        pagibigNumber: pagibigNumber || null,
        tinNumber: tinNumber || null,
        // Bank Accounts
        metrobankAccount: metrobankAccount || null,
        gcashNumber: gcashNumber || null,
        // Employment
        roleScorecardTitle: roleScorecardTitle || null,
        hiringEntityCode: hiringEntityCode || null,
        employmentType: employmentType as ParsedEmployee["employmentType"],
        hireDate: parsedHireDate,
        reportsToEmployeeNumber: reportsToEmployeeNumber || null,
        isRankAndFile: parseBoolean(isRankAndFileStr, true),
        isOtEligible: parseBoolean(isOtEligibleStr, true),
        isNdEligible: parseBoolean(isNdEligibleStr, true),
        rowNumber,
      });
    }

    return {
      success: errors.length === 0,
      employees,
      errors,
    };
  } catch (error) {
    console.error("Failed to parse XLSX:", error);
    return {
      success: false,
      employees: [],
      errors: [{ row: 0, message: `Failed to parse XLSX file: ${error instanceof Error ? error.message : "Unknown error"}` }],
    };
  }
}

// =============================================================================
// Validate Import (Preview)
// =============================================================================

export interface EmployeeImportValidationResult {
  success: boolean;
  validEmployees: {
    rowNumber: number;
    name: string;
    departmentName: string | null;
    roleScorecardTitle: string | null;
    employmentType: string;
    hireDate: string;
    reportsToName: string | null;
  }[];
  errors: { row: number; message: string }[];
  warnings: { row: number; message: string }[];
}

export async function validateEmployeeImport(
  base64Content: string
): Promise<EmployeeImportValidationResult> {
  const auth = await assertPermission(Permission.EMPLOYEE_CREATE);

  // Parse XLSX
  const parseResult = parseXLSXContent(base64Content);

  if (parseResult.errors.length > 0 && parseResult.employees.length === 0) {
    return {
      success: false,
      validEmployees: [],
      errors: parseResult.errors,
      warnings: [],
    };
  }

  // Lookup reference data
  const [departments, roleScorecards, hiringEntities, existingEmployees] = await Promise.all([
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
      select: { id: true, employeeNumber: true, firstName: true, lastName: true },
    }),
  ]);

  const deptByCode = new Map(departments.map((d) => [d.code.toLowerCase(), d]));
  const roleByTitle = new Map(roleScorecards.map((r) => [r.jobTitle.toLowerCase(), r]));
  const entityByCode = new Map(hiringEntities.map((e) => [e.code.toLowerCase(), e]));
  const employeeByNumber = new Map(existingEmployees.map((e) => [e.employeeNumber.toLowerCase(), e]));

  const validEmployees: EmployeeImportValidationResult["validEmployees"] = [];
  const warnings: { row: number; message: string }[] = [];
  const errors: { row: number; message: string }[] = [...parseResult.errors];

  for (const emp of parseResult.employees) {
    // Validate role scorecard title if provided (department comes from role scorecard)
    let roleScorecardTitle: string | null = null;
    let departmentName: string | null = null;
    if (emp.roleScorecardTitle) {
      const role = roleByTitle.get(emp.roleScorecardTitle.toLowerCase());
      if (!role) {
        warnings.push({
          row: emp.rowNumber,
          message: `Role scorecard '${emp.roleScorecardTitle}' not found - no department or job title will be assigned`,
        });
      } else {
        roleScorecardTitle = role.jobTitle;
        // Department comes from role scorecard
        const dept = departments.find((d) => d.id === role.departmentId);
        if (dept) departmentName = dept.name;
      }
    }

    // Validate hiring entity code if provided
    if (emp.hiringEntityCode) {
      const entity = entityByCode.get(emp.hiringEntityCode.toLowerCase());
      if (!entity) {
        warnings.push({
          row: emp.rowNumber,
          message: `Hiring entity code '${emp.hiringEntityCode}' not found - will be left blank`,
        });
      }
    }

    // Validate reports to employee number if provided
    let reportsToName: string | null = null;
    if (emp.reportsToEmployeeNumber) {
      const manager = employeeByNumber.get(emp.reportsToEmployeeNumber.toLowerCase());
      if (!manager) {
        warnings.push({
          row: emp.rowNumber,
          message: `Manager '${emp.reportsToEmployeeNumber}' not found - will be left blank`,
        });
      } else {
        reportsToName = `${manager.firstName} ${manager.lastName}`;
      }
    }

    validEmployees.push({
      rowNumber: emp.rowNumber,
      name: `${emp.firstName} ${emp.middleName ? emp.middleName + " " : ""}${emp.lastName}${emp.suffix ? " " + emp.suffix : ""}`,
      departmentName,
      roleScorecardTitle: roleScorecardTitle,
      employmentType: emp.employmentType,
      hireDate: emp.hireDate,
      reportsToName,
    });
  }

  return {
    success: errors.length === 0,
    validEmployees,
    errors,
    warnings,
  };
}

// =============================================================================
// Import Employees
// =============================================================================

export interface EmployeeImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export async function importEmployees(base64Content: string): Promise<EmployeeImportResult> {
  const auth = await assertPermission(Permission.EMPLOYEE_CREATE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  // Parse XLSX
  const parseResult = parseXLSXContent(base64Content);

  if (parseResult.errors.length > 0 && parseResult.employees.length === 0) {
    return {
      success: false,
      imported: 0,
      skipped: parseResult.errors.length,
      errors: parseResult.errors,
    };
  }

  // Lookup reference data
  const [departments, roleScorecards, hiringEntities, existingEmployees] = await Promise.all([
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
  ]);

  const roleByTitle = new Map(roleScorecards.map((r) => [r.jobTitle.toLowerCase(), r]));
  const entityByCode = new Map(hiringEntities.map((e) => [e.code.toLowerCase(), e.id]));
  const employeeByNumber = new Map(existingEmployees.map((e) => [e.employeeNumber.toLowerCase(), e.id]));

  let imported = 0;
  const errors: { row: number; message: string }[] = [...parseResult.errors];

  // Import each employee
  for (const emp of parseResult.employees) {
    try {
      // Auto-generate employee number
      const employeeNumber = await generateEmployeeNumber(auth.user.companyId);

      // Resolve references from role scorecard (department comes from role scorecard)
      let departmentId: string | null = null;
      let roleScorecardId: string | null = null;
      let derivedJobTitle: string | null = null;

      // If role scorecard is provided, use it to derive department and job title
      if (emp.roleScorecardTitle) {
        const role = roleByTitle.get(emp.roleScorecardTitle.toLowerCase());
        if (role) {
          roleScorecardId = role.id;
          derivedJobTitle = role.jobTitle;
          departmentId = role.departmentId;
        }
      }

      const hiringEntityId = emp.hiringEntityCode
        ? entityByCode.get(emp.hiringEntityCode.toLowerCase()) || null
        : null;

      // Resolve manager (will be set in a second pass if needed)
      let reportsToId: string | null = null;
      if (emp.reportsToEmployeeNumber) {
        reportsToId = employeeByNumber.get(emp.reportsToEmployeeNumber.toLowerCase()) || null;
      }

      const employee = await prisma.employee.create({
        data: {
          companyId: auth.user.companyId,
          employeeNumber: employeeNumber,
          firstName: emp.firstName,
          middleName: emp.middleName,
          lastName: emp.lastName,
          suffix: emp.suffix,
          birthDate: emp.birthDate ? new Date(emp.birthDate) : undefined,
          gender: emp.gender,
          civilStatus: emp.civilStatus,
          nationality: emp.nationality,
          personalEmail: emp.personalEmail,
          workEmail: emp.workEmail,
          mobileNumber: emp.mobileNumber,
          phoneNumber: emp.phoneNumber,
          presentAddressLine1: emp.presentAddress,
          presentCity: emp.presentCity,
          presentProvince: emp.presentProvince,
          presentZipCode: emp.presentZipCode,
          // Emergency Contact
          emergencyContactName: emp.emergencyContactName,
          emergencyContactNumber: emp.emergencyContactNumber,
          emergencyContactRelationship: emp.emergencyContactRelationship,
          // Employment
          departmentId,
          roleScorecardId,
          jobTitle: derivedJobTitle,
          hiringEntityId,
          employmentType: emp.employmentType,
          employmentStatus: "ACTIVE",
          hireDate: new Date(emp.hireDate),
          reportsToId,
          isRankAndFile: emp.isRankAndFile,
          isOtEligible: emp.isOtEligible,
          isNdEligible: emp.isNdEligible,
        },
      });

      // Create statutory IDs if provided
      const statutoryIds: Array<{ idType: string; idNumber: string }> = [];
      if (emp.sssNumber) statutoryIds.push({ idType: "sss", idNumber: emp.sssNumber });
      if (emp.philhealthNumber) statutoryIds.push({ idType: "philhealth", idNumber: emp.philhealthNumber });
      if (emp.pagibigNumber) statutoryIds.push({ idType: "pagibig", idNumber: emp.pagibigNumber });
      if (emp.tinNumber) statutoryIds.push({ idType: "tin", idNumber: emp.tinNumber });

      if (statutoryIds.length > 0) {
        await prisma.employeeStatutoryId.createMany({
          data: statutoryIds.map((id) => ({
            employeeId: employee.id,
            idType: id.idType,
            idNumber: id.idNumber,
          })),
        });
      }

      // Create bank accounts if provided
      const bankAccounts: Array<{
        bankCode: string;
        bankName: string;
        accountNumber: string;
        accountName: string;
        isPrimary: boolean;
      }> = [];

      if (emp.metrobankAccount) {
        bankAccounts.push({
          bankCode: "MBTC",
          bankName: "Metrobank",
          accountNumber: emp.metrobankAccount,
          accountName: `${emp.firstName} ${emp.lastName}`,
          isPrimary: true,
        });
      }

      if (emp.gcashNumber) {
        bankAccounts.push({
          bankCode: "GCASH",
          bankName: "GCash",
          accountNumber: emp.gcashNumber,
          accountName: `${emp.firstName} ${emp.lastName}`,
          isPrimary: !emp.metrobankAccount, // Primary if no Metrobank
        });
      }

      if (bankAccounts.length > 0) {
        await prisma.employeeBankAccount.createMany({
          data: bankAccounts.map((ba) => ({
            employeeId: employee.id,
            bankCode: ba.bankCode,
            bankName: ba.bankName,
            accountNumber: ba.accountNumber,
            accountName: ba.accountName,
            isPrimary: ba.isPrimary,
          })),
        });
      }

      // Add to map for cross-referencing managers within the same import
      employeeByNumber.set(employeeNumber.toLowerCase(), employee.id);

      // Create HIRE employment event
      await prisma.employmentEvent.create({
        data: {
          employeeId: employee.id,
          eventType: "HIRE",
          eventDate: new Date(emp.hireDate),
          status: "APPROVED",
          payload: {
            employmentType: emp.employmentType,
            roleScorecardId,
            jobTitle: derivedJobTitle,
            departmentId,
            importedFrom: "XLSX",
          },
          approvedById: auth.user.id,
          approvedAt: new Date(),
        },
      });

      await audit.create("Employee", employee.id, {
        employeeNumber: employeeNumber,
        name: `${emp.firstName} ${emp.lastName}`,
        importedFrom: "XLSX",
      });

      imported++;
    } catch (error) {
      console.error(`Failed to import row ${emp.rowNumber}:`, error);
      errors.push({
        row: emp.rowNumber,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  revalidatePath("/employees");

  return {
    success: errors.length === 0,
    imported,
    skipped: errors.length,
    errors,
  };
}

// =============================================================================
// Export Existing Employees
// =============================================================================

export async function exportEmployees() {
  const auth = await assertPermission(Permission.EMPLOYEE_VIEW);

  const employees = await prisma.employee.findMany({
    where: { companyId: auth.user.companyId, deletedAt: null },
    include: {
      roleScorecard: { select: { jobTitle: true } },
      hiringEntity: { select: { code: true } },
      reportsTo: { select: { employeeNumber: true } },
      statutoryIds: { select: { idType: true, idNumber: true } },
      bankAccounts: { select: { bankCode: true, accountNumber: true } },
    },
    orderBy: { employeeNumber: "asc" },
  });

  // Build data rows
  const dataRows = employees.map((e) => {
    // Extract statutory IDs
    const sssId = e.statutoryIds.find((id) => id.idType === "sss");
    const philhealthId = e.statutoryIds.find((id) => id.idType === "philhealth");
    const pagibigId = e.statutoryIds.find((id) => id.idType === "pagibig");
    const tinId = e.statutoryIds.find((id) => id.idType === "tin");

    // Extract bank accounts
    const metrobankAccount = e.bankAccounts.find((ba) => ba.bankCode === "MBTC");
    const gcashAccount = e.bankAccounts.find((ba) => ba.bankCode === "GCASH");

    return {
      first_name: e.firstName,
      middle_name: e.middleName || "",
      last_name: e.lastName,
      suffix: e.suffix || "",
      birth_date: e.birthDate?.toISOString().split("T")[0] || "",
      gender: e.gender || "",
      civil_status: e.civilStatus || "",
      nationality: e.nationality,
      personal_email: e.personalEmail || "",
      work_email: e.workEmail || "",
      mobile_number: e.mobileNumber || "",
      phone_number: e.phoneNumber || "",
      present_address: e.presentAddressLine1 || "",
      present_city: e.presentCity || "",
      present_province: e.presentProvince || "",
      present_zip_code: e.presentZipCode || "",
      // Emergency Contact
      emergency_contact_name: e.emergencyContactName || "",
      emergency_contact_number: e.emergencyContactNumber || "",
      emergency_contact_relationship: e.emergencyContactRelationship || "",
      // Statutory IDs
      sss_number: sssId?.idNumber || "",
      philhealth_number: philhealthId?.idNumber || "",
      pagibig_number: pagibigId?.idNumber || "",
      tin_number: tinId?.idNumber || "",
      // Bank Accounts
      metrobank_account: metrobankAccount?.accountNumber || "",
      gcash_number: gcashAccount?.accountNumber || "",
      // Employment
      role_scorecard_title: e.roleScorecard?.jobTitle || "",
      hiring_entity_code: e.hiringEntity?.code || "",
      employment_type: e.employmentType,
      hire_date: e.hireDate.toISOString().split("T")[0],
      reports_to_employee_number: e.reportsTo?.employeeNumber || "",
      is_rank_and_file: e.isRankAndFile ? "TRUE" : "FALSE",
      is_ot_eligible: e.isOtEligible ? "TRUE" : "FALSE",
      is_nd_eligible: e.isNdEligible ? "TRUE" : "FALSE",
    };
  });

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(dataRows, { header: TEMPLATE_HEADERS });
  ws["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ws, "Employees");

  // Generate buffer
  const buffer = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

  return {
    success: true,
    fileName: `employees-export-${new Date().toISOString().split("T")[0]}.xlsx`,
    content: buffer,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    isBase64: true,
    recordCount: employees.length,
  };
}
