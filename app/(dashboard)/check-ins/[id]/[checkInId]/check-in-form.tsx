"use client";

// =============================================================================
// PeopleOS PH - Check-In Form Component
// =============================================================================
// HRCI-aligned performance check-in with:
// - Self-assessment (accomplishments, challenges, learnings)
// - SMART goal tracking
// - Competency/skill ratings
// - Manager feedback
// - Development planning
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import {
  updateCheckInSelfAssessment,
  submitCheckIn,
  updateCheckInManagerFeedback,
  completeCheckIn,
  addGoal,
  updateGoal,
  deleteGoal,
  upsertSkillRating,
} from "@/app/actions/check-ins";

interface CheckIn {
  id: string;
  status: string;
  accomplishments: string | null;
  challenges: string | null;
  learnings: string | null;
  supportNeeded: string | null;
  managerFeedback: string | null;
  strengths: string | null;
  areasForImprovement: string | null;
  overallRating: number | null;
  overallComments: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  goals: Array<{
    id: string;
    goalType: string;
    title: string;
    description: string | null;
    targetDate: Date | null;
    progress: number;
    status: string;
    selfAssessment: string | null;
    managerAssessment: string | null;
    rating: number | null;
    carryForward: boolean;
  }>;
  skillRatings: Array<{
    id: string;
    skillCategory: string;
    skillName: string;
    selfRating: number | null;
    managerRating: number | null;
    comments: string | null;
    developmentPlan: string | null;
  }>;
  reviewer: { id: string; email: string } | null;
  period: { name: string };
}

interface CheckInFormProps {
  checkIn: CheckIn;
  canEdit: boolean;
  periodId: string;
}

// HRCI-aligned skill categories
const SKILL_CATEGORIES = [
  {
    category: "Technical Skills",
    skills: ["Job Knowledge", "Technical Proficiency", "Problem Solving", "Quality of Work"],
  },
  {
    category: "Communication",
    skills: ["Written Communication", "Verbal Communication", "Active Listening", "Presentation"],
  },
  {
    category: "Teamwork & Collaboration",
    skills: ["Team Collaboration", "Conflict Resolution", "Peer Support", "Cross-functional Work"],
  },
  {
    category: "Leadership & Initiative",
    skills: ["Initiative", "Decision Making", "Mentoring", "Project Leadership"],
  },
  {
    category: "Professionalism",
    skills: ["Attendance & Punctuality", "Work Ethic", "Adaptability", "Professional Growth"],
  },
];

const goalTypeOptions = [
  { value: "PERFORMANCE", label: "Performance Goal" },
  { value: "LEARNING", label: "Learning & Development" },
  { value: "PROJECT", label: "Project Goal" },
  { value: "BEHAVIORAL", label: "Behavioral Goal" },
];

const goalStatusOptions = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PARTIALLY_MET", label: "Partially Met" },
  { value: "NOT_MET", label: "Not Met" },
  { value: "DEFERRED", label: "Deferred" },
];

const ratingLabels = ["", "Needs Improvement", "Below Expectations", "Meets Expectations", "Exceeds Expectations", "Outstanding"];

