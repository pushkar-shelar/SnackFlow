export function getFinancialYear(date: Date = new Date()): string {
  const month = date.getMonth(); // 0-indexed: 0 = Jan, 2 = Mar, 3 = Apr
  const fullYear = date.getFullYear(); // e.g. 2026

  let startYear: number;
  let endYear: number;

  if (month >= 3) {
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
