import { OrderStatus, InvoiceStatus, RunStatus } from '../enums/index.js';

export class InvalidStateTransitionError extends Error {
  constructor(entity: string, from: string, to: string) {
    super(`Illegal state transition for ${entity} from '${from}' to '${to}'`);
    this.name = 'InvalidStateTransitionError';
  }
}

// Order State Machine
const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.SUBMITTED]: [
    OrderStatus.APPROVED,
    OrderStatus.PARTIALLY_APPROVED,
    OrderStatus.ON_HOLD,
    OrderStatus.REJECTED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.ON_HOLD]: [
    OrderStatus.APPROVED,
    OrderStatus.PARTIALLY_APPROVED,
    OrderStatus.REJECTED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.APPROVED]: [
    OrderStatus.INVOICED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PARTIALLY_APPROVED]: [
    OrderStatus.INVOICED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.INVOICED]: [
    OrderStatus.DISPATCHED,
  ],
  [OrderStatus.DISPATCHED]: [
    OrderStatus.CLOSED,
  ],
  [OrderStatus.REJECTED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.CLOSED]: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) {
    throw new InvalidStateTransitionError('Order', from, to);
  }
}

// Invoice State Machine
const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.POSTED, InvoiceStatus.CANCELLED],
  [InvoiceStatus.POSTED]: [InvoiceStatus.CANCELLED], // Only via Credit Note
  [InvoiceStatus.CANCELLED]: [],
};

export function canTransitionInvoice(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return INVOICE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateInvoiceTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  if (!canTransitionInvoice(from, to)) {
    throw new InvalidStateTransitionError('Invoice', from, to);
  }
}

// Production Run State Machine
const RUN_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  [RunStatus.DRAFT]: [RunStatus.POSTED],
  [RunStatus.POSTED]: [RunStatus.CLOSED, RunStatus.REVERSED],
  [RunStatus.CLOSED]: [],
  [RunStatus.REVERSED]: [],
};

export function canTransitionRun(from: RunStatus, to: RunStatus): boolean {
  return RUN_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateRunTransition(from: RunStatus, to: RunStatus): void {
  if (!canTransitionRun(from, to)) {
    throw new InvalidStateTransitionError('ProductionRun', from, to);
  }
}
