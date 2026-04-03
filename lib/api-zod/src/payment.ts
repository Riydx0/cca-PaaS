import { z } from "zod/v4";

export const PaymentStatusEnum = z.enum(["Pending", "Completed", "Failed", "Refunded"]);

export const CreatePaymentSchema = z.object({
  invoiceId: z.number().int().positive(),
  userId: z.number().int().positive(),
  paymentMethod: z.string(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: z.string().default("SAR"),
  providerName: z.string().optional(),
});

export const PaymentResponseSchema = z.object({
  id: z.number(),
  userId: z.number(),
  invoiceId: z.number(),
  paymentMethod: z.string(),
  transactionReference: z.string().nullable().optional(),
  amount: z.string(),
  currency: z.string(),
  status: z.string(),
  providerName: z.string().nullable().optional(),
  providerResponse: z.string().nullable().optional(),
  createdAt: z.string(),
  completedAt: z.string().nullable().optional(),
});

export type CreatePayment = z.infer<typeof CreatePaymentSchema>;
export type PaymentResponse = z.infer<typeof PaymentResponseSchema>;
