import { z } from "zod";

export const createFeedSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  profileImage: z.string().url().optional(),
  webhookUrl: z.string().url().optional(),
  webhookChannelId: z.string().optional(),
  webhookGuildId: z.string().optional(),
  webhookName: z.string().optional(),
  messageTemplate: z.string().optional(),
  enabled: z.boolean().optional().default(true),
});

export const updateFeedSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  profileImage: z.string().url().nullable().optional(),
  webhookUrl: z.string().url().nullable().optional(),
  webhookChannelId: z.string().nullable().optional(),
  webhookGuildId: z.string().nullable().optional(),
  webhookName: z.string().nullable().optional(),
  messageTemplate: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
});

export type CreateFeedInput = z.infer<typeof createFeedSchema>;
export type UpdateFeedInput = z.infer<typeof updateFeedSchema>;
