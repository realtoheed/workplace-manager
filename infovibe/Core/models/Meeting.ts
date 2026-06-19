import { InferSchemaType, Model, Schema, model, models } from "mongoose";

const meetingSchema = new Schema(
  {
    meetingName: {
      type: String,
      required: true,
      trim: true
    },
    meetingId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    breakoutRoomCount: {
      type: Number,
      min: 0,
      max: 50,
      default: 0
    },
    breakoutRooms: {
      type: [String],
      default: []
    },
    breakoutRoomNames: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

export type MeetingDocument = InferSchemaType<typeof meetingSchema>;

const MeetingModel =
  (models.Meeting as Model<MeetingDocument>) || model<MeetingDocument>("Meeting", meetingSchema);

export default MeetingModel;
