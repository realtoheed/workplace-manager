const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const TENANT_DB_NAME = "org_miumedbilling";
const ORG_NAME = "Miu Medbilling";
const USER = {
  name: "Sadaf",
  email: "sadaf@miumedbilling.com",
  password: "Sadaf123",
  role: "super_admin"
};

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

    const normalizedLine = line.startsWith("export ") ? line.slice(7).trim() : line;

    const separatorIndex = normalizedLine.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    const value = normalizedLine.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function applyPm2MongoEnv(appName) {
  try {
    const apps = JSON.parse(execSync("pm2 jlist", { encoding: "utf8" }));
    const app = Array.isArray(apps) ? apps.find((entry) => entry && entry.name === appName) : null;
    const env = app && app.pm2_env ? app.pm2_env : null;

    if (!env) {
      return;
    }

    if (!process.env.MONGODB_URI && env.MONGODB_URI) {
      process.env.MONGODB_URI = env.MONGODB_URI;
    }

    if (!process.env.MONGODB_URI_HQ && env.MONGODB_URI_HQ) {
      process.env.MONGODB_URI_HQ = env.MONGODB_URI_HQ;
    }
  } catch {
  }
}

async function main() {
  const appRoot = path.resolve(__dirname, "..");
  loadEnvFile(path.join(appRoot, ".env.production"));
  loadEnvFile(path.join(appRoot, ".env.local"));
  loadEnvFile(path.join(appRoot, ".env"));
  applyPm2MongoEnv("core-taskmanager");

  const mongoUri = process.env.MONGODB_URI_HQ || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI_HQ or MONGODB_URI is not configured.");
  }

  await mongoose.connect(mongoUri);

  const tenantConnection = mongoose.connection.useDb(TENANT_DB_NAME, { useCache: true });
  const usersCollection = tenantConnection.db.collection("users");
  const registryCollection = mongoose.connection.db.collection("tenantregistries");
  const now = new Date();
  const normalizedEmail = USER.email.toLowerCase();
  const hashedPassword = await bcrypt.hash(USER.password, 12);

  const userResult = await usersCollection.updateOne(
    { email: normalizedEmail },
    {
      $set: {
        name: USER.name,
        email: normalizedEmail,
        password: hashedPassword,
        role: USER.role,
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

  const savedUser = await usersCollection.findOne(
    { email: normalizedEmail },
    { projection: { name: 1, email: 1, role: 1, tenantId: 1 } }
  );

  console.log(
    JSON.stringify(
      {
        user: savedUser,
        userMatchedCount: userResult.matchedCount,
        userUpsertedCount: userResult.upsertedCount,
        registryMatchedCount: registryResult.matchedCount,
        registryUpsertedCount: registryResult.upsertedCount
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
