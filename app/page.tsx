import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const session = await getSession();

  if (session) {
    // User is logged in - redirect to dashboard
    redirect("/dashboard");
  } else {
    // User is not logged in - redirect to login
    redirect("/login");
  }
}
