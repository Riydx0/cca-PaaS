import { z } from "zod/v4";

export const AuditLogResponseSchema = z.object({
  id: z.number(),
  userId: z.number().nullable().optional(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable().optional(),
  details: z.union([z.record(z.unknown()), z.string()]).nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type AuditLogResponse = z.infer<typeof AuditLogResponseSchema>;
