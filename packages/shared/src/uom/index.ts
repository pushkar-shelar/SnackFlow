import { Decimal, DecimalValue, roundQty, toDecimal } from '../money/index.js';
import { UomDimension } from '../enums/index.js';

export interface UomDefinition {
  code: string;
  dimension: UomDimension;
  baseUom: string;
  factorToBase: Decimal;
}

export const STANDARD_UOMS: Record<string, { dimension: UomDimension; baseUom: string; factorToBase: number }> = {
  KG: { dimension: UomDimension.MASS, baseUom: 'KG', factorToBase: 1 },
  G: { dimension: UomDimension.MASS, baseUom: 'KG', factorToBase: 0.001 },
  L: { dimension: UomDimension.VOLUME, baseUom: 'L', factorToBase: 1 },
  ML: { dimension: UomDimension.VOLUME, baseUom: 'L', factorToBase: 0.001 },
  PCS: { dimension: UomDimension.COUNT, baseUom: 'PCS', factorToBase: 1 },
  PKT: { dimension: UomDimension.COUNT, baseUom: 'PKT', factorToBase: 1 },
  CTN: { dimension: UomDimension.COUNT, baseUom: 'PKT', factorToBase: 20 }, // Default Murukku 200g: 1 CTN = 20 PKT
};

export class UomConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UomConversionError';
  }
}

export function convertUom(
  qty: DecimalValue,
  fromUom: string,
  toUom: string,
  options?: {
    customFactorToBase?: DecimalValue; // From item_uom table if applicable
    densityKgPerL?: DecimalValue; // Required for Mass <-> Volume
  },
): Decimal {
  const from = fromUom.toUpperCase();
  const to = toUom.toUpperCase();

  if (from === to) {
    return roundQty(qty);
  }

  const dQty = toDecimal(qty);

  // Check standard definitions
  const defFrom = STANDARD_UOMS[from];
  const defTo = STANDARD_UOMS[to];

  if (!defFrom || !defTo) {
    throw new UomConversionError(`Unsupported UoM conversion between '${fromUom}' and '${toUom}'`);
  }

  // Cross-dimension check
  if (defFrom.dimension !== defTo.dimension) {
    if (
      (defFrom.dimension === UomDimension.MASS && defTo.dimension === UomDimension.VOLUME) ||
      (defFrom.dimension === UomDimension.VOLUME && defTo.dimension === UomDimension.MASS)
    ) {
      if (!options?.densityKgPerL) {
        throw new UomConversionError(
          `Cross-dimension conversion from ${from} (${defFrom.dimension}) to ${to} (${defTo.dimension}) requires density (kg/L)`,
        );
      }
      const density = toDecimal(options.densityKgPerL);
      if (defFrom.dimension === UomDimension.VOLUME) {
        // Volume (L) -> Mass (KG)
        const liters = dQty.times(defFrom.factorToBase);
        const kg = liters.times(density);
        return roundQty(kg.dividedBy(defTo.factorToBase));
      } else {
        // Mass (KG) -> Volume (L)
        const kg = dQty.times(defFrom.factorToBase);
        const liters = kg.dividedBy(density);
        return roundQty(liters.dividedBy(defTo.factorToBase));
      }
    }
    throw new UomConversionError(`Cannot convert across incompatible dimensions: ${defFrom.dimension} to ${defTo.dimension}`);
  }

  // Same dimension
  const factorFrom = options?.customFactorToBase !== undefined && from === 'CTN'
    ? toDecimal(options.customFactorToBase)
    : toDecimal(defFrom.factorToBase);

  const factorTo = options?.customFactorToBase !== undefined && to === 'CTN'
    ? toDecimal(options.customFactorToBase)
    : toDecimal(defTo.factorToBase);

  // Convert to base, then to target
  const inBase = dQty.times(factorFrom);
  const inTarget = inBase.dividedBy(factorTo);

  return roundQty(inTarget);
}
