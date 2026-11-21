import { z } from 'zod';
import { PartyKind, PaymentMode, OverheadType } from '../enums/index.js';

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

// Dispatch DTOs
export const DispatchInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  notes: z.string().optional(),
});
export type DispatchInvoiceDto = z.infer<typeof DispatchInvoiceSchema>;

// Credit Note DTOs
export const CreateCreditNoteSchema = z.object({
  reason: z.string().min(1),
});
export type CreateCreditNoteDto = z.infer<typeof CreateCreditNoteSchema>;

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

export const CreateRetailerApplicationSchema = z.object({
  storeName: z.string().min(2, 'Store name is required'),
  contactPerson: z.string().min(2, 'Contact person name is required'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number'),
  address: z.string().min(5, 'Address is required'),
  stateCode: z.string().default('33'), // 33 = Tamil Nadu
  gstin: z.string().optional(),
  geoLat: z.number().optional(),
  geoLng: z.number().optional(),
});
export type CreateRetailerApplicationDto = z.infer<typeof CreateRetailerApplicationSchema>;

export const ApproveRetailerApplicationSchema = z.object({
  creditLimit: z.number().nonnegative().default(15000),
  creditDays: z.number().int().nonnegative().default(30),
  priceListId: z.string().uuid().optional(),
});
export type ApproveRetailerApplicationDto = z.infer<typeof ApproveRetailerApplicationSchema>;