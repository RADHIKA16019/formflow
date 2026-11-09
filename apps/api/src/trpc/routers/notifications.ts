import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db/index.js";
import { forms, notifications } from "../../db/schema.js";
import { protectedProcedure, t } from "../trpc.js";

export const notificationsRouter = t.router({
  // Get all notifications
  getNotifications: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({
        id: notifications.id,
        title: notifications.title,
        message: notifications.message,
        formId: notifications.formId,
        responseId: notifications.responseId,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        formTitle: forms.title,
      })
      .from(notifications)
      .innerJoin(forms, eq(notifications.formId, forms.id))
      .where(eq(notifications.userId, ctx.session.user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }),

  // Get unread notification count
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const result = await db
      .select({
        total: notifications.id,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, ctx.session.user.id),
          isNull(notifications.readAt)
        )
      );

    return result.length;
  }),

  // Mark one notification as read
  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.id, input.notificationId),
            eq(notifications.userId, ctx.session.user.id),
            isNull(notifications.readAt)
          )
        );

      return { success: true };
    }),

  // Mark all notifications as read
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, ctx.session.user.id),
          isNull(notifications.readAt)
        )
      );

    return { success: true };
  }),
});