// =============================================================================
// PeopleOS PH - Leave Types Seed
// =============================================================================

import type { PrismaClient } from "../../../app/generated/prisma";

export async function seedLeaveTypes(prisma: PrismaClient, companyId: string) {
  // Define leave types for Philippine companies
  // Default entitlements:
  // - 5 SIL (Service Incentive Leave) - granted at start of year after 1 year of service
  // - 2 VL (Vacation Leave) - granted at start of year after 1 year of service
  const leaveTypes = [
    {
      code: "SIL",
      name: "Service Incentive Leave",
      description: "Service Incentive Leave - 5 days granted at the start of the year after completing 1 year of service",
      accrualType: "ANNUAL" as const,
      accrualAmount: 5, // 5 days per year
      accrualCap: 5,
      minTenureDays: 365, // After 1 year of service
      requiresRegularization: false, // Based on tenure, not regularization
      isPaid: true,
      isConvertible: true,
      conversionRate: 1.0,
      canCarryOver: false,
      carryOverCap: null,
      carryOverExpiryMonths: null,
      requiresAttachment: false,
      requiresApproval: true,
      minAdvanceDays: 0, // Can be used for any purpose
    },
    {
      code: "VL",
      name: "Vacation Leave",
      description: "Vacation Leave - 2 days granted at the start of the year after completing 1 year of service",
      accrualType: "ANNUAL" as const,
      accrualAmount: 2, // 2 days per year
      accrualCap: 2,
      minTenureDays: 365, // After 1 year of service
      requiresRegularization: false, // Based on tenure, not regularization
      isPaid: true,
      isConvertible: false,
      conversionRate: 1.0,
      canCarryOver: false,
      carryOverCap: null,
      carryOverExpiryMonths: null,
      requiresAttachment: false,
      requiresApproval: true,
      minAdvanceDays: 3, // Request at least 3 days in advance
    },
    {
      code: "SL",
      name: "Sick Leave",
      description: "Sick leave for illness or medical reasons",
      accrualType: "NONE" as const,
      accrualAmount: null,
      accrualCap: null,
      minTenureDays: 0,
      requiresRegularization: false,
      isPaid: false, // LWOP for sick leave unless company provides it
      isConvertible: false,
      conversionRate: 1.0,
      canCarryOver: false,
      carryOverCap: null,
      carryOverExpiryMonths: null,
      requiresAttachment: true, // Medical certificate for 2+ days
      requiresApproval: true,
      minAdvanceDays: 0, // Can file same day for sick leave
    },
    {
      code: "EL",
      name: "Emergency Leave",
      description: "Emergency leave for urgent personal matters",
      accrualType: "ANNUAL" as const,
      accrualAmount: 3, // 3 days per year
      accrualCap: 3,
      minTenureDays: 0,
      requiresRegularization: false, // Available even during probation
      isPaid: true,
      isConvertible: false,
      conversionRate: 1.0,
      canCarryOver: false,
      carryOverCap: null,
      carryOverExpiryMonths: null,
      requiresAttachment: false,
      requiresApproval: true,
      minAdvanceDays: 0, // Emergency, no advance notice required
    },
    {
      code: "ML",
      name: "Maternity Leave",
      description: "Maternity leave per RA 11210 (105 days normal, 120 days solo parent)",
      accrualType: "NONE" as const,
      accrualAmount: null,
      accrualCap: null,
      minTenureDays: 0,
      requiresRegularization: false,
      isPaid: true,
      isConvertible: false,
      conversionRate: 1.0,
      canCarryOver: false,
      carryOverCap: null,
      carryOverExpiryMonths: null,
      requiresAttachment: true, // Medical certificate required
      requiresApproval: true,
      minAdvanceDays: 30, // Should notify 30 days in advance
    },
    {
      code: "PL",
      name: "Paternity Leave",
      description: "Paternity leave per RA 8187 (7 days for married male employees)",
      accrualType: "NONE" as const,
      accrualAmount: null,
      accrualCap: null,
      minTenureDays: 0,
      requiresRegularization: false,
      isPaid: true,
      isConvertible: false,
      conversionRate: 1.0,
      canCarryOver: false,
      carryOverCap: null,
      carryOverExpiryMonths: null,
      requiresAttachment: true, // Marriage certificate, birth certificate
      requiresApproval: true,
      minAdvanceDays: 7,
    },
    {
      code: "SPL",
      name: "Solo Parent Leave",
      description: "Solo Parent Leave per RA 8972 (7 days for solo parents)",
      accrualType: "ANNUAL" as const,
      accrualAmount: 7,
      accrualCap: 7,
      minTenureDays: 365, // After 1 year of service
      requiresRegularization: true,
      isPaid: true,
      isConvertible: false,
      conversionRate: 1.0,
      canCarryOver: false,
      carryOverCap: null,
      carryOverExpiryMonths: null,
      requiresAttachment: true, // Solo parent ID
      requiresApproval: true,
      minAdvanceDays: 3,
    },
    {
      code: "VAWC",
      name: "VAWC Leave",
      description: "Leave for victims of violence against women and children (RA 9262)",
      accrualType: "NONE" as const,
      accrualAmount: null,
      accrualCap: null,
      minTenureDays: 0,
      requiresRegularization: false,
      isPaid: true,
      isConvertible: false,
      conversionRate: 1.0,
      canCarryOver: false,
      carryOverCap: null,
      carryOverExpiryMonths: null,
      requiresAttachment: true, // Barangay protection order or similar
      requiresApproval: true,
      minAdvanceDays: 0,
    },
    {
      code: "BL",
      name: "Bereavement Leave",
      description: "Leave for death of immediate family member",
      accrualType: "NONE" as const,
      accrualAmount: null,
      accrualCap: null,
      minTenureDays: 0,
      requiresRegularization: false,
      isPaid: true,
      isConvertible: false,
      conversionRate: 1.0,
      canCarryOver: false,
      carryOverCap: null,
      carryOverExpiryMonths: null,
      requiresAttachment: true, // Death certificate
      requiresApproval: true,
      minAdvanceDays: 0,
    },
    {
      code: "LWOP",
      name: "Leave Without Pay",
      description: "Unpaid leave when paid leave balance is exhausted",
      accrualType: "NONE" as const,
      accrualAmount: null,
      accrualCap: null,
      minTenureDays: 0,
      requiresRegularization: false,
      isPaid: false,
      isConvertible: false,
      conversionRate: 1.0,
      canCarryOver: false,
      carryOverCap: null,
      carryOverExpiryMonths: null,
      requiresAttachment: false,
      requiresApproval: true,
      minAdvanceDays: 1,
    },
  ];

  for (const leaveType of leaveTypes) {
    await prisma.leaveType.upsert({
      where: {
        companyId_code: {
          companyId,
          code: leaveType.code,
        },
      },
      update: {
        name: leaveType.name,
        description: leaveType.description,
        accrualType: leaveType.accrualType,
        accrualAmount: leaveType.accrualAmount,
        accrualCap: leaveType.accrualCap,
        minTenureDays: leaveType.minTenureDays,
        requiresRegularization: leaveType.requiresRegularization,
        isPaid: leaveType.isPaid,
        isConvertible: leaveType.isConvertible,
        conversionRate: leaveType.conversionRate,
        canCarryOver: leaveType.canCarryOver,
        carryOverCap: leaveType.carryOverCap,
        carryOverExpiryMonths: leaveType.carryOverExpiryMonths,
        requiresAttachment: leaveType.requiresAttachment,
        requiresApproval: leaveType.requiresApproval,
        minAdvanceDays: leaveType.minAdvanceDays,
      },
      create: {
        companyId,
        code: leaveType.code,
        name: leaveType.name,
        description: leaveType.description,
        accrualType: leaveType.accrualType,
        accrualAmount: leaveType.accrualAmount,
        accrualCap: leaveType.accrualCap,
        minTenureDays: leaveType.minTenureDays,
        requiresRegularization: leaveType.requiresRegularization,
        isPaid: leaveType.isPaid,
        isConvertible: leaveType.isConvertible,
        conversionRate: leaveType.conversionRate,
        canCarryOver: leaveType.canCarryOver,
        carryOverCap: leaveType.carryOverCap,
        carryOverExpiryMonths: leaveType.carryOverExpiryMonths,
        requiresAttachment: leaveType.requiresAttachment,
        requiresApproval: leaveType.requiresApproval,
        minAdvanceDays: leaveType.minAdvanceDays,
      },
    });
  }

  return leaveTypes.length;
}
