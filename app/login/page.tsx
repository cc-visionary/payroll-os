// =============================================================================
// PeopleOS PH - Login Page
// =============================================================================

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

interface PageProps {
  searchParams: Promise<{ returnUrl?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  // Redirect if already logged in
  const session = await getSession();
  if (session) {
    redirect("/employees");
  }

  const { returnUrl } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold text-gray-900">PeopleOS</h1>
          <h2 className="mt-2 text-center text-lg text-gray-600">
            Sign in to your account
          </h2>
        </div>

        <LoginForm returnUrl={returnUrl} />

        <p className="text-center text-sm text-gray-500">
          Human Resource Information System
        </p>
      </div>
    </div>
  );
}
