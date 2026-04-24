import type { TRPCRouterRecord } from "@trpc/server";

import { defaultDemoProfiles } from "@acme/validators";

import { protectedProcedure, publicProcedure } from "../trpc";

export const authRouter = {
  currentViewer: protectedProcedure.query(({ ctx }) => ({
    avatarInitials: ctx.viewer.avatarInitials,
    companyName: ctx.viewer.company.name,
    email: ctx.viewer.email,
    faceEnrollmentCapturedAt: ctx.viewer.faceEnrollmentCapturedAt,
    faceEnrollmentConfidence: ctx.viewer.faceEnrollmentConfidence,
    faceEnrolled:
      ctx.viewer.faceEnrolled && Boolean(ctx.viewer.faceTemplateHash),
    hourlyRate: ctx.viewer.hourlyRate,
    leaveBalanceDays: ctx.viewer.leaveBalanceDays,
    name: ctx.viewer.name,
    role: ctx.viewer.role,
    teamName: ctx.viewer.team?.name ?? "Unassigned",
  })),
  demoProfiles: publicProcedure.query(() => defaultDemoProfiles),
} satisfies TRPCRouterRecord;
