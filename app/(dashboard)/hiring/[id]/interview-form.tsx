"use client";

// =============================================================================
// PeopleOS PH - Interview Scheduling Form
// =============================================================================

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { createInterview } from "@/app/actions/hiring";

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
}

interface InterviewFormProps {
  applicantId: string;
  employees: Employee[];
}

const interviewTypeOptions = [
  { value: "PHONE_SCREEN", label: "Phone Screen" },
  { value: "TECHNICAL", label: "Technical Interview" },
  { value: "BEHAVIORAL", label: "Behavioral Interview" },
  { value: "PANEL", label: "Panel Interview" },
  { value: "FINAL", label: "Final Interview" },
];

export function InterviewForm({ applicantId, employees }: InterviewFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVirtual, setIsVirtual] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const interviewerOptions = [
    { value: "", label: "Select interviewer..." },
    ...employees.map((e) => ({
      value: e.id,
      label: `${e.firstName} ${e.lastName}${e.jobTitle ? ` (${e.jobTitle})` : ""}`,
    })),
  ];

  const handleSubmit = (formData: FormData) => {
    setError(null);

    const data = {
      interviewType: formData.get("interviewType") as string,
      title: (formData.get("title") as string) || undefined,
      description: (formData.get("description") as string) || undefined,
      scheduledDate: formData.get("scheduledDate") as string,
      scheduledStartTime: formData.get("scheduledStartTime") as string,
      scheduledEndTime: formData.get("scheduledEndTime") as string,
      location: (formData.get("location") as string) || undefined,
      isVirtual,
      meetingLink: isVirtual ? (formData.get("meetingLink") as string) || undefined : undefined,
      primaryInterviewerId: (formData.get("primaryInterviewerId") as string) || undefined,
    };

    startTransition(async () => {
      const result = await createInterview(applicantId, data);

      if (result.success) {
        setIsOpen(false);
      } else {
        setError(result.error || "Failed to schedule interview");
      }
    });
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} size="sm">
        Schedule Interview
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Schedule Interview"
        size="lg"
      >
        <form action={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
          )}

          <div className="space-y-4">
            <Select
              label="Interview Type"
              name="interviewType"
              options={interviewTypeOptions}
              required
            />

            <Input
              label="Title (optional)"
              name="title"
              placeholder="e.g., First Technical Interview"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Date"
                name="scheduledDate"
                type="date"
                required
                defaultValue={new Date().toISOString().split("T")[0]}
              />
              <Input
                label="Start Time"
                name="scheduledStartTime"
                type="time"
                required
                defaultValue="09:00"
              />
              <Input
                label="End Time"
                name="scheduledEndTime"
                type="time"
                required
                defaultValue="10:00"
              />
            </div>

            <Select
              label="Primary Interviewer"
              name="primaryInterviewerId"
              options={interviewerOptions}
            />

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isVirtual"
                checked={isVirtual}
                onChange={(e) => setIsVirtual(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="isVirtual" className="text-sm text-gray-700">
                Virtual Interview
              </label>
            </div>

            {isVirtual ? (
              <Input
                label="Meeting Link"
                name="meetingLink"
                type="url"
                placeholder="https://meet.google.com/... or https://zoom.us/..."
              />
            ) : (
              <Input
                label="Location"
                name="location"
                placeholder="Conference Room A, Office Address..."
              />
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                name="description"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Interview focus areas, things to prepare..."
              />
            </div>
          </div>

          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              Schedule Interview
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
