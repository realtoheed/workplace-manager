import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { attachAuthCookie, comparePassword, getUserByEmail, signAuthToken } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      throw new Error("Email and password are required.");
    }

    const user = await getUserByEmail(email);
    if (!user) throw new Error("Invalid email or password.");

    const passwordValid = await comparePassword(password, user.password);
    if (!passwordValid) throw new Error("Invalid email or password.");

    if (!user.isActive) throw new Error("Account is deactivated.");

    const token = await signAuthToken({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: false,
      },
    });

    return attachAuthCookie(response, token);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
