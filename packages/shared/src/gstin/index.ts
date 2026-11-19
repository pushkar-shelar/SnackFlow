const GSTIN_CHAR_MAP = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function calculateGstinChecksum(first14Chars: string): string {
  const clean = first14Chars.trim().toUpperCase();
  if (clean.length !== 14) {
    throw new Error(`First 14 characters of GSTIN required, got length ${clean.length}`);
  }

  let totalSum = 0;
  for (let i = 0; i < 14; i++) {
    const char = clean[i]!;
    const codePoint = GSTIN_CHAR_MAP.indexOf(char);
    if (codePoint === -1) {
      throw new Error(`Invalid character '${char}' in GSTIN`);
    }

    const factor = i % 2 === 0 ? 1 : 2;
    const prod = codePoint * factor;
    const quotient = Math.floor(prod / 36);
    const remainder = prod % 36;
    totalSum += quotient + remainder;
  }

  const checkCodePoint = (36 - (totalSum % 36)) % 36;
  return GSTIN_CHAR_MAP[checkCodePoint]!;
}

export function validateGstin(gstin: string): boolean {
  if (!gstin) return false;
  const clean = gstin.trim().toUpperCase();
  if (clean.length !== 15) return false;

  // Basic regex check: 2 digits state + 5 letters + 4 digits + 1 letter + 1 char + Z + 1 char
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!regex.test(clean)) return false;

  const first14 = clean.slice(0, 14);
  const expectedCheckChar = calculateGstinChecksum(first14);
  return clean[14] === expectedCheckChar;
}

export function extractStateCodeFromGstin(gstin: string): string {
  const clean = gstin.trim().toUpperCase();
  if (clean.length < 2) {
    throw new Error('GSTIN too short to extract state code');
  }
  return clean.slice(0, 2);
}

export function generateValidGstin(stateCode: string, pan: string, entityNumber: string = '1'): string {
  const normState = stateCode.trim().padStart(2, '0');
  const normPan = pan.trim().toUpperCase();
  const normEntity = entityNumber.trim().toUpperCase();
  const first14 = `${normState}${normPan}${normEntity}Z`;
  const checkChar = calculateGstinChecksum(first14);
  return `${first14}${checkChar}`;
}
