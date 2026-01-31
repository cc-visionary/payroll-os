// =============================================================================
// PeopleOS PH - Employee Matching for Attendance Import
// =============================================================================

import { prisma } from "@/lib/db";
import type { EmployeeMatchingConfig } from "./import-types";

/**
 * Cached employee data for matching.
 */
interface MatchableEmployee {
  id: string;
  employeeNumber: string;
  workEmail: string | null;
  personalEmail: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  fullName: string;
  normalizedName: string;
}

/**
 * Match result for a single row.
 */
export interface EmployeeMatchResult {
  employeeId: string | null;
  employeeName: string | null;
  confidence: number;
  matchType: "exact_code" | "exact_email" | "fuzzy_name" | "none";
  ambiguousMatches?: Array<{ id: string; name: string; confidence: number }>;
}

/**
 * Load employees for matching.
 */
export async function loadMatchableEmployees(
  companyId: string
): Promise<Map<string, MatchableEmployee>> {
  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      deletedAt: null,
      employmentStatus: { not: "DECEASED" },
    },
    select: {
      id: true,
      employeeNumber: true,
      workEmail: true,
      personalEmail: true,
      firstName: true,
      lastName: true,
      middleName: true,
    },
  });

  const map = new Map<string, MatchableEmployee>();

  for (const emp of employees) {
    const fullName = [emp.firstName, emp.middleName, emp.lastName]
      .filter(Boolean)
      .join(" ");
    const normalizedName = normalizeName(fullName);

    map.set(emp.id, {
      id: emp.id,
      employeeNumber: emp.employeeNumber,
      workEmail: emp.workEmail,
      personalEmail: emp.personalEmail,
      firstName: emp.firstName,
      lastName: emp.lastName,
      middleName: emp.middleName,
      fullName,
      normalizedName,
    });
  }

  return map;
}

/**
 * Build lookup indexes for fast matching.
 */
export function buildMatchIndexes(employees: Map<string, MatchableEmployee>): {
  byCode: Map<string, string>;
  byEmail: Map<string, string>;
  byNormalizedName: Map<string, string[]>;
} {
  const byCode = new Map<string, string>();
  const byEmail = new Map<string, string>();
  const byNormalizedName = new Map<string, string[]>();

  for (const [id, emp] of employees) {
    // Index by employee code (case-insensitive)
    byCode.set(emp.employeeNumber.toLowerCase(), id);

    // Index by email (case-insensitive)
    if (emp.workEmail) {
      byEmail.set(emp.workEmail.toLowerCase(), id);
    }
    if (emp.personalEmail) {
      byEmail.set(emp.personalEmail.toLowerCase(), id);
    }

    // Index by normalized name (may have multiple employees)
    const existing = byNormalizedName.get(emp.normalizedName) || [];
    existing.push(id);
    byNormalizedName.set(emp.normalizedName, existing);
  }

  return { byCode, byEmail, byNormalizedName };
}

/**
 * Normalize a name for fuzzy matching.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "") // Remove non-letters
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Calculate similarity between two strings using Levenshtein distance.
 */
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  const distance = matrix[b.length][a.length];
  const maxLength = Math.max(a.length, b.length);
  return 1 - distance / maxLength;
}

/**
 * Match an employee by code, email, or name.
 */
export function matchEmployee(
  employeeCode: string | undefined,
  employeeEmail: string | undefined,
  employeeName: string | undefined,
  employees: Map<string, MatchableEmployee>,
  indexes: ReturnType<typeof buildMatchIndexes>,
  config: EmployeeMatchingConfig
): EmployeeMatchResult {
  // 1. Try exact match by employee code (primary)
  if (config.primaryMatch === "employeeCode" && employeeCode) {
    const normalizedCode = employeeCode.toLowerCase().trim();
    const matchedId = indexes.byCode.get(normalizedCode);

    if (matchedId) {
      const emp = employees.get(matchedId)!;
      return {
        employeeId: matchedId,
        employeeName: emp.fullName,
        confidence: 1.0,
        matchType: "exact_code",
      };
    }
  }

  // 2. Try exact match by email (primary or fallback)
  if (
    config.primaryMatch === "employeeEmail" ||
    (employeeEmail && config.primaryMatch === "employeeCode" && !employeeCode)
  ) {
    if (employeeEmail) {
      const normalizedEmail = employeeEmail.toLowerCase().trim();
      const matchedId = indexes.byEmail.get(normalizedEmail);

      if (matchedId) {
        const emp = employees.get(matchedId)!;
        return {
          employeeId: matchedId,
          employeeName: emp.fullName,
          confidence: 1.0,
          matchType: "exact_email",
        };
      }
    }
  }

  // 3. Try name matching if allowed and we have a name
  if (config.allowNameFallback && employeeName && !config.requireExactMatch) {
    const normalizedInput = normalizeName(employeeName);

    // First try exact normalized name match
    const exactNameMatches = indexes.byNormalizedName.get(normalizedInput);
    if (exactNameMatches && exactNameMatches.length === 1) {
      const emp = employees.get(exactNameMatches[0])!;
      return {
        employeeId: exactNameMatches[0],
        employeeName: emp.fullName,
        confidence: 1.0,
        matchType: "fuzzy_name",
      };
    }

    if (exactNameMatches && exactNameMatches.length > 1) {
      // Multiple exact matches - ambiguous
      const ambiguous = exactNameMatches.map((id) => {
        const emp = employees.get(id)!;
        return { id, name: emp.fullName, confidence: 1.0 };
      });

      return {
        employeeId: null,
        employeeName: null,
        confidence: 0,
        matchType: "none",
        ambiguousMatches: ambiguous,
      };
    }

    // Fuzzy name matching
    const candidates: Array<{ id: string; name: string; confidence: number }> = [];

    for (const [id, emp] of employees) {
      const similarity = calculateSimilarity(normalizedInput, emp.normalizedName);
      if (similarity >= config.nameMatchThreshold) {
        candidates.push({ id, name: emp.fullName, confidence: similarity });
      }
    }

    if (candidates.length === 1) {
      return {
        employeeId: candidates[0].id,
        employeeName: candidates[0].name,
        confidence: candidates[0].confidence,
        matchType: "fuzzy_name",
      };
    }

    if (candidates.length > 1) {
      // Sort by confidence descending
      candidates.sort((a, b) => b.confidence - a.confidence);

      // If top match is significantly better, use it
      if (candidates[0].confidence - candidates[1].confidence > 0.1) {
        return {
          employeeId: candidates[0].id,
          employeeName: candidates[0].name,
          confidence: candidates[0].confidence,
          matchType: "fuzzy_name",
        };
      }

      // Otherwise, ambiguous
      return {
        employeeId: null,
        employeeName: null,
        confidence: 0,
        matchType: "none",
        ambiguousMatches: candidates.slice(0, 5),
      };
    }
  }

  // No match found
  return {
    employeeId: null,
    employeeName: null,
    confidence: 0,
    matchType: "none",
  };
}

/**
 * Batch match employees for import rows.
 */
export async function batchMatchEmployees(
  companyId: string,
  rows: Array<{
    employeeCode?: string;
    employeeEmail?: string;
    employeeName?: string;
  }>,
  config: EmployeeMatchingConfig
): Promise<EmployeeMatchResult[]> {
  const employees = await loadMatchableEmployees(companyId);
  const indexes = buildMatchIndexes(employees);

  return rows.map((row) =>
    matchEmployee(
      row.employeeCode,
      row.employeeEmail,
      row.employeeName,
      employees,
      indexes,
      config
    )
  );
}
