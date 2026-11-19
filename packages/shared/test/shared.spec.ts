import { describe, it, expect } from 'vitest';
import {
  Decimal,
  toDecimal,
  roundMoney,
  roundQty,
  roundUnitCost,
  formatINR,
  calculateWac,
  calculateRemainderSplit,
  convertUom,
  UomConversionError,
  calculateInvoiceGst,
  determineSupplyType,
  calculateGstinChecksum,
  validateGstin,
  generateValidGstin,
  calculateIngredientVariance,
  calculatePackagingVariance,
  calculateYieldVariance,
  canTransitionOrder,
  canTransitionInvoice,
  canTransitionRun,
  hasPermission,
  getFinancialYear,
  formatInvoiceNumber,
  Role,
  SupplyType,
  OrderStatus,
  InvoiceStatus,
  RunStatus,
  Permission,
} from '../src/index.js';

describe('packages/shared — Domain Engines Unit Tests', () => {
  describe('Money & WAC Engine', () => {
    it('should round money half-up to 2 decimal places and format as INR', () => {
      expect(roundMoney('12.345').toString()).toBe('12.35');
      expect(roundMoney('12.344').toString()).toBe('12.34');
      expect(formatINR('1234567.89')).toBe('₹12,34,567.89');
      expect(formatINR('7875')).toBe('₹7,875.00');
    });

    it('should calculate WAC accurately for §14 Flour benchmark', () => {
      // Flour: 100 kg @ ₹42.00 (val ₹4,200) + 60 kg @ ₹45.00 (val ₹2,700) = 160 kg, ₹6,900
      const result = calculateWac(100, 4200, 60, 2700);
      expect(result.newQty.toString()).toBe('160');
      expect(result.newValue.toString()).toBe('6900');
      expect(result.newWac.toString()).toBe('43.125');

      // Issue 40 kg at WAC 43.125 = ₹1,725.00
      const issueVal = roundMoney(new Decimal(40).times(result.newWac));
      expect(issueVal.toString()).toBe('1725');

      // Closing = 120 kg, value ₹5,175.00 @ ₹43.125
      const closingVal = roundMoney(new Decimal(120).times(result.newWac));
      expect(closingVal.toString()).toBe('5175');
    });

    it('should allocate overheads without residual paise drift using remainder method (§14 benchmark)', () => {
      // 188 packets total: 88 on-hand, 100 dispatched. Total overheads = ₹1,800.00
      const split = calculateRemainderSplit(1800, [
        { id: 'dispatched_cogs', weight: 100 },
        { id: 'on_hand_inventory', weight: 88 },
      ]);

      const cogs = split.find((s) => s.id === 'dispatched_cogs')!;
      const inv = split.find((s) => s.id === 'on_hand_inventory')!;

      // Dispatched share: 100/188 * 1800 = 957.4468... -> 957.45
      expect(cogs.amount.toString()).toBe('957.45');
      // On hand share: 1800 - 957.45 = 842.55
      expect(inv.amount.toString()).toBe('842.55');
      // Sum matches ₹1,800.00 exactly
      expect(cogs.amount.plus(inv.amount).toString()).toBe('1800');
    });
  });

  describe('UoM Engine', () => {
    it('should convert standard mass and volume units', () => {
      expect(convertUom('1.5', 'KG', 'G').toString()).toBe('1500');
      expect(convertUom('2500', 'G', 'KG').toString()).toBe('2.5');
      expect(convertUom('10.5', 'L', 'ML').toString()).toBe('10500');
      expect(convertUom('750', 'ML', 'L').toString()).toBe('0.75');
    });

    it('should convert CTN to PKT with custom factor', () => {
      expect(convertUom('5', 'CTN', 'PKT', { customFactorToBase: 20 }).toString()).toBe('100');
      expect(convertUom('60', 'PKT', 'CTN', { customFactorToBase: 20 }).toString()).toBe('3');
    });

    it('should refuse cross-dimension conversion without density and allow with density', () => {
      expect(() => convertUom('10', 'L', 'KG')).toThrow(UomConversionError);

      // Oil density: 0.92 kg/L
      const kg = convertUom('10', 'L', 'KG', { densityKgPerL: '0.92' });
      expect(kg.toString()).toBe('9.2');
    });
  });

  describe('GST Engine (§14 Benchmark)', () => {
    it('should calculate intra-state GST (33 to 33) for Retailer A', () => {
      // Retailer A: 150 packets @ ₹50.00 = ₹7,500. GST rate = 5% (2.5% CGST + 2.5% SGST)
      const res = calculateInvoiceGst(
        [{ itemId: 'murukku-200g', qty: 150, rate: 50, gstRatePct: 5 }],
        '33',
        '33',
      );

      expect(res.supplyType).toBe(SupplyType.INTRA);
      expect(res.taxableTotal.toString()).toBe('7500');
      expect(res.cgstTotal.toString()).toBe('187.5');
      expect(res.sgstTotal.toString()).toBe('187.5');
      expect(res.igstTotal.toString()).toBe('0');
      expect(res.taxTotal.toString()).toBe('375');
      expect(res.grandTotal.toString()).toBe('7875');
    });

    it('should calculate inter-state GST (33 to 29) for Distributor B', () => {
      // Distributor B: 88 packets approved @ ₹50.00 = ₹4,400. IGST = 5% = ₹220.00. Total = ₹4,620.00
      const res = calculateInvoiceGst(
        [{ itemId: 'murukku-200g', qty: 88, rate: 50, gstRatePct: 5 }],
        '29',
        '33',
      );

      expect(res.supplyType).toBe(SupplyType.INTER);
      expect(res.taxableTotal.toString()).toBe('4400');
      expect(res.cgstTotal.toString()).toBe('0');
      expect(res.sgstTotal.toString()).toBe('0');
      expect(res.igstTotal.toString()).toBe('220');
      expect(res.grandTotal.toString()).toBe('4620');
    });
  });

  describe('GSTIN Checksum & Validation Engine', () => {
    it('should generate and validate official mod-36 GSTIN', () => {
      const gstinTN = generateValidGstin('33', 'AABCU9603R', '1');
      expect(gstinTN.length).toBe(15);
      expect(validateGstin(gstinTN)).toBe(true);

      const gstinKA = generateValidGstin('29', 'AABCU9603R', '1');
      expect(validateGstin(gstinKA)).toBe(true);

      // Corrupted character fails
      const corrupted = gstinTN.slice(0, 14) + (gstinTN[14] === 'Z' ? 'A' : 'Z');
      expect(validateGstin(corrupted)).toBe(false);
    });
  });

  describe('Production Variance Engine (§14 Benchmark)', () => {
    it('should calculate and flag Yield variance (-6.0%)', () => {
      // Expected = 200, Good = 188
      const v = calculateYieldVariance(200, 188);
      expect(v.variancePct.toString()).toBe('-6');
      expect(v.flagged).toBe(true);
    });

    it('should calculate and flag Oil ingredient variance (+5.0%)', () => {
      // Standard = 10 L, Actual = 10.5 L
      const v = calculateIngredientVariance(10, 10.5);
      expect(v.variancePct.toString()).toBe('5');
      expect(v.flagged).toBe(true);
    });

    it('should calculate and flag Pouch packaging variance (+3.19%)', () => {
      // Output = 188 packets, Spec = 1 pouch/pkt -> Standard = 188. Actual used = 194 (188 + 6 damaged)
      const v = calculatePackagingVariance(188, 1, 194);
      expect(v.variancePct.toString()).toBe('3.19');
      expect(v.flagged).toBe(true);
    });
  });

  describe('State Machines Engine', () => {
    it('should enforce Order transitions', () => {
      expect(canTransitionOrder(OrderStatus.SUBMITTED, OrderStatus.APPROVED)).toBe(true);
      expect(canTransitionOrder(OrderStatus.APPROVED, OrderStatus.INVOICED)).toBe(true);
      expect(canTransitionOrder(OrderStatus.INVOICED, OrderStatus.DISPATCHED)).toBe(true);
      expect(canTransitionOrder(OrderStatus.DISPATCHED, OrderStatus.CLOSED)).toBe(true);

      // Illegal transition
      expect(canTransitionOrder(OrderStatus.SUBMITTED, OrderStatus.DISPATCHED)).toBe(false);
      expect(canTransitionOrder(OrderStatus.CLOSED, OrderStatus.SUBMITTED)).toBe(false);
    });

    it('should enforce Invoice transitions (cancellation only via credit note)', () => {
      expect(canTransitionInvoice(InvoiceStatus.DRAFT, InvoiceStatus.POSTED)).toBe(true);
      expect(canTransitionInvoice(InvoiceStatus.POSTED, InvoiceStatus.CANCELLED)).toBe(true);
      expect(canTransitionInvoice(InvoiceStatus.CANCELLED, InvoiceStatus.POSTED)).toBe(false);
    });

    it('should enforce Run transitions', () => {
      expect(canTransitionRun(RunStatus.DRAFT, RunStatus.POSTED)).toBe(true);
      expect(canTransitionRun(RunStatus.POSTED, RunStatus.CLOSED)).toBe(true);
      expect(canTransitionRun(RunStatus.POSTED, RunStatus.REVERSED)).toBe(true);
      expect(canTransitionRun(RunStatus.CLOSED, RunStatus.REVERSED)).toBe(false);
    });
  });

  describe('Permission & RBAC Matrix', () => {
    it('should verify default-deny permissions by role', () => {
      // Salesman
      expect(hasPermission(Role.SALESMAN, Permission.ORDER_CREATE)).toBe(true);
      expect(hasPermission(Role.SALESMAN, Permission.ORDER_READ_OWN)).toBe(true);
      expect(hasPermission(Role.SALESMAN, Permission.ORDER_APPROVE)).toBe(false);
      expect(hasPermission(Role.SALESMAN, Permission.INVOICE_POST)).toBe(false);
      expect(hasPermission(Role.SALESMAN, Permission.PRODUCTION_RUN)).toBe(false);

      // Auditor (Strictly read-only)
      expect(hasPermission(Role.AUDITOR, Permission.REPORT_READ)).toBe(true);
      expect(hasPermission(Role.AUDITOR, Permission.AUDIT_READ)).toBe(true);
      expect(hasPermission(Role.AUDITOR, Permission.ORDER_CREATE)).toBe(false);
      expect(hasPermission(Role.AUDITOR, Permission.INVOICE_POST)).toBe(false);
      expect(hasPermission(Role.AUDITOR, Permission.PRODUCTION_POST)).toBe(false);
      expect(hasPermission(Role.AUDITOR, Permission.PAYMENT_CREATE)).toBe(false);

      // Admin
      expect(hasPermission(Role.ADMIN, Permission.ORDER_APPROVE)).toBe(true);
      expect(hasPermission(Role.ADMIN, Permission.INVOICE_POST)).toBe(true);
      expect(hasPermission(Role.ADMIN, Permission.DISPATCH_CREATE)).toBe(true);
      expect(hasPermission(Role.ADMIN, Permission.PAYMENT_CREATE)).toBe(true);
    });
  });

  describe('Financial Year & Invoice Numbering', () => {
    it('should format FY and invoice sequence number', () => {
      const fyNov2026 = getFinancialYear(new Date(2026, 10, 20)); // Nov 2026
      expect(fyNov2026).toBe('2627');

      const fyJan2027 = getFinancialYear(new Date(2027, 0, 15)); // Jan 2027
      expect(fyJan2027).toBe('2627');

      const fyApr2027 = getFinancialYear(new Date(2027, 3, 1)); // Apr 2027
      expect(fyApr2027).toBe('2728');

      const invNo = formatInvoiceNumber(1, fyNov2026);
      expect(invNo).toBe('INV/2627/00001');
      expect(invNo.length).toBeLessThanOrEqual(16);
    });
  });
});
