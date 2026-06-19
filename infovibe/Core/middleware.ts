import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import type { UserRole } from "@/lib/types";

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
};

const ROLE_HOME: Record<string, string> = {
  employee: "/dashboard/employee",
  team_lead: "/dashboard/team-lead",
  hr: "/dashboard/hr",
  super_admin: "/dashboard/admin",
};

async function readToken(request: NextRequest): Promise<TokenPayload | null> {
  const token = request.cookies.get("infovibex_token")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return {
      userId: String(payload.userId),
      role: payload.role as UserRole,
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await readToken(request);

  if (pathname === "/") {
    if (!session) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.redirect(new URL(ROLE_HOME[session.role] || "/dashboard/employee", request.url));
  }

  if (pathname.startsWith("/login")) {
    if (!session) return NextResponse.next();
    return NextResponse.redirect(new URL(ROLE_HOME[session.role] || "/dashboard/employee", request.url));
  }

  const protectedPaths = [
    "/dashboard", "/attendance",
    "/meeting", "/admin", "/leave",
  ];

  if (protectedPaths.some((p) => pathname.startsWith(p))) {
    if (!session) return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/", "/login/:path*",
    "/dashboard/:path*", "/attendance/:path*",
    "/meeting/:path*",
    "/admin/:path*", "/leave/:path*",
  ],
};
