import Decimal from 'decimal.js';

// Configure Decimal.js default precision and rounding mode (ROUND_HALF_UP)
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type DecimalValue = Decimal | string | number;

export function toDecimal(val: DecimalValue): Decimal {
  if (val instanceof Decimal) {
    return val;
  }
  return new Decimal(val);
}

export function roundMoney(val: DecimalValue): Decimal {
  return toDecimal(val).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function roundQty(val: DecimalValue): Decimal {
  return toDecimal(val).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

export function roundUnitCost(val: DecimalValue): Decimal {
  return toDecimal(val).toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
}

export function formatINR(val: DecimalValue): string {
  const d = roundMoney(val);
  const parts = d.toFixed(2).split('.');
  const integerPart = parts[0] ?? '0';
  const decimalPart = parts[1] ?? '00';

  // Format Indian numbering format (e.g. 12,34,567.89)
  const isNegative = integerPart.startsWith('-');
  const cleanInt = isNegative ? integerPart.slice(1) : integerPart;
  
  let formatted = '';
  if (cleanInt.length <= 3) {
    formatted = cleanInt;
  } else {
    const lastThree = cleanInt.slice(-3);
    const remaining = cleanInt.slice(0, -3);
    const withCommas = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formatted = `${withCommas},${lastThree}`;
  }

  return `${isNegative ? '-' : ''}₹${formatted}.${decimalPart}`;
}

export function calculateWac(
  currentQty: DecimalValue,
  currentValue: DecimalValue,
  inQty: DecimalValue,
  inValue: DecimalValue,
): { newQty: Decimal; newValue: Decimal; newWac: Decimal } {
  const cQty = toDecimal(currentQty);
  const cVal = toDecimal(currentValue);
  const iQty = toDecimal(inQty);
  const iVal = toDecimal(inValue);

  const newQty = roundQty(cQty.plus(iQty));
  const newValue = roundMoney(cVal.plus(iVal));

  if (newQty.isZero()) {
    return { newQty: new Decimal(0), newValue: new Decimal(0), newWac: new Decimal(0) };
  }

  const newWac = roundUnitCost(newValue.dividedBy(newQty));
  return { newQty, newValue, newWac };
}

export function calculateRemainderSplit(
  totalAmount: DecimalValue,
  ratios: { id: string; weight: DecimalValue }[],
): { id: string; amount: Decimal }[] {
  const total = roundMoney(totalAmount);
  const totalWeight = ratios.reduce((sum, r) => sum.plus(toDecimal(r.weight)), new Decimal(0));

  if (totalWeight.isZero()) {
    return ratios.map((r) => ({ id: r.id, amount: new Decimal(0) }));
  }

  let allocatedSum = new Decimal(0);
  const result: { id: string; amount: Decimal }[] = [];

  for (let i = 0; i < ratios.length; i++) {
    const item = ratios[i]!;
    if (i === ratios.length - 1) {
      // Last item gets remainder to prevent 1 paisa drift
      const remainder = roundMoney(total.minus(allocatedSum));
      result.push({ id: item.id, amount: remainder });
    } else {
      const share = roundMoney(total.times(toDecimal(item.weight)).dividedBy(totalWeight));
      allocatedSum = allocatedSum.plus(share);
      result.push({ id: item.id, amount: share });
    }
  }

  return result;
}

export { Decimal };
