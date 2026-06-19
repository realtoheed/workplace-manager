import { InferSchemaType, Model, Schema, model, models } from "mongoose";

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["admin", "hr", "team_lead", "employee"],
      default: "employee"
    },
    jobTitle: {
      type: String,
      trim: true,
      default: ""
    },
    department: {
      type: String,
      trim: true,
      default: ""
    },
    category: {
      type: String,
      trim: true,
      default: "",
      index: true
    },
    bio: {
      type: String,
      trim: true,
      default: ""
    },
    location: {
      type: String,
      trim: true,
      default: ""
    },
    profileImageUrl: {
      type: String,
      trim: true,
      default: ""
    },
    mustChangePassword: {
      type: Boolean,
      default: false
    },
    workTimings: {
      startTime: {
        type: String,
        default: "17:00"
      },
      endTime: {
        type: String,
        default: "02:00"
      },
      breakStart: {
        type: String,
        default: "21:00"
      },
      breakEnd: {
        type: String,
        default: "22:00"
      },
      timezone: {
        type: String,
        default: "Asia/Karachi"
      }
    },
    badges: [{
      type: String,
      enum: ["punctual", "consistent"]
    }],
    badgeHistory: [{
      action: {
        type: String,
        enum: ["badges_earned", "badges_removed"]
      },
      badges: [String],
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
  },
  {
    timestamps: true
  }
);

export type UserDocument = InferSchemaType<typeof userSchema>;

const UserModel = (models.User as Model<UserDocument>) || model<UserDocument>("User", userSchema);

export default UserModel;
