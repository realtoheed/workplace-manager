import { redirect } from "next/navigation";
import AttendanceHistoryManager from "@/components/AttendanceHistoryManager";
import PlatformShell from "@/components/PlatformShell";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers, isAdmin } from "@/lib/roles";

export default async function AttendancePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  let deptMemberIds: string[] = [];

  if (user.role === "team_lead") {
    const department = await prisma.department.findFirst({
      where: { headId: user.id },
      select: { id: true },
    });
    if (department) {
      const members = await prisma.user.findMany({
        where: { departmentId: department.id, isActive: true },
        select: { id: true },
      });
      deptMemberIds = members.map((m) => m.id);
    }
  }

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      ...(user.role === "team_lead" && deptMemberIds.length > 0
        ? { id: { in: deptMemberIds } }
        : {}),
      ...(user.role === "team_lead" && deptMemberIds.length === 0
        ? { id: user.id }
        : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });

  const visibleUsers = canManageUsers(user.role) || user.role === "team_lead"
    ? users
    : users.filter((entry) => entry.id === user.id);

  const showEmployeeSelector = canManageUsers(user.role) || user.role === "team_lead";

  return (
    <PlatformShell
      description={showEmployeeSelector ? "Review attendance history across the team." : "Review your own attendance history."}
      title="Attendance History"
      user={user}
    >
      <AttendanceHistoryManager
        currentUserId={user.id}
        employees={visibleUsers.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
        showEmployeeSelector={showEmployeeSelector}
      />
    </PlatformShell>
  );
}