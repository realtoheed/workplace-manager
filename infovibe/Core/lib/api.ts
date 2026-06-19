import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: error.errors[0]?.message || "Invalid request payload."
      },
      { status: 400 }
    );
  }

  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (error.message === "NotFound") {
      return NextResponse.json({ error: "Resource not found." }, { status: 404 });
    }

    if (error.message === "Conflict") {
      return NextResponse.json({ error: "Resource already exists." }, { status: 409 });
    }

    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (typeof error === "object" && error && "code" in error && error.code === 11000) {
    return NextResponse.json({ error: "A unique field value already exists." }, { status: 409 });
  }

  return NextResponse.json({ error: "Internal server error." }, { status: 500 });
}