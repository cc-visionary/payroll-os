"use server";

// =============================================================================
// PeopleOS PH - Role Scorecard Import/Export Actions
// =============================================================================
// Server actions for importing role scorecards from XLSX and exporting templates.
// Uses denormalized format - multiple rows with same job_title = one role.
// =============================================================================

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertPermission, Permission } from "@/lib/rbac";
import { createAuditLogger } from "@/lib/audit";
import { headers } from "next/headers";
import * as XLSX from "xlsx";

// =============================================================================
// XLSX Template Structure (Denormalized Format)
// =============================================================================
// Multiple rows with the same job_title are grouped into one role scorecard.
// Each row can have one responsibility_area + task, and one KPI.
// This makes it easy to fill out in Excel without needing JSON.
// =============================================================================

const TEMPLATE_HEADERS = [
  "job_title",           // Required: Job title (e.g., "Software Engineer") - same title = same role
  "department_code",     // Optional: Department code (only needed on first row for each role)
  "mission_statement",   // Required: Mission statement (only needed on first row for each role)
  "wage_type",           // Required: MONTHLY, DAILY, or HOURLY (only needed on first row)
  "base_salary",         // Optional: Base salary (only needed on first row)
  "salary_range_min",    // Optional: Minimum salary (only needed on first row)
  "salary_range_max",    // Optional: Maximum salary (only needed on first row)
  "shift_template_code", // Optional: Shift template code (only needed on first row)
  "work_hours_per_day",  // Optional: Default 8 (only needed on first row)
  "work_days_per_week",  // Optional: e.g., "Monday to Friday" (only needed on first row)
  "responsibility_area", // Optional: Responsibility area (e.g., "Development")
  "task",                // Optional: Task under the responsibility area (e.g., "Write clean code")
  "kpi_metric",          // Optional: KPI metric (e.g., "Code quality score")
  "kpi_frequency",       // Optional: KPI frequency (e.g., "Monthly")
  "effective_date",      // Required: YYYY-MM-DD format (only needed on first row)
];

// =============================================================================
// Download XLSX Template
// =============================================================================

