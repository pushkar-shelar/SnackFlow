import { Decimal, DecimalValue, roundMoney, toDecimal } from '../money/index.js';
import { SupplyType } from '../enums/index.js';

export const COMPANY_STATE_CODE = '33'; // Tamil Nadu

export interface GstLineInput {
  itemId: string;
  qty: DecimalValue;
  rate: DecimalValue;
  gstRatePct: DecimalValue; // e.g. 5 for 5%
}

export interface GstLineResult {
  itemId: string;
  qty: Decimal;
  rate: Decimal;
  taxable: Decimal;
  gstRatePct: Decimal;
  cgst: Decimal;
  sgst: Decimal;
  igst: Decimal;
  lineTotal: Decimal;
}

export interface GstInvoiceCalculation {
  supplyType: SupplyType;
  placeOfSupply: string;
  lines: GstLineResult[];
  taxableTotal: Decimal;
  cgstTotal: Decimal;
  sgstTotal: Decimal;
  igstTotal: Decimal;
  taxTotal: Decimal;
  subTotal: Decimal;
  roundOff: Decimal;
  grandTotal: Decimal;
}

export function determineSupplyType(companyStateCode: string, customerStateCode: string): SupplyType {
  const normCompany = companyStateCode.trim().padStart(2, '0');
  const normCustomer = customerStateCode.trim().padStart(2, '0');
  return normCompany === normCustomer ? SupplyType.INTRA : SupplyType.INTER;
}

export function calculateInvoiceGst(
  lines: GstLineInput[],
  placeOfSupplyStateCode: string,
  companyStateCode: string = COMPANY_STATE_CODE,
): GstInvoiceCalculation {
  const supplyType = determineSupplyType(companyStateCode, placeOfSupplyStateCode);

  let taxableTotal = new Decimal(0);
  let cgstTotal = new Decimal(0);
  let sgstTotal = new Decimal(0);
  let igstTotal = new Decimal(0);

  const calculatedLines: GstLineResult[] = lines.map((line) => {
    const qty = toDecimal(line.qty);
    const rate = toDecimal(line.rate);
    const gstRate = toDecimal(line.gstRatePct);

    const taxable = roundMoney(qty.times(rate));
    let cgst = new Decimal(0);
    let sgst = new Decimal(0);
    let igst = new Decimal(0);

    if (supplyType === SupplyType.INTRA) {
      const halfRate = gstRate.dividedBy(2);
      cgst = roundMoney(taxable.times(halfRate).dividedBy(100));
      sgst = roundMoney(taxable.times(halfRate).dividedBy(100));
    } else {
      igst = roundMoney(taxable.times(gstRate).dividedBy(100));
    }

    const lineTotal = taxable.plus(cgst).plus(sgst).plus(igst);

    taxableTotal = taxableTotal.plus(taxable);
    cgstTotal = cgstTotal.plus(cgst);
    sgstTotal = sgstTotal.plus(sgst);
    igstTotal = igstTotal.plus(igst);

    return {
      itemId: line.itemId,
      qty,
      rate,
      taxable,
      gstRatePct: gstRate,
      cgst,
      sgst,
      igst,
      lineTotal,
    };
  });

  const taxTotal = cgstTotal.plus(sgstTotal).plus(igstTotal);
  const subTotal = taxableTotal.plus(taxTotal);

  // Optional round off to nearest rupee
  const roundedGrand = subTotal.round();
  const roundOff = roundMoney(roundedGrand.minus(subTotal));
  const grandTotal = subTotal.plus(roundOff);

  return {
    supplyType,
    placeOfSupply: placeOfSupplyStateCode,
    lines: calculatedLines,
    taxableTotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    taxTotal,
    subTotal,
    roundOff,
    grandTotal,
  };
}
