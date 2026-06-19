import { InferSchemaType, Model, Schema, model, models } from "mongoose";

const remoteControlRequestSchema = new Schema(
  {
    meetingId: {
      type: String,
      required: true,
      trim: true,
    },
    roomId: {
      type: String,
      trim: true,
      default: "",
    },
    requestedBy: {
      id: { type: String, required: true },
      name: { type: String, required: true },
      email: { type: String, default: "" },
    },
    requestedUser: {
      id: { type: String, required: true },
      name: { type: String, required: true },
      email: { type: String, default: "" },
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "expired"],
      default: "pending",
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
  }
);

remoteControlRequestSchema.index({ meetingId: 1, status: 1 });
remoteControlRequestSchema.index({ "requestedUser.id": 1, status: 1 });
remoteControlRequestSchema.index({ "requestedBy.id": 1, status: 1 });
remoteControlRequestSchema.index({ expiresAt: -1 });

export type RemoteControlRequestDocument = InferSchemaType<typeof remoteControlRequestSchema>;

const RemoteControlRequestModel =
  (models.RemoteControlRequest as Model<RemoteControlRequestDocument>) ||
  model<RemoteControlRequestDocument>("RemoteControlRequest", remoteControlRequestSchema);

export default RemoteControlRequestModel;
