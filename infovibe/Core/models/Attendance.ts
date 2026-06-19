import { InferSchemaType, Model, Schema, model, models } from "mongoose";

const attendanceSchema = new Schema(
  {
    meetingId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    attendanceType: {
      type: String,
      trim: true,
      default: "",
      index: true
    },
    participantId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      trim: true,
      default: ""
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      index: true
    },
    joinTime: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    leaveTime: {
      type: Date,
      default: null,
      index: true
    },
    duration: {
      type: Number,
      default: null
    },
    room: {
      type: String,
      required: true,
      trim: true
    },
    source: {
      type: String,
      default: "jitsi-webhook"
    },
    serverConfirmed: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

attendanceSchema.index({ meetingId: 1, participantId: 1, room: 1, leaveTime: 1 });

export type AttendanceDocument = InferSchemaType<typeof attendanceSchema>;

const AttendanceModel =
  (models.Attendance as Model<AttendanceDocument>) ||
  model<AttendanceDocument>("Attendance", attendanceSchema);

export default AttendanceModel;
