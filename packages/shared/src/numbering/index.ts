export function getFinancialYear(date: Date = new Date(), timeZone: string = 'Asia/Kolkata'): string {
  // Convert date to specified timezone (defaulting to Asia/Kolkata)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = formatter.formatToParts(date);
  const monthPart = parts.find((p) => p.type === 'month')?.value;
  const yearPart = parts.find((p) => p.type === 'year')?.value;

  const month = parseInt(monthPart || '1', 10); // 1-indexed: 1 = Jan, 3 = Mar, 4 = Apr
  const fullYear = parseInt(yearPart || '2026', 10);

  let startYear: number;
  let endYear: number;

  if (month >= 4) {
    // April to December
    startYear = fullYear;
    endYear = fullYear + 1;
  } else {
    // January to March
    startYear = fullYear - 1;
    endYear = fullYear;
  }

  const startYY = String(startYear).slice(-2);
  const endYY = String(endYear).slice(-2);
  return `${startYY}${endYY}`;
}

export function formatInvoiceNumber(sequenceNo: number, fy: string, prefix: string = 'INV'): string {
  const paddedSeq = String(sequenceNo).padStart(5, '0');
  const invoiceNo = `${prefix}/${fy}/${paddedSeq}`;
  if (invoiceNo.length > 16) {
    throw new Error(`Invoice number '${invoiceNo}' exceeds maximum length of 16 characters`);
  }
  return invoiceNo;
}

export function parseInvoiceNumber(invoiceNo: string): { prefix: string; fy: string; sequenceNo: number } {
  const parts = invoiceNo.split('/');
  if (parts.length !== 3) {
    throw new Error(`Invalid invoice number format '${invoiceNo}'. Expected PREFIX/FY/SEQUENCE`);
  }
  const prefix = parts[0]!;
  const fy = parts[1]!;
  const sequenceNo = parseInt(parts[2]!, 10);
  if (isNaN(sequenceNo)) {
    throw new Error(`Invalid sequence number in invoice '${invoiceNo}'`);
  }
  return { prefix, fy, sequenceNo };
}
