import { InferSchemaType, Model, Schema, model, models } from "mongoose";

const categorySchema = new Schema(
  {
    expiresAt: {
      type: Date,
      index: { expires: 0 }
    },
    name: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

export type CategoryDocument = InferSchemaType<typeof categorySchema>;

const CategoryModel =
  (models.Category as Model<CategoryDocument>) || model<CategoryDocument>("Category", categorySchema);

export default CategoryModel;
