// =============================================================================
// PeopleOS PH - Badge Component
// =============================================================================

import { cn } from "@/lib/utils";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}

const variantStyles = {
  default: "bg-gray-100 text-gray-800",
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  danger: "bg-red-100 text-red-800",
  info: "bg-blue-100 text-blue-800",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// Status-specific badges
export function EmploymentStatusBadge({ status }: { status: string }) {
  const variants: Record<string, BadgeProps["variant"]> = {
    ACTIVE: "success",
    PROBATIONARY: "info",
    RESIGNED: "default",
    TERMINATED: "danger",
    AWOL: "danger",
    END_OF_CONTRACT: "warning",
  };

  const labels: Record<string, string> = {
    ACTIVE: "Active",
    PROBATIONARY: "Probationary",
    RESIGNED: "Resigned",
    TERMINATED: "Terminated",
    AWOL: "AWOL",
    END_OF_CONTRACT: "End of Contract",
  };

  return <Badge variant={variants[status] || "default"}>{labels[status] || status}</Badge>;
}

export function EmploymentTypeBadge({ type }: { type: string }) {
  const variants: Record<string, BadgeProps["variant"]> = {
    REGULAR: "success",
    PROBATIONARY: "warning",
    CONTRACTUAL: "info",
    CONSULTANT: "info",
    INTERN: "default",
  };

  const labels: Record<string, string> = {
    REGULAR: "Regular",
    PROBATIONARY: "Probationary",
    CONTRACTUAL: "Contractual",
    CONSULTANT: "Consultant",
    INTERN: "Intern",
  };

  return <Badge variant={variants[type] || "default"}>{labels[type] || type}</Badge>;
}

export function EventStatusBadge({ status }: { status: string }) {
  const variants: Record<string, BadgeProps["variant"]> = {
    PENDING: "warning",
    APPROVED: "success",
    REJECTED: "danger",
    CANCELLED: "default",
  };

  return <Badge variant={variants[status] || "default"}>{status}</Badge>;
}

export function ApplicantStatusBadge({ status }: { status: string }) {
  const variants: Record<string, BadgeProps["variant"]> = {
    NEW: "info",
    SCREENING: "warning",
    INTERVIEW: "info",
    ASSESSMENT: "warning",
    OFFER: "warning",
    OFFER_ACCEPTED: "success",
    HIRED: "success",
    REJECTED: "danger",
    WITHDRAWN: "default",
  };

  const labels: Record<string, string> = {
    NEW: "New",
    SCREENING: "Screening",
    INTERVIEW: "Interview",
    ASSESSMENT: "Assessment",
    OFFER: "Offer",
    OFFER_ACCEPTED: "Offer Accepted",
    HIRED: "Hired",
    REJECTED: "Rejected",
    WITHDRAWN: "Withdrawn",
  };

  return <Badge variant={variants[status] || "default"}>{labels[status] || status}</Badge>;
}

export function InterviewResultBadge({ result }: { result: string }) {
  const variants: Record<string, BadgeProps["variant"]> = {
    PENDING: "warning",
    PASSED: "success",
    FAILED: "danger",
    NO_SHOW: "danger",
    RESCHEDULED: "info",
  };

  const labels: Record<string, string> = {
    PENDING: "Pending",
    PASSED: "Passed",
    FAILED: "Failed",
    NO_SHOW: "No Show",
    RESCHEDULED: "Rescheduled",
  };

  return <Badge variant={variants[result] || "default"}>{labels[result] || result}</Badge>;
}
