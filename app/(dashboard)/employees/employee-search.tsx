"use client";

// =============================================================================
// PeopleOS PH - Employee Search Component
// =============================================================================

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Department {
  id: string;
  code: string;
  name: string;
}

interface EmployeeSearchProps {
  departments: Department[];
}

// HRCI-aligned Employment Status options
const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "RESIGNED", label: "Resigned" },
  { value: "TERMINATED", label: "Terminated" },
  { value: "AWOL", label: "AWOL" },
  { value: "DECEASED", label: "Deceased" },
  { value: "END_OF_CONTRACT", label: "End of Contract" },
  { value: "RETIRED", label: "Retired" },
];

// HRCI-aligned Employment Type options
const employmentTypeOptions = [
  { value: "", label: "All Types" },
  { value: "REGULAR", label: "Regular" },
  { value: "PROBATIONARY", label: "Probationary" },
  { value: "CONTRACTUAL", label: "Contractual" },
  { value: "CONSULTANT", label: "Consultant" },
  { value: "INTERN", label: "Intern" },
  { value: "SEASONAL", label: "Seasonal" },
  { value: "CASUAL", label: "Casual" },
];

export function EmployeeSearch({ departments }: EmployeeSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [employmentType, setEmploymentType] = useState(
    searchParams.get("employmentType") || ""
  );
  const [departmentId, setDepartmentId] = useState(
    searchParams.get("departmentId") || ""
  );

  const departmentOptions = [
    { value: "", label: "All Departments" },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ];

  const updateFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (employmentType) params.set("employmentType", employmentType);
    if (departmentId) params.set("departmentId", departmentId);

    startTransition(() => {
      router.push(`/employees?${params.toString()}`);
    });
  }, [search, status, employmentType, departmentId, router]);

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setEmploymentType("");
    setDepartmentId("");
    startTransition(() => {
      router.push("/employees");
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      updateFilters();
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Input
          placeholder="Search by name or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Select
          options={statusOptions}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
        <Select
          options={employmentTypeOptions}
          value={employmentType}
          onChange={(e) => setEmploymentType(e.target.value)}
        />
        <Select
          options={departmentOptions}
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={updateFilters} loading={isPending}>
          Search
        </Button>
        <Button variant="outline" onClick={clearFilters}>
          Clear
        </Button>
      </div>
    </div>
  );
}
