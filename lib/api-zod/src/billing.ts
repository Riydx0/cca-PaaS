import { z } from "zod/v4";

export const InvoiceStatusEnum = z.enum(["Draft", "Issued", "Pending", "Paid", "Overdue", "Cancelled"]);

export const CreateInvoiceSchema = z.object({
  userId: z.number().int().positive(),
  serverOrderId: z.number().int().positive().optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: z.string().default("SAR"),
  status: InvoiceStatusEnum.default("Draft"),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

export const UpdateInvoiceSchema = z.object({
  status: InvoiceStatusEnum.optional(),
  notes: z.string().optional(),
  dueDate: z.string().optional(),
  paidAt: z.string().optional(),
});

export const InvoiceResponseSchema = z.object({
  id: z.number(),
  userId: z.number(),
  serverOrderId: z.number().nullable().optional(),
  invoiceNumber: z.string(),
  amount: z.string(),
  currency: z.string(),
  status: z.string(),
  issueDate: z.string(),
  dueDate: z.string().nullable().optional(),
  paidAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type CreateInvoice = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoice = z.infer<typeof UpdateInvoiceSchema>;
export type InvoiceResponse = z.infer<typeof InvoiceResponseSchema>;
