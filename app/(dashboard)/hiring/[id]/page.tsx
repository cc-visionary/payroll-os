// =============================================================================
// PeopleOS PH - Applicant Detail Page
// =============================================================================

import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission, checkPermission, Permission } from "@/lib/rbac";
import { getApplicant } from "@/lib/data/hiring";
import { getEmployeesDropdown } from "@/lib/data/employees";
import { formatName, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ApplicantStatusBadge, InterviewResultBadge } from "@/components/ui/badge";
import { StatusUpdateForm } from "./status-form";
import { InterviewForm } from "./interview-form";
import { ConvertForm } from "./convert-form";
import { OfferLetterButton } from "./offer-letter-button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplicantDetailPage({ params }: PageProps) {
  await requirePermission(Permission.HIRING_VIEW);
  const canEdit = await checkPermission(Permission.HIRING_EDIT);
  const canConvert = await checkPermission(Permission.HIRING_CONVERT);

  const { id } = await params;
  const [applicant, employees] = await Promise.all([
    getApplicant(id),
    getEmployeesDropdown(),
  ]);

  if (!applicant) {
    notFound();
  }

  const positionTitle = applicant.roleScorecard?.jobTitle || applicant.customJobTitle || "No position";

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/hiring"
          className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          &larr; Back to Hiring
        </Link>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {formatName(
                applicant.firstName,
                applicant.lastName,
                applicant.middleName,
                applicant.suffix
              )}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <ApplicantStatusBadge status={applicant.status} />
              <span className="text-gray-500">{positionTitle}</span>
              {applicant.department && (
                <span className="text-gray-400">• {applicant.department.name}</span>
              )}
            </div>
          </div>

          {canEdit && applicant.status !== "HIRED" && applicant.status !== "REJECTED" && applicant.status !== "WITHDRAWN" && (
            <Link href={`/hiring/${id}/edit`}>
              <Button variant="outline">Edit Applicant</Button>
            </Link>
          )}
        </div>

        {/* Quick Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <InfoCard label="Email" value={applicant.email} />
          <InfoCard label="Mobile" value={applicant.mobileNumber || "-"} />
          <InfoCard label="Source" value={applicant.source || "-"} />
          <InfoCard
            label="Applied"
            value={formatDate(applicant.appliedAt)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact & Links */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Email</div>
                  <a href={`mailto:${applicant.email}`} className="text-blue-600 hover:underline">
                    {applicant.email}
                  </a>
                </div>
                {applicant.mobileNumber && (
                  <div>
                    <div className="text-gray-500">Mobile</div>
                    <div>{applicant.mobileNumber}</div>
                  </div>
                )}
                {applicant.phoneNumber && (
                  <div>
                    <div className="text-gray-500">Phone</div>
                    <div>{applicant.phoneNumber}</div>
                  </div>
                )}
                {applicant.linkedinUrl && (
                  <div>
                    <div className="text-gray-500">LinkedIn</div>
                    <a
                      href={applicant.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View Profile
                    </a>
                  </div>
                )}
                {applicant.portfolioUrl && (
                  <div>
                    <div className="text-gray-500">Portfolio</div>
                    <a
                      href={applicant.portfolioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View Portfolio
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Application Details */}
          <Card>
            <CardHeader>
              <CardTitle>Application Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Position Applied</div>
                  <div className="font-medium">{positionTitle}</div>
                </div>
                <div>
                  <div className="text-gray-500">Department</div>
                  <div>{applicant.department?.name || "-"}</div>
                </div>
                {applicant.hiringEntity && (
                  <div>
                    <div className="text-gray-500">Hiring Entity</div>
                    <div>{applicant.hiringEntity.tradeName || applicant.hiringEntity.name}</div>
                  </div>
                )}
                <div>
                  <div className="text-gray-500">Source</div>
                  <div>{applicant.source || "-"}</div>
                </div>
                {applicant.referredBy && (
                  <div>
                    <div className="text-gray-500">Referred By</div>
                    <Link
                      href={`/employees/${applicant.referredBy.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {applicant.referredBy.firstName} {applicant.referredBy.lastName}
                    </Link>
                  </div>
                )}
                {(applicant.expectedSalaryMin || applicant.expectedSalaryMax) && (
                  <div>
                    <div className="text-gray-500">Expected Salary</div>
                    <div>
                      {applicant.expectedSalaryMin && `PHP ${Number(applicant.expectedSalaryMin).toLocaleString()}`}
                      {applicant.expectedSalaryMin && applicant.expectedSalaryMax && " - "}
                      {applicant.expectedSalaryMax && `PHP ${Number(applicant.expectedSalaryMax).toLocaleString()}`}
                    </div>
                  </div>
                )}
                {applicant.expectedStartDate && (
                  <div>
                    <div className="text-gray-500">Expected Start Date</div>
                    <div>{formatDate(applicant.expectedStartDate)}</div>
                  </div>
                )}
              </div>

              {applicant.notes && (
                <div className="mt-4 pt-4 border-t">
                  <div className="text-gray-500 text-sm mb-1">Notes</div>
                  <p className="text-sm whitespace-pre-wrap">{applicant.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Interviews */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Interviews ({applicant.interviews.length})</CardTitle>
              {canEdit && applicant.status !== "HIRED" && applicant.status !== "REJECTED" && (
                <InterviewForm
                  applicantId={applicant.id}
                  employees={employees}
                />
              )}
            </CardHeader>
            <CardContent>
              {applicant.interviews.length === 0 ? (
                <p className="text-gray-500 text-sm">No interviews scheduled yet</p>
              ) : (
                <div className="space-y-4">
                  {applicant.interviews.map((interview) => (
                    <div
                      key={interview.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {interview.interviewType.replace(/_/g, " ")}
                            </span>
                            <InterviewResultBadge result={interview.result} />
                          </div>
                          {interview.title && (
                            <div className="text-sm text-gray-600 mt-1">{interview.title}</div>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 text-right">
                          <div>{formatDate(interview.scheduledDate)}</div>
                          <div>
                            {new Date(interview.scheduledStartTime).toLocaleTimeString("en-PH", {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })}
                            {" - "}
                            {new Date(interview.scheduledEndTime).toLocaleTimeString("en-PH", {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </div>
                        </div>
                      </div>

                      {interview.primaryInterviewer && (
                        <div className="text-sm text-gray-600 mt-2">
                          Interviewer: {interview.primaryInterviewer.firstName} {interview.primaryInterviewer.lastName}
                          {interview.primaryInterviewer.jobTitle && ` (${interview.primaryInterviewer.jobTitle})`}
                        </div>
                      )}

                      {interview.location && (
                        <div className="text-sm text-gray-500 mt-1">
                          Location: {interview.isVirtual ? "Virtual - " : ""}{interview.location}
                        </div>
                      )}

                      {interview.meetingLink && (
                        <a
                          href={interview.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                        >
                          Join Meeting
                        </a>
                      )}

                      {interview.resultNotes && (
                        <div className="mt-3 pt-3 border-t text-sm">
                          <div className="text-gray-500">Notes</div>
                          <p className="whitespace-pre-wrap">{interview.resultNotes}</p>
                        </div>
                      )}

                      {interview.rating && (
                        <div className="mt-2 text-sm">
                          Rating: {interview.rating}/5
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Update */}
          {canEdit && applicant.status !== "HIRED" && (
            <Card>
              <CardHeader>
                <CardTitle>Update Status</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusUpdateForm
                  applicantId={applicant.id}
                  currentStatus={applicant.status}
                />
              </CardContent>
            </Card>
          )}

          {/* Offer Letter */}
          {canEdit && (applicant.status === "OFFER" || applicant.status === "OFFER_ACCEPTED") && (
            <Card className="border-blue-300 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-800">Offer Letter</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-blue-700 mb-4">
                  Generate an offer letter for this applicant based on their role scorecard.
                </p>
                <OfferLetterButton
                  applicantId={applicant.id}
                  existingPath={applicant.offerLetterPath}
                />
              </CardContent>
            </Card>
          )}

          {/* Convert to Employee */}
          {canConvert && applicant.status === "OFFER_ACCEPTED" && (
            <Card className="border-green-300 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-800">Convert to Employee</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-green-700 mb-4">
                  This applicant has accepted the offer. Create an employee record to complete the hiring process.
                </p>
                <ConvertForm applicantId={applicant.id} />
              </CardContent>
            </Card>
          )}

          {/* Converted Info */}
          {applicant.convertedToEmployee && (
            <Card className="border-green-300 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-800">Hired</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-green-700 mb-2">
                  Converted on {formatDate(applicant.convertedAt)}
                </p>
                <Link
                  href={`/employees/${applicant.convertedToEmployee.id}`}
                  className="text-blue-600 hover:underline text-sm"
                >
                  View Employee: {applicant.convertedToEmployee.firstName} {applicant.convertedToEmployee.lastName} ({applicant.convertedToEmployee.employeeNumber})
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Rejection Info */}
          {applicant.status === "REJECTED" && applicant.rejectionReason && (
            <Card className="border-red-300 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-800">Rejection Reason</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-red-700">{applicant.rejectionReason}</p>
              </CardContent>
            </Card>
          )}

          {/* Withdrawal Info */}
          {applicant.status === "WITHDRAWN" && applicant.withdrawalReason && (
            <Card className="border-gray-300 bg-gray-50">
              <CardHeader>
                <CardTitle className="text-gray-800">Withdrawal Reason</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700">{applicant.withdrawalReason}</p>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Applied</span>
                  <span>{formatDate(applicant.appliedAt)}</span>
                </div>
                {applicant.statusChangedAt && applicant.statusChangedAt > applicant.appliedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last Updated</span>
                    <span>{formatDate(applicant.statusChangedAt)}</span>
                  </div>
                )}
                {applicant.createdBy && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Added By</span>
                    <span className="text-right">{applicant.createdBy.email}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-lg border border-gray-200 bg-white">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-sm font-medium mt-1 text-gray-900 truncate">{value}</div>
    </div>
  );
}
