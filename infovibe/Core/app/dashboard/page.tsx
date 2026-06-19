import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getHomeRoute } from "@/lib/roles";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  redirect(getHomeRoute(user.role));
}