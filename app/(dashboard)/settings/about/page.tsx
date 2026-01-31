// =============================================================================
// PeopleOS PH - About & Updates Page
// =============================================================================

import { Suspense } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AboutContent } from "./about-content";

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>About PeopleOS Payroll</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="text-gray-500">Loading...</div>}>
            <AboutContent />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
