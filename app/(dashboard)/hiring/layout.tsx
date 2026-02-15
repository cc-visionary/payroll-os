// =============================================================================
// PeopleOS PH - Hiring Layout (Under Development)
// =============================================================================
// Blocks all hiring sub-routes. Delete this file to re-enable the feature.
// =============================================================================

import { UnderDevelopment } from "@/components/ui/under-development";

export default function HiringLayout({ children }: { children: React.ReactNode }) {
  return (
    <UnderDevelopment
      title="Hiring Pipeline"
      description="The applicant tracking system, interview scheduling, and hiring pipeline are being built with improved workflows."
    />
  );
}
