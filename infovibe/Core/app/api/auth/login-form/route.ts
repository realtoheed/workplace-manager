import { NextRequest, NextResponse } from "next/server";
import {
  attachAuthCookie,
  comparePassword,
  createTokenForUser,
  getLoginUserByEmail,
} from "@/lib/auth";
import { getHomeRoute } from "@/lib/roles";

function getPublicBaseUrl(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`;
  }
  return request.url;
}

export async function POST(request: NextRequest) {
  try {
    const publicBaseUrl = getPublicBaseUrl(request);
    const formData = await request.formData();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");

    if (!email || !password) {
      return NextResponse.redirect(new URL("/login?error=missing_credentials", publicBaseUrl));
    }

    const user = await getLoginUserByEmail(email);

    if (!user) {
      return NextResponse.redirect(new URL("/login?error=invalid_credentials", publicBaseUrl));
    }

    const validPassword = await comparePassword(password, user.password);

    if (!validPassword) {
      return NextResponse.redirect(new URL("/login?error=invalid_credentials", publicBaseUrl));
    }

    const token = await createTokenForUser({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    const homeRoute = getHomeRoute(user.role as any);
    const destination = homeRoute;

    const response = NextResponse.redirect(new URL(destination, publicBaseUrl));
    return attachAuthCookie(response, token);
  } catch {
    return NextResponse.redirect(new URL("/login?error=login_failed", getPublicBaseUrl(request)));
  }
}
