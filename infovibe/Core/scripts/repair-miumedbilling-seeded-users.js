const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const TENANT_DB_NAME = "org_miumedbilling";
const ORG_NAME = "Miu Medbilling";
const USERS = [
  { name: "miu admin", email: "miu@infovibex.com", password: "Admin@321", role: "super_admin" },
  { name: "Sadaf", email: "sadaf@miumedbilling.com", password: "Sadaf123", role: "super_admin" },
  { name: "Sheeza", email: "sheeza@miumedbilling.com", password: "Sheeza123", role: "admin" },
  { name: "Toheed", email: "toheed@miumedbilling.com", password: "Toheed123", role: "admin" },
  { name: "Maheen", email: "maheen@miumedbilling.com", password: "Maheen123", role: "employee" },
  { name: "Naz Ammara", email: "ammara@miumedbilling.com", password: "Ammara123", role: "employee" },
  { name: "Areez Nasir", email: "areez@miumedbilling.com", password: "Areez123", role: "employee" },
  { name: "Salma", email: "salma@miumedbilling.com", password: "Salma123", role: "employee" },
  { name: "Naeem", email: "naeem@miumedbilling.com", password: "Naeem123", role: "employee" },
  { name: "Rubab", email: "rubab@miumedbilling.com", password: "Rubab123", role: "employee" },
  { name: "Maham Ali", email: "maham@miumedbilling.com", password: "Maham123", role: "employee" },
  { name: "Mansoor Khan", email: "mansoor@miumedbilling.com", password: "Mansoor123", role: "employee" },
  { name: "Maryam Syed", email: "maryam@miumedbilling.com", password: "Maryam123", role: "employee" },
  { name: "Faheem Uddin", email: "faheem@miumedbilling.com", password: "Faheem123", role: "employee" },
  { name: "Izma Rasheed", email: "izma@miumedbilling.com", password: "Izma@123", role: "employee" },
  { name: "Saqlain Munir", email: "saqlain@miumedbilling.com", password: "Saqlain123", role: "employee" },
  { name: "Aali Jah", email: "aalijah@miumedbilling.com", password: "Aalijah123", role: "employee" },
  { name: "Zara zia", email: "zara@miumedbilling.com", password: "Zara@123", role: "employee" },
  { name: "Usama Gillani", email: "usama@miumedbilling.com", password: "Usama123", role: "employee" },
  { name: "Hiba Gillani", email: "hiba@miumedbilling.com", password: "Hiba@123", role: "employee" },
  { name: "Binfa Akhtar", email: "binfa@miumedbilling.com", password: "Binfa123", role: "employee" }
];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function main() {
  const appRoot = process.cwd();
  loadEnvFile(path.join(appRoot, ".env.production"));
  loadEnvFile(path.join(appRoot, ".env"));

  const mongoUri = process.env.MONGODB_URI_HQ || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI_HQ or MONGODB_URI is not configured.");
  }

  await mongoose.connect(mongoUri);

  const tenantConnection = mongoose.connection.useDb(TENANT_DB_NAME, { useCache: true });
  const usersCollection = tenantConnection.db.collection("users");
  const registryCollection = mongoose.connection.db.collection("tenantregistries");
  const now = new Date();

  let userUpdates = 0;
  let registryUpdates = 0;

  for (const entry of USERS) {
    const normalizedEmail = entry.email.toLowerCase();
    const hashedPassword = await bcrypt.hash(entry.password, 12);

    const userResult = await usersCollection.updateOne(
      { email: normalizedEmail },
      {
        $set: {
          name: entry.name,
          email: normalizedEmail,
          password: hashedPassword,
          role: entry.role,
          tenantId: TENANT_DB_NAME,
          mustChangePassword: false,
          updatedAt: now
        },
        $setOnInsert: {
          createdAt: now,
          department: "",
          category: "",
          jobTitle: "",
          bio: "",
          location: "",
          profileImageUrl: "",
          publicProfileEnabled: false,
          showPublicProfileButton: false,
          leadCaptured: false
        }
      },
      { upsert: true }
    );

    if (userResult.matchedCount || userResult.upsertedCount) {
      userUpdates += 1;
    }

    const registryResult = await registryCollection.updateOne(
      { email: normalizedEmail },
      {
        $set: {
          email: normalizedEmail,
          tenantDbName: TENANT_DB_NAME,
          orgName: ORG_NAME,
          updatedAt: now
        },
        $setOnInsert: {
          createdAt: now
        }
      },
      { upsert: true }
    );

    if (registryResult.matchedCount || registryResult.upsertedCount) {
      registryUpdates += 1;
    }

    console.log(`REPAIRED ${normalizedEmail}`);
  }

  const totalUsers = await usersCollection.countDocuments();
  const totalAdmins = await usersCollection.countDocuments({ role: "admin" });
  const totalEmployees = await usersCollection.countDocuments({ role: "employee" });
  const totalSuperAdmins = await usersCollection.countDocuments({ role: "super_admin" });

  console.log(JSON.stringify({
    tenantDbName: TENANT_DB_NAME,
    repairedUsers: userUpdates,
    repairedRegistryEntries: registryUpdates,
    totals: {
      totalUsers,
      totalAdmins,
      totalEmployees,
      totalSuperAdmins
    }
  }, null, 2));

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
