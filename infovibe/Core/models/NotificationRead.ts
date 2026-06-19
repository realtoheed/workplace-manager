import { InferSchemaType, Model, Schema, model, models } from "mongoose";

const notificationReadSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    expiresAt: {
      type: Date,
      index: { expires: 0 }
    },
    notificationId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

notificationReadSchema.index({ userId: 1, notificationId: 1 }, { unique: true });

export type NotificationReadDocument = InferSchemaType<typeof notificationReadSchema>;

const NotificationReadModel =
  (models.NotificationRead as Model<NotificationReadDocument>) ||
  model<NotificationReadDocument>("NotificationRead", notificationReadSchema);

export default NotificationReadModel;
