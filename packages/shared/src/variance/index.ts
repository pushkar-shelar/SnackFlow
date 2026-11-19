import { Decimal, DecimalValue, toDecimal } from '../money/index.js';

export const DEFAULT_TOLERANCE_PCT = new Decimal(3.0); // 3% tolerance threshold

export interface VarianceResult {
  standardQty: Decimal;
  actualQty: Decimal;
  varianceQty: Decimal;
  variancePct: Decimal;
  flagged: boolean;
}

export function calculateIngredientVariance(
  standardForBatch: DecimalValue,
  actualQty: DecimalValue,
  tolerancePct: DecimalValue = DEFAULT_TOLERANCE_PCT,
): VarianceResult {
  const std = toDecimal(standardForBatch);
  const act = toDecimal(actualQty);
  const tolerance = toDecimal(tolerancePct);

  const varianceQty = act.minus(std);
  if (std.isZero()) {
    return {
      standardQty: std,
      actualQty: act,
      varianceQty,
      variancePct: new Decimal(0),
      flagged: !act.isZero(),
    };
  }

  // (actual - standard) / standard * 100
  const variancePct = varianceQty.dividedBy(std).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const flagged = variancePct.abs().greaterThan(tolerance);

  return {
    standardQty: std,
    actualQty: act,
    varianceQty,
    variancePct,
    flagged,
  };
}

export function calculatePackagingVariance(
  goodOutputUnits: DecimalValue,
  perPacketSpecQty: DecimalValue,
  actualPackagingUsed: DecimalValue,
  tolerancePct: DecimalValue = DEFAULT_TOLERANCE_PCT,
): VarianceResult {
  const output = toDecimal(goodOutputUnits);
  const spec = toDecimal(perPacketSpecQty);
  const act = toDecimal(actualPackagingUsed);
  const tolerance = toDecimal(tolerancePct);

  // Standard = good output * per packet spec
  const std = output.times(spec).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const varianceQty = act.minus(std);

  if (std.isZero()) {
    return {
      standardQty: std,
      actualQty: act,
      varianceQty,
      variancePct: new Decimal(0),
      flagged: !act.isZero(),
    };
  }

  // (actual - standard) / standard * 100
  const variancePct = varianceQty.dividedBy(std).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const flagged = variancePct.abs().greaterThan(tolerance);

  return {
    standardQty: std,
    actualQty: act,
    varianceQty,
    variancePct,
    flagged,
  };
}

export function calculateYieldVariance(
  expectedOutputUnits: DecimalValue,
  goodOutputUnits: DecimalValue,
  tolerancePct: DecimalValue = DEFAULT_TOLERANCE_PCT,
): VarianceResult {
  const exp = toDecimal(expectedOutputUnits);
  const good = toDecimal(goodOutputUnits);
  const tolerance = toDecimal(tolerancePct);

  // (good_output - expected_output) / expected_output * 100
  const varianceQty = good.minus(exp);
  if (exp.isZero()) {
    return {
      standardQty: exp,
      actualQty: good,
      varianceQty,
      variancePct: new Decimal(0),
      flagged: !good.isZero(),
    };
  }

  const variancePct = varianceQty.dividedBy(exp).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const flagged = variancePct.abs().greaterThan(tolerance);

  return {
    standardQty: exp,
    actualQty: good,
    varianceQty,
    variancePct,
    flagged,
  };
}
