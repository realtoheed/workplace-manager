import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getHomeRoute, canManageUsers } from "@/lib/roles";
import PlatformShell from "@/components/PlatformShell";
import EmployeeTable from "@/components/EmployeeTable";

export default async function AdminEmployeesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageUsers(user.role)) redirect(getHomeRoute(user.role));

  return (
    <PlatformShell title="Employee Management" description="Add, edit, and manage employee accounts." user={user}>
      <EmployeeTable>
        <></>
      </EmployeeTable>
    </PlatformShell>
  );
}