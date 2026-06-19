import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { categorySchema } from "@/lib/validations";
import CategoryModel from "@/models/Category";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiUser(request, ["super_admin", "hr"]);

    const categories = await CategoryModel.find({}).sort({ name: 1 }).lean();

    return NextResponse.json({
      categories: categories.map((category: any) => ({
        id: String(category._id),
        name: String(category.name || "")
      }))
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiUser(request, ["super_admin", "hr"]);
    const payload = categorySchema.parse(await request.json());

    const existing = await CategoryModel.findOne({ name: payload.name }).select("_id").lean();

    if (existing) {
      throw new Error("Category already exists.");
    }

    const category = await CategoryModel.create({ 
      name: payload.name,
    });

    return NextResponse.json(
      {
        category: {
          id: String(category._id),
          name: String(category.name || "")
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
