import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getHomeRoute } from "@/lib/roles";

export default async function AdminAttendancePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "employee") {
    redirect(getHomeRoute(user.role));
  }

  redirect("/attendance");
}