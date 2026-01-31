"use client";

// =============================================================================
// PeopleOS PH - Create Period Button
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { createCheckInPeriod } from "@/app/actions/check-ins";

const periodTypeOptions = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "ANNUAL", label: "Annual" },
];

export function CreatePeriodButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Default to current month
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 5); // 5th of next month

  const defaultName = firstOfMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const handleSubmit = async (formData: FormData) => {
    setError(null);

    const data = {
      name: formData.get("name") as string,
      periodType: formData.get("periodType") as "MONTHLY" | "QUARTERLY" | "ANNUAL",
      startDate: formData.get("startDate") as string,
      endDate: formData.get("endDate") as string,
      dueDate: formData.get("dueDate") as string,
    };

    startTransition(async () => {
      const result = await createCheckInPeriod(data);

      if (result.success) {
        setIsOpen(false);
        router.refresh();
        if (result.periodId) {
          router.push(`/check-ins/${result.periodId}`);
        }
      } else {
        setError(result.error || "Failed to create period");
      }
    });
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Create Period</Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Create Check-In Period"
        size="md"
      >
        <form action={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="Period Name"
              name="name"
              defaultValue={defaultName}
              placeholder="e.g., January 2025"
              required
            />

            <Select
              label="Period Type"
              name="periodType"
              options={periodTypeOptions}
              defaultValue="MONTHLY"
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Start Date"
                name="startDate"
                type="date"
                defaultValue={firstOfMonth.toISOString().split("T")[0]}
                required
              />
              <Input
                label="End Date"
                name="endDate"
                type="date"
                defaultValue={lastOfMonth.toISOString().split("T")[0]}
                required
              />
            </div>

            <Input
              label="Due Date"
              name="dueDate"
              type="date"
              defaultValue={dueDate.toISOString().split("T")[0]}
              required
            />
            <p className="text-xs text-gray-500 -mt-2">
              When all check-ins should be completed
            </p>
          </div>

          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              Create Period
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
