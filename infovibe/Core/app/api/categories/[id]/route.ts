import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import CategoryModel from "@/models/Category";
import UserModel from "@/models/User";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireApiUser(request, ["super_admin", "hr"]);
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      throw new Error("NotFound");
    }

    const category = await CategoryModel.findById(id).lean() as Record<string, any> | null;

    if (!category) {
      throw new Error("NotFound");
    }

    await Promise.all([
      CategoryModel.findByIdAndDelete(id),
      UserModel.updateMany({ category: category.name }, { $set: { category: "", department: "" } })
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
