import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const password = await bcrypt.hash("demo1234", 12);

  // Create demo users for each role
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      email: "admin@demo.com",
      password,
      name: "Admin Demo",
      role: "super_admin",
      designation: "System Owner",
      salary: 100000,
      workStartTime: "09:00",
      workEndTime: "18:00",
    },
  });

  const hr = await prisma.user.upsert({
    where: { email: "hr@demo.com" },
    update: {},
    create: {
      email: "hr@demo.com",
      password,
      name: "HR Demo",
      role: "hr",
      designation: "HR Manager",
      salary: 70000,
      workStartTime: "09:00",
      workEndTime: "18:00",
    },
  });

  const teamLead = await prisma.user.upsert({
    where: { email: "lead@demo.com" },
    update: {},
    create: {
      email: "lead@demo.com",
      password,
      name: "Team Lead Demo",
      role: "team_lead",
      designation: "Team Lead",
      salary: 60000,
      workStartTime: "10:00",
      workEndTime: "19:00",
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: "employee@demo.com" },
    update: {},
    create: {
      email: "employee@demo.com",
      password,
      name: "Employee Demo",
      role: "employee",
      designation: "Software Developer",
      salary: 50000,
      workStartTime: "10:00",
      workEndTime: "19:00",
    },
  });

  console.log("Users created:");
  console.log(`  super_admin: admin@demo.com / demo1234`);
  console.log(`  hr: hr@demo.com / demo1234`);
  console.log(`  team_lead: lead@demo.com / demo1234`);
  console.log(`  employee: employee@demo.com / demo1234`);

  // Create a department
  const dept = await prisma.department.upsert({
    where: { name: "Engineering" },
    update: {},
    create: {
      name: "Engineering",
      headId: teamLead.id,
    },
  });

  // Assign employee to department
  await prisma.user.update({
    where: { id: employee.id },
    data: { departmentId: dept.id },
  });

  console.log(`Department "Engineering" created with head: ${teamLead.name}`);

  // Create persistent meeting
  const persistentMeeting = await prisma.meeting.upsert({
    where: { roomName: "company-office" },
    update: {},
    create: {
      title: "Company Office",
      type: "persistent",
      roomName: "company-office",
      isActive: true,
      hostId: superAdmin.id,
    },
  });

  console.log(`Persistent meeting "Company Office" created`);

  await prisma.$disconnect();
  console.log("Seeding complete.");
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
