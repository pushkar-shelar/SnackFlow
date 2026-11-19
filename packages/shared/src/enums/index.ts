export enum Role {
  SALESMAN = 'SALESMAN',
  ADMIN = 'ADMIN',
  PRODUCTION = 'PRODUCTION',
  AUDITOR = 'AUDITOR',
  OWNER = 'OWNER',
}

export enum ItemKind {
  RAW = 'RAW',
  PACKAGING = 'PACKAGING',
  FINISHED = 'FINISHED',
  WIP = 'WIP',
}

export enum CostMethod {
  WAC = 'WAC',
  BATCH_ACTUAL = 'BATCH_ACTUAL',
}

export enum UomDimension {
  MASS = 'MASS',
  VOLUME = 'VOLUME',
  COUNT = 'COUNT',
}

export enum PartyKind {
  CUSTOMER_RETAILER = 'CUSTOMER_RETAILER',
  CUSTOMER_DISTRIBUTOR = 'CUSTOMER_DISTRIBUTOR',
  SUPPLIER = 'SUPPLIER',
}

export enum OrderStatus {
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  PARTIALLY_APPROVED = 'PARTIALLY_APPROVED',
  ON_HOLD = 'ON_HOLD',
  REJECTED = 'REJECTED',
  INVOICED = 'INVOICED',
  DISPATCHED = 'DISPATCHED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  CANCELLED = 'CANCELLED',
}

export enum RunStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  CLOSED = 'CLOSED',
  REVERSED = 'REVERSED',
}

export enum MovementType {
  OPENING = 'OPENING',
  PURCHASE = 'PURCHASE',
  ISSUE = 'ISSUE',
  PRODUCE = 'PRODUCE',
  WASTAGE = 'WASTAGE',
  DISPATCH = 'DISPATCH',
  RETURN = 'RETURN',
  ADJUST = 'ADJUST',
  COST_ADJ = 'COST_ADJ',
}

export enum SupplyType {
  INTRA = 'INTRA',
  INTER = 'INTER',
}

export enum WastageReason {
  DAMAGED_PACKAGING = 'DAMAGED_PACKAGING',
  YIELD_LOSS = 'YIELD_LOSS',
  SCRAP = 'SCRAP',
}

export enum OverheadType {
  LABOUR = 'LABOUR',
  GAS_POWER = 'GAS_POWER',
  OTHER = 'OTHER',
}

export enum PaymentMode {
  CASH = 'CASH',
  UPI = 'UPI',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHEQUE = 'CHEQUE',
}
