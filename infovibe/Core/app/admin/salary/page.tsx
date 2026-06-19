import { redirect } from "next/navigation";
import PlatformShell from "@/components/PlatformShell";
import { getCurrentUser } from "@/lib/auth";
import { canManageSalary } from "@/lib/roles";
import SalaryManagementClient from "./SalaryManagementClient";

export default async function AdminSalaryPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (!canManageSalary(user.role)) redirect("/admin");

  return (
    <PlatformShell
      description="Manage employee salaries, deductions, and increment history"
      title="Salary Management"
      user={user}
    >
      <SalaryManagementClient />
    </PlatformShell>
  );
}