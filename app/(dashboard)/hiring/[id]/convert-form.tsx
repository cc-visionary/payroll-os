"use client";

// =============================================================================
// PeopleOS PH - Convert Applicant to Employee Form
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { convertApplicantToEmployee } from "@/app/actions/hiring";

interface ConvertFormProps {
  applicantId: string;
}

const employmentTypeOptions = [
  { value: "PROBATIONARY", label: "Probationary" },
  { value: "REGULAR", label: "Regular" },
  { value: "CONTRACTUAL", label: "Contractual" },
  { value: "CONSULTANT", label: "Consultant" },
  { value: "INTERN", label: "Intern" },
];

export function ConvertForm({ applicantId }: ConvertFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (formData: FormData) => {
    setError(null);

    const data = {
      employmentType: formData.get("employmentType") as string,
      hireDate: formData.get("hireDate") as string,
    };

    if (!data.employmentType || !data.hireDate) {
      setError("All fields are required");
      return;
    }

    startTransition(async () => {
      const result = await convertApplicantToEmployee(applicantId, data);

      if (result.success && result.employeeId) {
        router.push(`/employees/${result.employeeId}`);
      } else {
        setError(result.error || "Failed to convert applicant");
      }
    });
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className="w-full">
        Convert to Employee
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Convert Applicant to Employee"
        size="md"
      >
        <form action={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
          )}

          <div className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
              Employee number will be automatically generated.
            </div>

            <Select
              label="Employment Type"
              name="employmentType"
              options={employmentTypeOptions}
              defaultValue="PROBATIONARY"
              required
            />

            <Input
              label="Hire Date"
              name="hireDate"
              type="date"
              required
              defaultValue={new Date().toISOString().split("T")[0]}
            />
          </div>

          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              Convert to Employee
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
