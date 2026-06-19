import mongoose from "mongoose";
import { prisma } from "@/lib/prisma";

export { prisma };

let mongoConnected = false;

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://infovibe:infovibe_pass_2024@127.0.0.1:27017/core";

async function connectMongo() {
  if (mongoConnected) return;
  if (mongoose.connection.readyState >= 1) {
    mongoConnected = true;
    return;
  }
  try {
    await mongoose.connect(MONGODB_URI);
    mongoConnected = true;
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  }
}

export async function connectToDatabase() {
  await Promise.all([
    prisma.$connect(),
    connectMongo(),
  ]);
}
