import { z } from 'zod';
import { Role, PartyKind, PaymentMode, OverheadType, WastageReason } from '../enums/index.js';

// Auth DTOs
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
export type LoginDto = z.infer<typeof LoginSchema>;

// Order DTOs
export const OrderLineInputSchema = z.object({
  itemId: z.string().uuid(),
  qty: z.number().positive(),
  rate: z.number().positive(),
  uom: z.string().min(1),
});
export type OrderLineInputDto = z.infer<typeof OrderLineInputSchema>;

export const CreateOrderSchema = z.object({
  clientUuid: z.string().uuid(),
  partyId: z.string().uuid(),
  salesmanId: z.string().uuid().optional(),
  geoLat: z.number().optional(),
  geoLng: z.number().optional(),
  lines: z.array(OrderLineInputSchema).min(1),
});
export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;

export const ApproveOrderSchema = z.object({
  action: z.enum(['APPROVE_FULL', 'APPROVE_AVAILABLE_BACKORDER', 'HOLD', 'REJECT']),
  notes: z.string().optional(),
});
export type ApproveOrderDto = z.infer<typeof ApproveOrderSchema>;

// Invoicing DTOs
export const PostInvoiceSchema = z.object({
  orderId: z.string().uuid(),
});
export type PostInvoiceDto = z.infer<typeof PostInvoiceSchema>;

// Payment DTOs
export const PaymentAllocationInputSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
});

export const CreatePaymentSchema = z.object({
  partyId: z.string().uuid(),
  amount: z.number().positive(),
  mode: z.nativeEnum(PaymentMode),
  reference: z.string().min(1),
  allocations: z.array(PaymentAllocationInputSchema).optional(),
});
export type CreatePaymentDto = z.infer<typeof CreatePaymentSchema>;

// Production Run DTOs
export const RunInputItemSchema = z.object({
  itemId: z.string().uuid(),
  actualQty: z.number().positive(),
  uom: z.string().min(1),
});

export const CreateProductionRunSchema = z.object({
  recipeId: z.string().uuid(),
  fgItemId: z.string().uuid(),
  batchFactor: z.number().positive().default(1),
  runDate: z.string().datetime().optional(),
  inputs: z.array(RunInputItemSchema).min(1),
  goodOutputQty: z.number().nonnegative(),
  damagedPackagingQty: z.number().nonnegative().default(0),
  cartonsUsed: z.number().nonnegative().default(0),
});
export type CreateProductionRunDto = z.infer<typeof CreateProductionRunSchema>;

// Purchasing DTOs
export const PurchaseLineInputSchema = z.object({
  itemId: z.string().uuid(),
  qty: z.number().positive(),
  unitCost: z.number().positive(),
  uom: z.string().min(1),
});

export const CreatePurchaseSchema = z.object({
  partyId: z.string().uuid(),
  purchaseDate: z.string().datetime().optional(),
  invoiceNo: z.string().min(1),
  lines: z.array(PurchaseLineInputSchema).min(1),
});
export type CreatePurchaseDto = z.infer<typeof CreatePurchaseSchema>;

// Overheads DTOs
export const CreateOverheadSchema = z.object({
  type: z.nativeEnum(OverheadType),
  amount: z.number().positive(),
  runId: z.string().uuid().optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
});
export type CreateOverheadDto = z.infer<typeof CreateOverheadSchema>;

// Party DTOs
export const CreatePartySchema = z.object({
  name: z.string().min(1),
  kind: z.nativeEnum(PartyKind),
  gstin: z.string().optional(),
  stateCode: z.string().length(2),
  address: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  priceListId: z.string().uuid().optional(),
  assignedSalesmanId: z.string().uuid().optional(),
  creditDays: z.number().int().nonnegative().default(30),
});
export type CreatePartyDto = z.infer<typeof CreatePartySchema>;
