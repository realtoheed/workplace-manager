import { InferSchemaType, Model, Schema, model, models } from "mongoose";

const clientMeetingSchema = new Schema(
  {
    meetingName: {
      type: String,
      required: true,
      trim: true
    },
    clientName: {
      type: String,
      trim: true,
      default: ""
    },
    clientEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: ""
    },
    roomId: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    clientToken: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    startsAt: {
      type: Date,
      default: null
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }
    }
  },
  {
    timestamps: true
  }
);

clientMeetingSchema.index({ expiresAt: -1 });

export type ClientMeetingDocument = InferSchemaType<typeof clientMeetingSchema>;

const ClientMeetingModel =
  (models.ClientMeeting as Model<ClientMeetingDocument>) || model<ClientMeetingDocument>("ClientMeeting", clientMeetingSchema);

export default ClientMeetingModel;
