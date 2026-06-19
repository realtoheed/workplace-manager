import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(["admin", "hr", "team_lead", "employee"]).default("employee")
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(80)
});

export const updateMeetingBreakoutConfigSchema = z
  .object({
    breakoutCount: z.number().int().min(0).max(50),
    breakoutRoomNames: z.array(z.string().trim().min(2).max(80)).max(50)
  })
  .refine((value) => value.breakoutRoomNames.length <= value.breakoutCount, {
    message: "Breakout room names cannot exceed breakout room count.",
    path: ["breakoutRoomNames"]
  });

const optionalDateTimeSchema = z.union([z.string().trim().datetime(), z.literal("")]).optional().default("");

export const createClientMeetingSchema = z
  .object({
    projectName: z.string().trim().min(2).max(120),
    startsAt: optionalDateTimeSchema,
    endsAt: optionalDateTimeSchema
  })
  .superRefine((payload, context) => {
    if (!payload.startsAt || !payload.endsAt) {
      return;
    }

    if (new Date(payload.endsAt).getTime() <= new Date(payload.startsAt).getTime()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End time must be after start time.",
        path: ["endsAt"]
      });
    }
  });

export const clientMeetingJoinSchema = z.object({
  tenantId: z.string().trim().min(1).max(120),
  token: z.string().trim().min(16).max(120),
  displayName: z
    .string()
    .trim()
    .max(120)
    .optional()
    .default("")
    .refine((value) => value.length === 0 || value.length >= 2, "Display name must be at least 2 characters.")
});