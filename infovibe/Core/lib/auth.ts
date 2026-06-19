import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { connectToDatabase } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import type { SessionUser, UserRole } from "@/lib/types";

function getJwtSecretValue() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV !== "production") return "development-secret-change-me";
  throw new Error("JWT_SECRET is required in production.");
}

function getJwtSecret() {
  return new TextEncoder().encode(getJwtSecretValue());
}

type TokenPayload = {
  userId: string;
  role: UserRole;
  email: string;
  name: string;
  profileImageUrl?: string;
};

function normalizeSession(payload: TokenPayload): SessionUser {
  return {
    id: payload.userId,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    profileImageUrl: payload.profileImageUrl || "",
  };
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signAuthToken(payload: TokenPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getJwtSecret());
}

export async function verifyAuthToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return {
    userId: String(payload.userId),
    role: payload.role as UserRole,
    email: String(payload.email),
    name: String(payload.name),
    profileImageUrl: String(payload.profileImageUrl || ""),
  } satisfies TokenPayload;
}

function setAuthCookieValue(response: NextResponse, value: string, expires?: Date, maxAge?: number) {
  response.cookies.set({
    name: "infovibex_token",
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: true,
    path: "/",
    ...(typeof maxAge === "number" ? { maxAge } : {}),
    ...(expires ? { expires } : {}),
  });
  return response;
}

export function attachAuthCookie(response: NextResponse, token: string) {
  clearAuthCookie(response);
  return setAuthCookieValue(response, token, undefined, 60 * 60 * 12);
}

export function clearAuthCookie(response: NextResponse) {
  return setAuthCookieValue(response, "", new Date(0));
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("infovibex_token")?.value;
  if (!token) return null;

  try {
    const payload = await verifyAuthToken(token);
    await connectToDatabase();

    const dbUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, email: true, role: true, designation: true, defaultRoomId: true },
    });

    if (!dbUser) return null;

    return {
      id: payload.userId,
      email: String(dbUser.email || payload.email),
      name: String(dbUser.name || payload.name),
      role: dbUser.role as UserRole,
      profileImageUrl: "",
      defaultRoomId: dbUser.defaultRoomId || null,
    };
  } catch {
    return null;
  }
}

export async function requireApiUser(
  request: NextRequest,
  role?: UserRole | UserRole[]
): Promise<SessionUser> {
  const token = request.cookies.get("infovibex_token")?.value;
  if (!token) throw new Error("Unauthorized");

  const payload = await verifyAuthToken(token);
  await connectToDatabase();

  const dbUser = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, email: true, role: true, designation: true },
  });

  if (!dbUser) throw new Error("Unauthorized");

  const session: SessionUser = {
    id: payload.userId,
    email: String(dbUser.email || payload.email),
    name: String(dbUser.name || payload.name),
    role: dbUser.role as UserRole,
    profileImageUrl: "",
  };

  if (role) {
    const allowedRoles = Array.isArray(role) ? role : [role];
    if (!allowedRoles.includes(session.role)) {
      throw new Error("Forbidden");
    }
  }

  return session;
}

export async function getUserByEmail(email: string) {
  await connectToDatabase();
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

export const getLoginUserByEmail = getUserByEmail;

export async function countUsers() {
  await connectToDatabase();
  return prisma.user.count();
}

export async function createTokenForUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
}) {
  return signAuthToken({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
  });
}