export async function downloadRoleScorecardTemplate() {
  const auth = await assertPermission(Permission.ROLE_SCORECARD_VIEW);

  const [departments, shiftTemplates] = await Promise.all([
    prisma.department.findMany({
      where: { companyId: auth.user.companyId, deletedAt: null },
      select: { code: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.shiftTemplate.findMany({
      where: { companyId: auth.user.companyId },
      select: { code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);

  // Create workbook with multiple sheets
  const wb = XLSX.utils.book_new();

  // Main data sheet - Example with denormalized format
  // Same job_title = same role, multiple rows for responsibilities and KPIs
  const exampleRows = [
    {
      job_title: "Software Engineer",
      department_code: "ENG",
      mission_statement: "Design, develop, and maintain software applications.",
      wage_type: "MONTHLY",
      base_salary: 45000,
      salary_range_min: 40000,
      salary_range_max: 60000,
      shift_template_code: "900-1800",
      work_hours_per_day: 8,
      work_days_per_week: "Monday to Friday",
      responsibility_area: "Development",
      task: "Write clean, maintainable code",
      kpi_metric: "Code quality score",
      kpi_frequency: "Monthly",
      effective_date: "2025-01-01",
    },
    {
      job_title: "Software Engineer",
      department_code: "",
      mission_statement: "",
      wage_type: "",
      base_salary: "",
      salary_range_min: "",
      salary_range_max: "",
      shift_template_code: "",
      work_hours_per_day: "",
      work_days_per_week: "",
      responsibility_area: "Development",
      task: "Review pull requests",
      kpi_metric: "Sprint velocity",
      kpi_frequency: "Weekly",
      effective_date: "",
    },
    {
      job_title: "Software Engineer",
      department_code: "",
      mission_statement: "",
      wage_type: "",
      base_salary: "",
      salary_range_min: "",
      salary_range_max: "",
      shift_template_code: "",
      work_hours_per_day: "",
      work_days_per_week: "",
      responsibility_area: "Testing",
      task: "Write unit tests",
      kpi_metric: "",
      kpi_frequency: "",
      effective_date: "",
    },
    {
      job_title: "HR Manager",
      department_code: "HR",
      mission_statement: "Oversee all human resources operations and policies.",
      wage_type: "MONTHLY",
      base_salary: 55000,
      salary_range_min: 50000,
      salary_range_max: 70000,
      shift_template_code: "900-1800",
      work_hours_per_day: 8,
      work_days_per_week: "Monday to Friday",
      responsibility_area: "Recruitment",
      task: "Manage hiring process",
      kpi_metric: "Time to hire",
      kpi_frequency: "Monthly",
      effective_date: "2025-01-01",
    },
    {
      job_title: "HR Manager",
      department_code: "",
      mission_statement: "",
      wage_type: "",
      base_salary: "",
      salary_range_min: "",
      salary_range_max: "",
      shift_template_code: "",
      work_hours_per_day: "",
      work_days_per_week: "",
      responsibility_area: "Employee Relations",
      task: "Handle employee concerns",
      kpi_metric: "Employee satisfaction score",
      kpi_frequency: "Quarterly",
      effective_date: "",
    },
  ];

  const dataSheet = XLSX.utils.json_to_sheet(exampleRows, { header: TEMPLATE_HEADERS });

  // Set column widths
  dataSheet["!cols"] = [
    { wch: 25 }, // job_title
    { wch: 15 }, // department_code
    { wch: 50 }, // mission_statement
    { wch: 12 }, // wage_type
    { wch: 12 }, // base_salary
    { wch: 15 }, // salary_range_min
    { wch: 15 }, // salary_range_max
    { wch: 18 }, // shift_template_code
    { wch: 18 }, // work_hours_per_day
    { wch: 20 }, // work_days_per_week
    { wch: 25 }, // responsibility_area
    { wch: 40 }, // task
    { wch: 30 }, // kpi_metric
    { wch: 15 }, // kpi_frequency
    { wch: 15 }, // effective_date
  ];

  XLSX.utils.book_append_sheet(wb, dataSheet, "Roles");

  // Instructions sheet
  const instructionsData = [
    { Field: "Instructions", Description: "" },
    { Field: "", Description: "Fill in the 'Roles' sheet with your role scorecard data." },
    { Field: "", Description: "Delete the example rows before importing." },
    { Field: "", Description: "" },
    { Field: "HOW IT WORKS", Description: "" },
    { Field: "", Description: "Multiple rows with the SAME job_title = ONE role scorecard." },
    { Field: "", Description: "Use multiple rows to add multiple responsibilities and KPIs." },
    { Field: "", Description: "" },
    { Field: "FIRST ROW", Description: "For each role, the first row needs all required fields." },
    { Field: "", Description: "Subsequent rows only need: job_title, responsibility_area, task, kpi_metric, kpi_frequency" },
    { Field: "", Description: "" },
    { Field: "Required Fields", Description: "(only needed on first row for each role)" },
    { Field: "job_title", Description: "The job title (e.g., 'Software Engineer')" },
    { Field: "mission_statement", Description: "The role's mission statement" },
    { Field: "wage_type", Description: "Must be: MONTHLY, DAILY, or HOURLY" },
    { Field: "effective_date", Description: "Date in YYYY-MM-DD format (e.g., 2025-01-01)" },
    { Field: "", Description: "" },
    { Field: "Optional Fields", Description: "(only needed on first row for each role)" },
    { Field: "department_code", Description: "Department code to link the role to" },
    { Field: "base_salary", Description: "Base salary amount (number)" },
    { Field: "salary_range_min", Description: "Minimum salary (number)" },
    { Field: "salary_range_max", Description: "Maximum salary (number)" },
    { Field: "shift_template_code", Description: "Shift template code (e.g., '900-1800')" },
    { Field: "work_hours_per_day", Description: "Work hours per day (default: 8)" },
    { Field: "work_days_per_week", Description: "Work days description (e.g., 'Monday to Friday')" },
    { Field: "", Description: "" },
    { Field: "Responsibilities", Description: "(can be added on any row for the role)" },
    { Field: "responsibility_area", Description: "Area of responsibility (e.g., 'Development')" },
    { Field: "task", Description: "Specific task under that area (e.g., 'Write clean code')" },
    { Field: "", Description: "" },
    { Field: "KPIs", Description: "(can be added on any row for the role)" },
    { Field: "kpi_metric", Description: "KPI metric name (e.g., 'Code quality score')" },
    { Field: "kpi_frequency", Description: "How often measured (e.g., 'Monthly', 'Weekly')" },
  ];
  const instructionsSheet = XLSX.utils.json_to_sheet(instructionsData);
  instructionsSheet["!cols"] = [{ wch: 20 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, instructionsSheet, "Instructions");

  // Departments reference sheet
  if (departments.length > 0) {
    const deptData = departments.map((d) => ({ Code: d.code, Name: d.name }));
    const deptSheet = XLSX.utils.json_to_sheet(deptData);
    deptSheet["!cols"] = [{ wch: 15 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, deptSheet, "Departments");
  }

  // Shift templates reference sheet
  if (shiftTemplates.length > 0) {
    const shiftData = shiftTemplates.map((s) => ({ Code: s.code, Name: s.name }));
    const shiftSheet = XLSX.utils.json_to_sheet(shiftData);
    shiftSheet["!cols"] = [{ wch: 15 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, shiftSheet, "Shift Templates");
  }

  // Generate buffer
  const buffer = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

  return {
    success: true,
    fileName: "role-scorecard-template.xlsx",
    content: buffer,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    isBase64: true,
  };
}

// =============================================================================
// Parse XLSX Content (Denormalized Format)
// =============================================================================

interface ParsedRole {
  jobTitle: string;
  departmentCode: string | null;
  missionStatement: string;
  wageType: "MONTHLY" | "DAILY" | "HOURLY";
  baseSalary: number | null;
  salaryRangeMin: number | null;
  salaryRangeMax: number | null;
  shiftTemplateCode: string | null;
  workHoursPerDay: number;
  workDaysPerWeek: string;
  responsibilities: { area: string; tasks: string[] }[];
  kpis: { metric: string; frequency: string }[];
  effectiveDate: string;
  rowNumbers: number[]; // Track all rows that contributed to this role
}

interface ParseResult {
  success: boolean;
  roles: ParsedRole[];
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

    // Get the first sheet (Roles)
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];

    if (!sheet) {
      return { success: false, roles: [], errors: [{ row: 0, message: "No data sheet found" }] };
    }

    // Convert to JSON
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    if (rows.length === 0) {
      return { success: false, roles: [], errors: [{ row: 0, message: "No data rows found" }] };
    }

    // Group rows by job_title (denormalized format)
    const roleMap = new Map<string, {
      rows: { row: Record<string, unknown>; rowNumber: number }[];
    }>();
    const errors: { row: number; message: string }[] = [];

    // Helper to get value from row
    const getValue = (row: Record<string, unknown>, keys: string[]): string => {
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
          return String(row[key]).trim();
        }
      }
      return "";
    };

    // First pass: group rows by job_title
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 for header row and 0-index

      const jobTitle = getValue(row, ["job_title", "Job Title", "JobTitle", "job title"]);

      if (!jobTitle) {
        errors.push({ row: rowNumber, message: "job_title is required" });
        continue;
      }

      const normalizedTitle = jobTitle.toLowerCase().trim();
      if (!roleMap.has(normalizedTitle)) {
        roleMap.set(normalizedTitle, { rows: [] });
      }
      roleMap.get(normalizedTitle)!.rows.push({ row, rowNumber });
    }

    // Second pass: parse grouped rows into roles
    const roles: ParsedRole[] = [];

    for (const [, group] of roleMap) {
      const firstRow = group.rows[0];
      const row = firstRow.row;
      const rowNumber = firstRow.rowNumber;

      // Get basic fields from first row
      const jobTitle = getValue(row, ["job_title", "Job Title", "JobTitle", "job title"]);
      const departmentCode = getValue(row, ["department_code", "Department Code", "DepartmentCode", "department code"]);
      const missionStatement = getValue(row, ["mission_statement", "Mission Statement", "MissionStatement", "mission statement"]);
      const wageType = getValue(row, ["wage_type", "Wage Type", "WageType", "wage type"]).toUpperCase();
      const baseSalary = getValue(row, ["base_salary", "Base Salary", "BaseSalary", "base salary"]);
      const salaryRangeMin = getValue(row, ["salary_range_min", "Salary Range Min", "SalaryRangeMin", "salary range min"]);
      const salaryRangeMax = getValue(row, ["salary_range_max", "Salary Range Max", "SalaryRangeMax", "salary range max"]);
      const shiftTemplateCode = getValue(row, ["shift_template_code", "Shift Template Code", "ShiftTemplateCode", "shift template code"]);
      const workHoursPerDay = getValue(row, ["work_hours_per_day", "Work Hours Per Day", "WorkHoursPerDay", "work hours per day"]);
      const workDaysPerWeek = getValue(row, ["work_days_per_week", "Work Days Per Week", "WorkDaysPerWeek", "work days per week"]);
      const effectiveDateRaw = getValue(row, ["effective_date", "Effective Date", "EffectiveDate", "effective date"]);

      // Validate required fields from first row
      if (!missionStatement) {
        errors.push({ row: rowNumber, message: "mission_statement is required (on first row for this role)" });
        continue;
      }
      if (!wageType) {
        errors.push({ row: rowNumber, message: "wage_type is required (on first row for this role)" });
        continue;
      }
      if (!["MONTHLY", "DAILY", "HOURLY"].includes(wageType)) {
        errors.push({ row: rowNumber, message: `wage_type must be MONTHLY, DAILY, or HOURLY (got: ${wageType})` });
        continue;
      }
      if (!effectiveDateRaw) {
        errors.push({ row: rowNumber, message: "effective_date is required (on first row for this role)" });
        continue;
      }

      // Parse effective date (handle Excel date numbers)
      let effectiveDate: string;
      const dateValue = row["effective_date"] ?? row["Effective Date"];
      if (typeof dateValue === "number") {
        const date = XLSX.SSF.parse_date_code(dateValue);
        effectiveDate = `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
      } else {
        effectiveDate = effectiveDateRaw;
      }

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
        errors.push({ row: rowNumber, message: `effective_date must be in YYYY-MM-DD format (got: ${effectiveDate})` });
        continue;
      }

      // Collect responsibilities and KPIs from ALL rows for this role
      const responsibilityMap = new Map<string, string[]>(); // area -> tasks
      const kpisSet = new Map<string, string>(); // metric -> frequency

      for (const { row: r, rowNumber: rn } of group.rows) {
        // Get responsibility
        const respArea = getValue(r, ["responsibility_area", "Responsibility Area", "ResponsibilityArea", "responsibility area"]);
        const task = getValue(r, ["task", "Task"]);

        if (respArea && task) {
          if (!responsibilityMap.has(respArea)) {
            responsibilityMap.set(respArea, []);
          }
          // Only add if not duplicate
          const tasks = responsibilityMap.get(respArea)!;
          if (!tasks.includes(task)) {
            tasks.push(task);
          }
        } else if (respArea && !task) {
          // Area without task - just create the area if not exists
          if (!responsibilityMap.has(respArea)) {
            responsibilityMap.set(respArea, []);
          }
        }

        // Get KPI
        const kpiMetric = getValue(r, ["kpi_metric", "KPI Metric", "KpiMetric", "kpi metric"]);
        const kpiFrequency = getValue(r, ["kpi_frequency", "KPI Frequency", "KpiFrequency", "kpi frequency"]);

        if (kpiMetric) {
          kpisSet.set(kpiMetric, kpiFrequency || "Monthly");
        }
      }

      // Convert maps to arrays
      const responsibilities = Array.from(responsibilityMap.entries()).map(([area, tasks]) => ({
        area,
        tasks,
      }));

      const kpis = Array.from(kpisSet.entries()).map(([metric, frequency]) => ({
        metric,
        frequency,
      }));

      roles.push({
        jobTitle,
        departmentCode: departmentCode || null,
        missionStatement,
        wageType: wageType as "MONTHLY" | "DAILY" | "HOURLY",
        baseSalary: baseSalary ? parseFloat(baseSalary) : null,
        salaryRangeMin: salaryRangeMin ? parseFloat(salaryRangeMin) : null,
        salaryRangeMax: salaryRangeMax ? parseFloat(salaryRangeMax) : null,
        shiftTemplateCode: shiftTemplateCode || null,
        workHoursPerDay: workHoursPerDay ? parseInt(workHoursPerDay) : 8,
        workDaysPerWeek: workDaysPerWeek || "Monday to Friday",
        responsibilities,
        kpis,
        effectiveDate,
        rowNumbers: group.rows.map((r) => r.rowNumber),
      });
    }

    return {
      success: errors.length === 0,
      roles,
      errors,
    };
  } catch (error) {
    console.error("Failed to parse XLSX:", error);
    return {
      success: false,
      roles: [],
      errors: [{ row: 0, message: `Failed to parse XLSX file: ${error instanceof Error ? error.message : "Unknown error"}` }],
    };
  }
}

// =============================================================================
// Validate Import (Preview)
// =============================================================================

export interface ImportValidationResult {
  success: boolean;
  validRoles: {
    jobTitle: string;
    departmentName: string | null;
    wageType: string;
    baseSalary: number | null;
    effectiveDate: string;
    responsibilityCount: number;
    kpiCount: number;
  }[];
  errors: { row: number; message: string }[];
  warnings: { row: number; message: string }[];
}

export async function validateRoleScorecardImport(
  base64Content: string
): Promise<ImportValidationResult> {
  const auth = await assertPermission(Permission.ROLE_SCORECARD_MANAGE);

  // Parse XLSX
  const parseResult = parseXLSXContent(base64Content);

  if (parseResult.errors.length > 0 && parseResult.roles.length === 0) {
    return {
      success: false,
      validRoles: [],
      errors: parseResult.errors,
      warnings: [],
    };
  }

  // Lookup departments and shift templates
  const [departments, shiftTemplates] = await Promise.all([
    prisma.department.findMany({
      where: { companyId: auth.user.companyId, deletedAt: null },
      select: { id: true, code: true, name: true },
    }),
    prisma.shiftTemplate.findMany({
      where: { companyId: auth.user.companyId },
      select: { id: true, code: true },
    }),
  ]);

  const deptByCode = new Map(departments.map((d) => [d.code.toLowerCase(), d]));
  const shiftByCode = new Map(shiftTemplates.map((s) => [s.code.toLowerCase(), s]));

  const validRoles: ImportValidationResult["validRoles"] = [];
  const warnings: { row: number; message: string }[] = [];

  for (const role of parseResult.roles) {
    const firstRow = role.rowNumbers[0];

    // Validate department code if provided
    let departmentName: string | null = null;
    if (role.departmentCode) {
      const dept = deptByCode.get(role.departmentCode.toLowerCase());
      if (!dept) {
        warnings.push({
          row: firstRow,
          message: `Department code '${role.departmentCode}' not found - will be left blank`,
        });
      } else {
        departmentName = dept.name;
      }
    }

    // Validate shift template code if provided
    if (role.shiftTemplateCode) {
      const shift = shiftByCode.get(role.shiftTemplateCode.toLowerCase());
      if (!shift) {
        warnings.push({
          row: firstRow,
          message: `Shift template code '${role.shiftTemplateCode}' not found - will be left blank`,
        });
      }
    }

    // Count total tasks across all responsibility areas
    const taskCount = role.responsibilities.reduce((sum, r) => sum + r.tasks.length, 0);

    validRoles.push({
      jobTitle: role.jobTitle,
      departmentName,
      wageType: role.wageType,
      baseSalary: role.baseSalary,
      effectiveDate: role.effectiveDate,
      responsibilityCount: role.responsibilities.length,
      kpiCount: role.kpis.length,
    });
  }

  return {
    success: parseResult.errors.length === 0,
    validRoles,
    errors: parseResult.errors,
    warnings,
  };
}

// =============================================================================
// Import Role Scorecards
// =============================================================================

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export async function importRoleScorecards(base64Content: string): Promise<ImportResult> {
  const auth = await assertPermission(Permission.ROLE_SCORECARD_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  // Parse XLSX
  const parseResult = parseXLSXContent(base64Content);

  if (parseResult.errors.length > 0 && parseResult.roles.length === 0) {
    return {
      success: false,
      imported: 0,
      skipped: parseResult.errors.length,
      errors: parseResult.errors,
    };
  }

  // Lookup departments and shift templates
  const [departments, shiftTemplates] = await Promise.all([
    prisma.department.findMany({
      where: { companyId: auth.user.companyId, deletedAt: null },
      select: { id: true, code: true },
    }),
    prisma.shiftTemplate.findMany({
      where: { companyId: auth.user.companyId },
      select: { id: true, code: true },
    }),
  ]);

  const deptByCode = new Map(departments.map((d) => [d.code.toLowerCase(), d.id]));
  const shiftByCode = new Map(shiftTemplates.map((s) => [s.code.toLowerCase(), s.id]));

  let imported = 0;
  const errors: { row: number; message: string }[] = [...parseResult.errors];

  // Import each role
  for (const role of parseResult.roles) {
    try {
      const departmentId = role.departmentCode
        ? deptByCode.get(role.departmentCode.toLowerCase()) || null
        : null;

      const shiftTemplateId = role.shiftTemplateCode
        ? shiftByCode.get(role.shiftTemplateCode.toLowerCase()) || null
        : null;

      const scorecard = await prisma.roleScorecard.create({
        data: {
          companyId: auth.user.companyId,
          jobTitle: role.jobTitle,
          departmentId,
          missionStatement: role.missionStatement,
          keyResponsibilities: role.responsibilities,
          kpis: role.kpis,
          wageType: role.wageType,
          baseSalary: role.baseSalary,
          salaryRangeMin: role.salaryRangeMin,
          salaryRangeMax: role.salaryRangeMax,
          shiftTemplateId,
          workHoursPerDay: role.workHoursPerDay,
          workDaysPerWeek: role.workDaysPerWeek,
          effectiveDate: new Date(role.effectiveDate),
          isActive: true,
          createdById: auth.user.id,
        },
      });

      await audit.create("RoleScorecard", scorecard.id, {
        jobTitle: role.jobTitle,
        importedFrom: "XLSX",
        rowsProcessed: role.rowNumbers,
      });

      imported++;
    } catch (error) {
      const firstRow = role.rowNumbers[0];
      console.error(`Failed to import role from row ${firstRow}:`, error);
      errors.push({
        row: firstRow,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  revalidatePath("/settings/role-scorecards");

  return {
    success: errors.length === 0,
    imported,
    skipped: errors.length,
    errors,
  };
}

// =============================================================================
// Export Existing Role Scorecards (Denormalized Format)
// =============================================================================

export async function exportRoleScorecards() {
  const auth = await assertPermission(Permission.ROLE_SCORECARD_VIEW);

  const scorecards = await prisma.roleScorecard.findMany({
    where: { companyId: auth.user.companyId, isActive: true },
    include: {
      department: { select: { code: true } },
      shiftTemplate: { select: { code: true } },
    },
    orderBy: { jobTitle: "asc" },
  });

  // Build data rows in denormalized format
  const dataRows: Record<string, string | number>[] = [];

  for (const sc of scorecards) {
    const responsibilities = (sc.keyResponsibilities as { area: string; tasks: string[] }[]) || [];
    const kpis = (sc.kpis as { metric: string; frequency: string }[]) || [];

    // Calculate max rows needed for this role
    const maxResponsibilityRows = responsibilities.reduce(
      (sum, r) => sum + Math.max(1, r.tasks.length),
      0
    );
    const maxKpiRows = kpis.length;
    const totalRows = Math.max(1, maxResponsibilityRows, maxKpiRows);

    // Build denormalized rows
    let respIndex = 0;
    let kpiIndex = 0;
    let currentRespArea = "";
    let currentRespTaskIndex = 0;

    for (let i = 0; i < totalRows; i++) {
      const isFirstRow = i === 0;

      // Get current responsibility/task
      let responsibilityArea = "";
      let task = "";

      if (respIndex < responsibilities.length) {
        const resp = responsibilities[respIndex];
        responsibilityArea = resp.area;

        if (currentRespTaskIndex < resp.tasks.length) {
          task = resp.tasks[currentRespTaskIndex];
          currentRespTaskIndex++;
        }

        // Move to next responsibility area if we've exhausted tasks
        if (currentRespTaskIndex >= resp.tasks.length) {
          respIndex++;
          currentRespTaskIndex = 0;
        }
      }

      // Get current KPI
      let kpiMetric = "";
      let kpiFrequency = "";

      if (kpiIndex < kpis.length) {
        kpiMetric = kpis[kpiIndex].metric;
        kpiFrequency = kpis[kpiIndex].frequency;
        kpiIndex++;
      }

      dataRows.push({
        job_title: sc.jobTitle,
        department_code: isFirstRow ? (sc.department?.code || "") : "",
        mission_statement: isFirstRow ? sc.missionStatement : "",
        wage_type: isFirstRow ? sc.wageType : "",
        base_salary: isFirstRow && sc.baseSalary ? Number(sc.baseSalary) : "",
        salary_range_min: isFirstRow && sc.salaryRangeMin ? Number(sc.salaryRangeMin) : "",
        salary_range_max: isFirstRow && sc.salaryRangeMax ? Number(sc.salaryRangeMax) : "",
        shift_template_code: isFirstRow ? (sc.shiftTemplate?.code || "") : "",
        work_hours_per_day: isFirstRow ? sc.workHoursPerDay : "",
        work_days_per_week: isFirstRow ? sc.workDaysPerWeek : "",
        responsibility_area: responsibilityArea,
        task: task,
        kpi_metric: kpiMetric,
        kpi_frequency: kpiFrequency,
        effective_date: isFirstRow ? sc.effectiveDate.toISOString().split("T")[0] : "",
      });
    }
  }

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(dataRows, { header: TEMPLATE_HEADERS });

  // Set column widths
  ws["!cols"] = [
    { wch: 25 }, // job_title
    { wch: 15 }, // department_code
    { wch: 50 }, // mission_statement
    { wch: 12 }, // wage_type
    { wch: 12 }, // base_salary
    { wch: 15 }, // salary_range_min
    { wch: 15 }, // salary_range_max
    { wch: 18 }, // shift_template_code
    { wch: 18 }, // work_hours_per_day
    { wch: 20 }, // work_days_per_week
    { wch: 25 }, // responsibility_area
    { wch: 40 }, // task
    { wch: 30 }, // kpi_metric
    { wch: 15 }, // kpi_frequency
    { wch: 15 }, // effective_date
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Roles");

  // Generate buffer
  const buffer = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

  return {
    success: true,
    fileName: `role-scorecards-export-${new Date().toISOString().split("T")[0]}.xlsx`,
    content: buffer,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    isBase64: true,
    recordCount: scorecards.length,
  };
}