export function CheckInForm({ checkIn, canEdit, periodId }: CheckInFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"self" | "goals" | "skills" | "manager">("self");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Self-assessment form state
  const [selfAssessment, setSelfAssessment] = useState({
    accomplishments: checkIn.accomplishments || "",
    challenges: checkIn.challenges || "",
    learnings: checkIn.learnings || "",
    supportNeeded: checkIn.supportNeeded || "",
  });

  // Manager feedback form state
  const [managerFeedback, setManagerFeedback] = useState({
    managerFeedback: checkIn.managerFeedback || "",
    strengths: checkIn.strengths || "",
    areasForImprovement: checkIn.areasForImprovement || "",
    overallRating: checkIn.overallRating || 0,
    overallComments: checkIn.overallComments || "",
  });

  // Goal modal state
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<typeof checkIn.goals[0] | null>(null);
  const [goalForm, setGoalForm] = useState({
    goalType: "PERFORMANCE" as string,
    title: "",
    description: "",
    targetDate: "",
    progress: 0,
    status: "NOT_STARTED" as string,
    selfAssessment: "",
    managerAssessment: "",
    rating: 0,
    carryForward: false,
  });

  const isEmployee = checkIn.status === "DRAFT" || checkIn.status === "SUBMITTED";
  const isManager = canEdit;
  const isCompleted = checkIn.status === "COMPLETED";

  const handleSaveSelfAssessment = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateCheckInSelfAssessment(checkIn.id, selfAssessment);
      if (result.success) {
        setSuccess("Self-assessment saved successfully");
        setTimeout(() => setSuccess(null), 3000);
        router.refresh();
      } else {
        setError(result.error || "Failed to save");
      }
    });
  };

  const handleSubmitForReview = () => {
    setError(null);
    startTransition(async () => {
      const result = await submitCheckIn(checkIn.id);
      if (result.success) {
        setSuccess("Check-in submitted for review");
        router.refresh();
      } else {
        setError(result.error || "Failed to submit");
      }
    });
  };

  const handleSaveManagerFeedback = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateCheckInManagerFeedback(checkIn.id, managerFeedback);
      if (result.success) {
        setSuccess("Manager feedback saved");
        setTimeout(() => setSuccess(null), 3000);
        router.refresh();
      } else {
        setError(result.error || "Failed to save");
      }
    });
  };

  const handleCompleteReview = (reviewerId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await completeCheckIn(checkIn.id, reviewerId);
      if (result.success) {
        setSuccess("Check-in completed");
        router.refresh();
      } else {
        setError(result.error || "Failed to complete");
      }
    });
  };

  const openAddGoalModal = () => {
    setEditingGoal(null);
    setGoalForm({
      goalType: "PERFORMANCE",
      title: "",
      description: "",
      targetDate: "",
      progress: 0,
      status: "NOT_STARTED",
      selfAssessment: "",
      managerAssessment: "",
      rating: 0,
      carryForward: false,
    });
    setIsGoalModalOpen(true);
  };

  const openEditGoalModal = (goal: typeof checkIn.goals[0]) => {
    setEditingGoal(goal);
    setGoalForm({
      goalType: goal.goalType,
      title: goal.title,
      description: goal.description || "",
      targetDate: goal.targetDate ? new Date(goal.targetDate).toISOString().split("T")[0] : "",
      progress: goal.progress,
      status: goal.status,
      selfAssessment: goal.selfAssessment || "",
      managerAssessment: goal.managerAssessment || "",
      rating: goal.rating || 0,
      carryForward: goal.carryForward,
    });
    setIsGoalModalOpen(true);
  };

  const handleSaveGoal = () => {
    setError(null);
    startTransition(async () => {
      if (editingGoal) {
        const result = await updateGoal(editingGoal.id, {
          ...goalForm,
          status: goalForm.status as "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "PARTIALLY_MET" | "NOT_MET" | "DEFERRED",
        });
        if (result.success) {
          setIsGoalModalOpen(false);
          router.refresh();
        } else {
          setError(result.error || "Failed to update goal");
        }
      } else {
        const result = await addGoal(checkIn.id, {
          goalType: goalForm.goalType as "PERFORMANCE" | "LEARNING" | "PROJECT" | "BEHAVIORAL",
          title: goalForm.title,
          description: goalForm.description || undefined,
          targetDate: goalForm.targetDate || undefined,
        });
        if (result.success) {
          setIsGoalModalOpen(false);
          router.refresh();
        } else {
          setError(result.error || "Failed to add goal");
        }
      }
    });
  };

  const handleDeleteGoal = (goalId: string) => {
    if (!confirm("Are you sure you want to delete this goal?")) return;
    startTransition(async () => {
      await deleteGoal(goalId);
      router.refresh();
    });
  };

  const handleSkillRating = (category: string, skill: string, selfRating: number) => {
    startTransition(async () => {
      await upsertSkillRating(checkIn.id, {
        skillCategory: category,
        skillName: skill,
        selfRating,
      });
      router.refresh();
    });
  };

  const handleManagerSkillRating = (category: string, skill: string, managerRating: number) => {
    startTransition(async () => {
      await upsertSkillRating(checkIn.id, {
        skillCategory: category,
        skillName: skill,
        managerRating,
      });
      router.refresh();
    });
  };

  const getSkillRating = (category: string, skill: string) => {
    return checkIn.skillRatings.find(
      (r) => r.skillCategory === category && r.skillName === skill
    );
  };

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("self")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "self"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Self-Assessment
          </button>
          <button
            onClick={() => setActiveTab("goals")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "goals"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Goals ({checkIn.goals.length})
          </button>
          <button
            onClick={() => setActiveTab("skills")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "skills"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Skills & Competencies
          </button>
          {isManager && (
            <button
              onClick={() => setActiveTab("manager")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "manager"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Manager Review
            </button>
          )}
        </nav>
      </div>

      {/* Self-Assessment Tab */}
      {activeTab === "self" && (
        <Card>
          <CardHeader>
            <CardTitle>Self-Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Key Accomplishments
              </label>
              <p className="text-xs text-gray-500 mb-2">
                What were your most significant achievements this period? Be specific about outcomes and impact.
              </p>
              <textarea
                value={selfAssessment.accomplishments}
                onChange={(e) => setSelfAssessment({ ...selfAssessment, accomplishments: e.target.value })}
                disabled={isCompleted}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm disabled:bg-gray-50"
                placeholder="• Completed project X ahead of schedule, resulting in 20% cost savings&#10;• Successfully trained 3 new team members&#10;• Improved process Y, reducing errors by 15%"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Challenges Faced
              </label>
              <p className="text-xs text-gray-500 mb-2">
                What obstacles did you encounter? How did you address them?
              </p>
              <textarea
                value={selfAssessment.challenges}
                onChange={(e) => setSelfAssessment({ ...selfAssessment, challenges: e.target.value })}
                disabled={isCompleted}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm disabled:bg-gray-50"
                placeholder="Describe challenges and how you handled them..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Learning & Development
              </label>
              <p className="text-xs text-gray-500 mb-2">
                What new skills or knowledge did you acquire? What training or learning activities did you complete?
              </p>
              <textarea
                value={selfAssessment.learnings}
                onChange={(e) => setSelfAssessment({ ...selfAssessment, learnings: e.target.value })}
                disabled={isCompleted}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm disabled:bg-gray-50"
                placeholder="New skills learned, courses completed, certifications earned..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Support Needed
              </label>
              <p className="text-xs text-gray-500 mb-2">
                What resources, training, or support would help you perform better?
              </p>
              <textarea
                value={selfAssessment.supportNeeded}
                onChange={(e) => setSelfAssessment({ ...selfAssessment, supportNeeded: e.target.value })}
                disabled={isCompleted}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm disabled:bg-gray-50"
                placeholder="Additional training, tools, mentorship, etc..."
              />
            </div>

            {!isCompleted && (
              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleSaveSelfAssessment}
                  loading={isPending}
                >
                  Save Draft
                </Button>
                {checkIn.status === "DRAFT" && (
                  <Button onClick={handleSubmitForReview} loading={isPending}>
                    Submit for Review
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Goals Tab */}
      {activeTab === "goals" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Goals & Objectives</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                SMART Goals: Specific, Measurable, Achievable, Relevant, Time-bound
              </p>
            </div>
            {!isCompleted && (
              <Button onClick={openAddGoalModal}>Add Goal</Button>
            )}
          </CardHeader>
          <CardContent>
            {checkIn.goals.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No goals set for this period. Click "Add Goal" to create one.
              </div>
            ) : (
              <div className="space-y-4">
                {checkIn.goals.map((goal) => (
                  <div
                    key={goal.id}
                    className="border rounded-lg p-4 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="default">
                            {goal.goalType.replace("_", " ")}
                          </Badge>
                          <Badge
                            variant={
                              goal.status === "COMPLETED"
                                ? "success"
                                : goal.status === "IN_PROGRESS"
                                ? "warning"
                                : "default"
                            }
                          >
                            {goal.status.replace("_", " ")}
                          </Badge>
                          {goal.carryForward && (
                            <Badge variant="warning">Carry Forward</Badge>
                          )}
                        </div>
                        <h4 className="font-medium text-gray-900 mt-2">{goal.title}</h4>
                        {goal.description && (
                          <p className="text-sm text-gray-600 mt-1">{goal.description}</p>
                        )}

                        {/* Progress Bar */}
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Progress</span>
                            <span>{goal.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${goal.progress}%` }}
                            />
                          </div>
                        </div>

                        {goal.targetDate && (
                          <p className="text-xs text-gray-500 mt-2">
                            Target: {new Date(goal.targetDate).toLocaleDateString()}
                          </p>
                        )}

                        {goal.rating && (
                          <div className="mt-2 flex items-center gap-1">
                            <span className="text-yellow-500">★</span>
                            <span className="text-sm font-medium">{goal.rating}/5</span>
                            <span className="text-sm text-gray-500">
                              - {ratingLabels[goal.rating]}
                            </span>
                          </div>
                        )}
                      </div>
                      {!isCompleted && (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditGoalModal(goal)}
                          >
                            Edit
                          </Button>
                          {isManager && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteGoal(goal.id)}
                              className="text-red-600"
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Self & Manager Assessments */}
                    {(goal.selfAssessment || goal.managerAssessment) && (
                      <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
                        {goal.selfAssessment && (
                          <div>
                            <h5 className="text-xs font-medium text-gray-500 uppercase">
                              Self Assessment
                            </h5>
                            <p className="text-sm text-gray-700 mt-1">
                              {goal.selfAssessment}
                            </p>
                          </div>
                        )}
                        {goal.managerAssessment && (
                          <div>
                            <h5 className="text-xs font-medium text-gray-500 uppercase">
                              Manager Assessment
                            </h5>
                            <p className="text-sm text-gray-700 mt-1">
                              {goal.managerAssessment}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Skills Tab */}
      {activeTab === "skills" && (
        <Card>
          <CardHeader>
            <CardTitle>Skills & Competencies Assessment</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Rate yourself on each skill (1-5 scale). Managers can add their ratings during review.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {SKILL_CATEGORIES.map((cat) => (
                <div key={cat.category}>
                  <h4 className="font-medium text-gray-900 mb-4">{cat.category}</h4>
                  <div className="space-y-3">
                    {cat.skills.map((skill) => {
                      const rating = getSkillRating(cat.category, skill);
                      return (
                        <div
                          key={skill}
                          className="flex items-center justify-between py-2 border-b border-gray-100"
                        >
                          <span className="text-sm text-gray-700">{skill}</span>
                          <div className="flex items-center gap-4">
                            {/* Self Rating */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Self:</span>
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((val) => (
                                  <button
                                    key={val}
                                    onClick={() =>
                                      !isCompleted && handleSkillRating(cat.category, skill, val)
                                    }
                                    disabled={isCompleted || isPending}
                                    className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                                      rating?.selfRating === val
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    } disabled:opacity-50`}
                                  >
                                    {val}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Manager Rating */}
                            {isManager && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Manager:</span>
                                <div className="flex gap-1">
                                  {[1, 2, 3, 4, 5].map((val) => (
                                    <button
                                      key={val}
                                      onClick={() =>
                                        !isCompleted &&
                                        handleManagerSkillRating(cat.category, skill, val)
                                      }
                                      disabled={isCompleted || isPending}
                                      className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                                        rating?.managerRating === val
                                          ? "bg-green-600 text-white"
                                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                      } disabled:opacity-50`}
                                    >
                                      {val}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Rating Legend */}
            <div className="mt-6 pt-4 border-t">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Rating Scale</h5>
              <div className="grid grid-cols-5 gap-2 text-xs text-gray-600">
                <div><span className="font-medium">1</span> - Needs Improvement</div>
                <div><span className="font-medium">2</span> - Below Expectations</div>
                <div><span className="font-medium">3</span> - Meets Expectations</div>
                <div><span className="font-medium">4</span> - Exceeds Expectations</div>
                <div><span className="font-medium">5</span> - Outstanding</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manager Review Tab */}
      {activeTab === "manager" && isManager && (
        <Card>
          <CardHeader>
            <CardTitle>Manager Review & Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Overall Feedback
              </label>
              <textarea
                value={managerFeedback.managerFeedback}
                onChange={(e) =>
                  setManagerFeedback({ ...managerFeedback, managerFeedback: e.target.value })
                }
                disabled={isCompleted}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm disabled:bg-gray-50"
                placeholder="Provide constructive feedback on overall performance..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Strengths
                </label>
                <textarea
                  value={managerFeedback.strengths}
                  onChange={(e) =>
                    setManagerFeedback({ ...managerFeedback, strengths: e.target.value })
                  }
                  disabled={isCompleted}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm disabled:bg-gray-50"
                  placeholder="Key strengths demonstrated..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Areas for Improvement
                </label>
                <textarea
                  value={managerFeedback.areasForImprovement}
                  onChange={(e) =>
                    setManagerFeedback({
                      ...managerFeedback,
                      areasForImprovement: e.target.value,
                    })
                  }
                  disabled={isCompleted}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm disabled:bg-gray-50"
                  placeholder="Areas needing development..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Overall Performance Rating
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    onClick={() =>
                      setManagerFeedback({ ...managerFeedback, overallRating: rating })
                    }
                    disabled={isCompleted}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                      managerFeedback.overallRating === rating
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    } disabled:opacity-50`}
                  >
                    <div className="text-lg font-bold text-gray-900">{rating}</div>
                    <div className="text-xs text-gray-500">{ratingLabels[rating]}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Comments
              </label>
              <textarea
                value={managerFeedback.overallComments}
                onChange={(e) =>
                  setManagerFeedback({ ...managerFeedback, overallComments: e.target.value })
                }
                disabled={isCompleted}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm disabled:bg-gray-50"
                placeholder="Any additional comments or recommendations..."
              />
            </div>

            {!isCompleted && (
              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleSaveManagerFeedback}
                  loading={isPending}
                >
                  Save Feedback
                </Button>
                {checkIn.status !== "DRAFT" && (
                  <Button
                    onClick={() => handleCompleteReview("current-user-id")}
                    loading={isPending}
                    disabled={!managerFeedback.overallRating}
                  >
                    Complete Review
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Goal Modal */}
      <Modal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        title={editingGoal ? "Edit Goal" : "Add Goal"}
        size="lg"
      >
        <div className="space-y-4">
          <Select
            label="Goal Type"
            value={goalForm.goalType}
            onChange={(e) => setGoalForm({ ...goalForm, goalType: e.target.value })}
            options={goalTypeOptions}
          />

          <Input
            label="Goal Title"
            value={goalForm.title}
            onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
            placeholder="Clear, specific goal statement..."
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (SMART Details)
            </label>
            <textarea
              value={goalForm.description}
              onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm"
              placeholder="Specific details: How will success be measured? What resources are needed?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Target Date"
              type="date"
              value={goalForm.targetDate}
              onChange={(e) => setGoalForm({ ...goalForm, targetDate: e.target.value })}
            />
            {editingGoal && (
              <Select
                label="Status"
                value={goalForm.status}
                onChange={(e) => setGoalForm({ ...goalForm, status: e.target.value })}
                options={goalStatusOptions}
              />
            )}
          </div>

          {editingGoal && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Progress ({goalForm.progress}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={goalForm.progress}
                  onChange={(e) =>
                    setGoalForm({ ...goalForm, progress: parseInt(e.target.value) })
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Self-Assessment
                </label>
                <textarea
                  value={goalForm.selfAssessment}
                  onChange={(e) =>
                    setGoalForm({ ...goalForm, selfAssessment: e.target.value })
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm"
                  placeholder="Your assessment of progress on this goal..."
                />
              </div>

              {isManager && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Manager Assessment
                    </label>
                    <textarea
                      value={goalForm.managerAssessment}
                      onChange={(e) =>
                        setGoalForm({ ...goalForm, managerAssessment: e.target.value })
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm"
                      placeholder="Manager's assessment of this goal..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Goal Rating
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => setGoalForm({ ...goalForm, rating })}
                          className={`w-10 h-10 rounded-full font-medium ${
                            goalForm.rating === rating
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {rating}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="carryForward"
                      checked={goalForm.carryForward}
                      onChange={(e) =>
                        setGoalForm({ ...goalForm, carryForward: e.target.checked })
                      }
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="carryForward" className="text-sm text-gray-700">
                      Carry forward to next period
                    </label>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={() => setIsGoalModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveGoal} loading={isPending} disabled={!goalForm.title}>
            {editingGoal ? "Save Changes" : "Add Goal"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
