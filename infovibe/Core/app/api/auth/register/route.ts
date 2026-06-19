import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import {
  attachAuthCookie,
  countUsers,
  createTokenForUser,
  getUserByEmail,
  hashPassword,
  requireApiUser
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import type { UserRole } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const payload = registerSchema.parse(await request.json());
    const existingUsers = await countUsers();
    const existingUser = await getUserByEmail(payload.email);

    if (existingUser) {
      throw new Error("Conflict");
    }

    const isBootstrap = existingUsers === 0;

    if (!isBootstrap) {
      await requireApiUser(request, ["super_admin", "hr"]);
    }

    const user = await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email.toLowerCase(),
        password: await hashPassword(payload.password),
        role: (isBootstrap ? "super_admin" : payload.role) as UserRole,
      },
    });

    if (isBootstrap) {
      const token = await createTokenForUser({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      });
      const response = NextResponse.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });

      return attachAuthCookie(response, token);
    }

    return NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
