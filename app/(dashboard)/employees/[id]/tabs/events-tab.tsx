"use client";

// =============================================================================
// PeopleOS PH - Employment Events Tab
// =============================================================================

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { EventStatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import {
  createEmploymentEvent,
  approveEmploymentEvent,
  rejectEmploymentEvent,
} from "@/app/actions/employees";

interface EmploymentEvent {
  id: string;
  eventType: string;
  eventDate: Date;
  status: string;
  payload: unknown;
  remarks: string | null;
  rejectionReason: string | null;
  requestedBy: { id: string; email: string } | null;
  approvedBy: { id: string; email: string } | null;
  createdAt: Date;
}

interface EventsTabProps {
  employeeId: string;
  events: EmploymentEvent[];
  employmentType: string;
  regularizationDate: Date | null;
  canEdit: boolean;
  canDelete?: boolean;
}

const eventTypeOptions = [
  { value: "REGULARIZATION", label: "Regularization" },
  { value: "SALARY_CHANGE", label: "Salary Change" },
  { value: "ROLE_CHANGE", label: "Role Change" },
  { value: "PROMOTION", label: "Promotion" },
  { value: "DEMOTION", label: "Demotion" },
  { value: "DEPARTMENT_TRANSFER", label: "Department Transfer" },
  { value: "SEPARATION_INITIATED", label: "Separation Initiated" },
  { value: "SEPARATION_CONFIRMED", label: "Separation Confirmed" },
  { value: "PENALTY_ISSUED", label: "Penalty Issued" },
  { value: "COMMENDATION", label: "Commendation" },
];

// HRCI-aligned separation types
const separationTypeOptions = [
  { value: "RESIGNED", label: "Resignation (Voluntary)" },
  { value: "TERMINATED", label: "Termination (Involuntary)" },
  { value: "END_OF_CONTRACT", label: "End of Contract" },
  { value: "RETIRED", label: "Retirement" },
  { value: "AWOL", label: "AWOL (Absence Without Leave)" },
  { value: "DECEASED", label: "Deceased" },
];

export function EventsTab({
  employeeId,
  events,
  employmentType,
  regularizationDate,
  canEdit,
  canDelete = false,
}: EventsTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Show regularization alert for probationary employees
  const showRegularizationAlert =
    employmentType === "PROBATIONARY" && !regularizationDate;

  // Unused variable removed: canDelete
  void canDelete;

  const handleSubmit = async (formData: FormData) => {
    setError(null);

    const eventType = formData.get("eventType") as string;
    const eventDate = formData.get("eventDate") as string;
    const remarks = formData.get("remarks") as string;

    // Build payload based on event type
    let payload: Record<string, unknown> = {};

    if (eventType === "SALARY_CHANGE") {
      payload = {
        newBaseRate: formData.get("newBaseRate"),
        reason: formData.get("salaryChangeReason"),
      };
    } else if (eventType === "ROLE_CHANGE" || eventType === "PROMOTION" || eventType === "DEMOTION") {
      payload = {
        newJobTitle: formData.get("newJobTitle"),
        newJobLevel: formData.get("newJobLevel"),
        reason: formData.get("roleChangeReason"),
      };
    } else if (eventType === "DEPARTMENT_TRANSFER") {
      payload = {
        newDepartmentId: formData.get("newDepartmentId"),
        reason: formData.get("transferReason"),
      };
    } else if (eventType === "SEPARATION_INITIATED" || eventType === "SEPARATION_CONFIRMED") {
      payload = {
        separationType: formData.get("separationType"),
        reason: formData.get("separationReason"),
        lastWorkingDate: formData.get("lastWorkingDate"),
      };
    } else if (eventType === "PENALTY_ISSUED") {
      payload = {
        penaltyType: formData.get("penaltyType"),
        description: formData.get("penaltyDescription"),
      };
    } else if (eventType === "COMMENDATION") {
      payload = {
        description: formData.get("commendationDescription"),
      };
    }

    startTransition(async () => {
      const result = await createEmploymentEvent(employeeId, {
        eventType,
        eventDate,
        payload,
        remarks,
      });

      if (result.success) {
        setIsModalOpen(false);
        setSelectedEventType("");
      } else {
        setError(result.error || "Failed to create event");
      }
    });
  };

  const handleApprove = async (eventId: string) => {
    startTransition(async () => {
      const result = await approveEmploymentEvent(eventId);
      if (!result.success) {
        alert(result.error);
      }
    });
  };

  const handleReject = async (eventId: string) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;

    startTransition(async () => {
      const result = await rejectEmploymentEvent(eventId, reason);
      if (!result.success) {
        alert(result.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Regularization Alert */}
      {showRegularizationAlert && canEdit && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-yellow-800">Regularization Pending</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  This employee is probationary and has not been regularized yet.
                  Regularization affects statutory deductions eligibility.
                </p>
              </div>
              <Button
                onClick={() => {
                  setSelectedEventType("REGULARIZATION");
                  setIsModalOpen(true);
                }}
              >
                Regularize Employee
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Events List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Employment Events</CardTitle>
          {canEdit && (
            <Button onClick={() => setIsModalOpen(true)}>Add Event</Button>
          )}
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-gray-500">No employment events recorded</p>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {formatEventType(event.eventType)}
                        </span>
                        <EventStatusBadge status={event.status} />
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {formatDate(event.eventDate)}
                      </div>
                    </div>

                    {event.status === "PENDING" && canEdit && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApprove(event.id)}
                          loading={isPending}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReject(event.id)}
                          loading={isPending}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Event Details */}
                  <div className="mt-3 text-sm text-gray-600">
                    {renderEventPayload(event.eventType, event.payload as Record<string, unknown>)}
                  </div>

                  {event.remarks && (
                    <div className="mt-2 text-sm text-gray-500 italic">
                      Note: {event.remarks}
                    </div>
                  )}

                  {event.rejectionReason && (
                    <div className="mt-2 text-sm text-red-600">
                      Rejected: {event.rejectionReason}
                    </div>
                  )}

                  <div className="mt-3 text-xs text-gray-400">
                    {event.requestedBy && `Requested by ${event.requestedBy.email}`}
                    {event.approvedBy && ` • Approved by ${event.approvedBy.email}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Event Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEventType("");
        }}
        title="Add Employment Event"
        size="lg"
      >
        <form action={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
          )}

          <div className="space-y-4">
            <Select
              label="Event Type"
              name="eventType"
              options={eventTypeOptions}
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              required
            />

            <Input
              label="Event Date"
              name="eventDate"
              type="date"
              defaultValue={new Date().toISOString().split("T")[0]}
              required
            />

            {/* Dynamic fields based on event type */}
            {selectedEventType === "SALARY_CHANGE" && (
              <>
                <Input
                  label="New Base Rate (PHP)"
                  name="newBaseRate"
                  type="number"
                  step="0.01"
                  required
                />
                <Input
                  label="Reason"
                  name="salaryChangeReason"
                  placeholder="e.g., Annual increase, Promotion"
                />
              </>
            )}

            {(selectedEventType === "ROLE_CHANGE" ||
              selectedEventType === "PROMOTION" ||
              selectedEventType === "DEMOTION") && (
              <>
                <Input
                  label="New Job Title"
                  name="newJobTitle"
                  required
                />
                <Input
                  label="New Job Level"
                  name="newJobLevel"
                />
                <Input
                  label="Reason"
                  name="roleChangeReason"
                />
              </>
            )}

            {selectedEventType === "DEPARTMENT_TRANSFER" && (
              <>
                <Input
                  label="New Department ID"
                  name="newDepartmentId"
                  placeholder="Enter department ID"
                  required
                />
                <Input
                  label="Reason"
                  name="transferReason"
                />
              </>
            )}

            {(selectedEventType === "SEPARATION_INITIATED" ||
              selectedEventType === "SEPARATION_CONFIRMED") && (
              <>
                <Select
                  label="Separation Type"
                  name="separationType"
                  options={separationTypeOptions}
                  required
                />
                <Input
                  label="Reason"
                  name="separationReason"
                  required
                />
                <Input
                  label="Last Working Date"
                  name="lastWorkingDate"
                  type="date"
                />
              </>
            )}

            {selectedEventType === "PENALTY_ISSUED" && (
              <>
                <Input
                  label="Penalty Type"
                  name="penaltyType"
                  placeholder="e.g., Written Warning, Suspension"
                  required
                />
                <Input
                  label="Description"
                  name="penaltyDescription"
                  required
                />
              </>
            )}

            {selectedEventType === "COMMENDATION" && (
              <Input
                label="Description"
                name="commendationDescription"
                placeholder="Describe the commendation..."
                required
              />
            )}

            <Input
              label="Additional Remarks"
              name="remarks"
              placeholder="Optional notes..."
            />
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsModalOpen(false);
                setSelectedEventType("");
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isPending} disabled={!selectedEventType}>
              Create Event
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}

function formatEventType(type: string): string {
  const map: Record<string, string> = {
    HIRE: "Hired",
    REGULARIZATION: "Regularization",
    SALARY_CHANGE: "Salary Change",
    ROLE_CHANGE: "Role Change",
    DEPARTMENT_TRANSFER: "Department Transfer",
    PROMOTION: "Promotion",
    DEMOTION: "Demotion",
    PENALTY_ISSUED: "Penalty Issued",
    INCIDENT_REPORTED: "Incident Reported",
    COMMENDATION: "Commendation",
    SEPARATION_INITIATED: "Separation Initiated",
    SEPARATION_CONFIRMED: "Separation Confirmed",
    REHIRE: "Rehired",
    STATUS_CHANGE: "Status Change",
  };
  return map[type] || type;
}

function renderEventPayload(type: string, payload: Record<string, unknown>): React.ReactNode {
  if (!payload || Object.keys(payload).length === 0) return null;

  switch (type) {
    case "SALARY_CHANGE":
      return (
        <span>
          New base rate: <strong>₱{String(payload.newBaseRate)}</strong>
          {payload.reason ? ` (${String(payload.reason)})` : null}
        </span>
      );
    case "ROLE_CHANGE":
    case "PROMOTION":
    case "DEMOTION":
      return (
        <span>
          New role: <strong>{String(payload.newJobTitle)}</strong>
          {payload.newJobLevel ? ` (${String(payload.newJobLevel)})` : null}
        </span>
      );
    case "SEPARATION_INITIATED":
    case "SEPARATION_CONFIRMED":
      return (
        <span>
          Type: <strong>{String(payload.separationType)}</strong>
          {payload.reason ? ` - ${String(payload.reason)}` : null}
        </span>
      );
    case "PENALTY_ISSUED":
      return (
        <span>
          {String(payload.penaltyType)}: {String(payload.description)}
        </span>
      );
    case "COMMENDATION":
      return <span>{String(payload.description)}</span>;
    default:
      return <span>{JSON.stringify(payload)}</span>;
  }
}
