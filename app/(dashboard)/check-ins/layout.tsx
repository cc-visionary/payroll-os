// =============================================================================
// PeopleOS PH - Check-Ins Layout (Under Development)
// =============================================================================
// Blocks all check-in sub-routes. Delete this file to re-enable the feature.
// =============================================================================

import { UnderDevelopment } from "@/components/ui/under-development";

export default function CheckInsLayout({ children }: { children: React.ReactNode }) {
  return (
    <UnderDevelopment
      title="Performance Check-Ins"
      description="Monthly performance reviews, goals tracking, and skill assessments are being redesigned with better workflows."
    />
  );
}
