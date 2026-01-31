// =============================================================================
// PeopleOS PH - Company Seeder
// =============================================================================

import type { PrismaClient } from "../../../app/generated/prisma";

export async function seedCompany(prisma: PrismaClient) {
  // Create the parent company (tenant)
  const company = await prisma.company.upsert({
    where: { code: "GAMECOVE" },
    update: {
      name: "GameCove Inc.",
      tradeName: "GameCove",
      country: "PH",
    },
    create: {
      code: "GAMECOVE",
      name: "GameCove Inc.",
      tradeName: "GameCove",
      country: "PH",
    },
  });

  // Create hiring entities (legal entities that hire employees)
  await prisma.hiringEntity.upsert({
    where: {
      id: "00000000-0000-0000-0000-000000000001",
    },
    update: {
      name: "GameCove Inc.",
      tradeName: "GameCove",
      tin: "000-000-000-000",
      rdoCode: "044",
      sssEmployerId: "00-0000000-0",
      philhealthEmployerId: "00-000000000-0",
      pagibigEmployerId: "0000-0000-0000",
      addressLine1: "Unit 123, Sample Building",
      addressLine2: "Sample Street, Sample Barangay",
      city: "Makati City",
      province: "Metro Manila",
      zipCode: "1234",
      phoneNumber: "+63 2 1234 5678",
      email: "hr@gamecove.ph",
    },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      companyId: company.id,
      code: "GC",
      name: "GameCove Inc.",
      tradeName: "GameCove",
      tin: "000-000-000-000",
      rdoCode: "044",
      sssEmployerId: "00-0000000-0",
      philhealthEmployerId: "00-000000000-0",
      pagibigEmployerId: "0000-0000-0000",
      addressLine1: "Unit 123, Sample Building",
      addressLine2: "Sample Street, Sample Barangay",
      city: "Makati City",
      province: "Metro Manila",
      zipCode: "1234",
      phoneNumber: "+63 2 1234 5678",
      email: "hr@gamecove.ph",
    },
  });

  await prisma.hiringEntity.upsert({
    where: {
      id: "00000000-0000-0000-0000-000000000002",
    },
    update: {
      name: "Luxium Trading Inc.",
      tradeName: "Luxium",
      tin: "000-000-000-001",
      rdoCode: "044",
      sssEmployerId: "00-0000000-1",
      philhealthEmployerId: "00-000000000-1",
      pagibigEmployerId: "0000-0000-0001",
      addressLine1: "Unit 456, Sample Building",
      addressLine2: "Sample Street, Sample Barangay",
      city: "Makati City",
      province: "Metro Manila",
      zipCode: "1234",
      phoneNumber: "+63 2 1234 5679",
      email: "hr@luxium.ph",
    },
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      companyId: company.id,
      code: "LX",
      name: "Luxium Trading Inc.",
      tradeName: "Luxium",
      tin: "000-000-000-001",
      rdoCode: "044",
      sssEmployerId: "00-0000000-1",
      philhealthEmployerId: "00-000000000-1",
      pagibigEmployerId: "0000-0000-0001",
      addressLine1: "Unit 456, Sample Building",
      addressLine2: "Sample Street, Sample Barangay",
      city: "Makati City",
      province: "Metro Manila",
      zipCode: "1234",
      phoneNumber: "+63 2 1234 5679",
      email: "hr@luxium.ph",
    },
  });

  return company;
}
