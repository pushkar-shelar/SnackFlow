import { Injectable, Logger } from '@nestjs/common';
import ExcelJS from 'exceljs';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  private neutralizeCsvFormula(raw: string): string {
    if (/^[=+\-@\t\r]/.test(raw)) {
      return `'${raw}`;
    }
    return raw;
  }

  // 1. Generate CSV from data rows and column definitions
  generateCsv(columns: { header: string; key: string }[], rows: Record<string, any>[]): string {
    const headerLine = columns
      .map((c) => `"${this.neutralizeCsvFormula(c.header).replace(/"/g, '""')}"`)
      .join(',');
    const dataLines = rows.map((row) =>
      columns
        .map((c) => {
          const val = row[c.key] ?? '';
          const str = this.neutralizeCsvFormula(String(val)).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(','),
    );
    return [headerLine, ...dataLines].join('\r\n');
  }

  // 2. Generate Styled Excel (.xlsx) using ExcelJS
  async generateExcel(
    sheetName: string,
    columns: { header: string; key: string; width?: number }[],
    rows: Record<string, any>[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SnackFlow Order-to-Audit ERP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width || Math.max(c.header.length + 4, 15),
    }));

    // Header styling
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Slate 800
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 24;

    // Add rows
    for (const rowData of rows) {
      const addedRow = sheet.addRow(rowData);
      addedRow.height = 20;
      addedRow.alignment = { vertical: 'middle' };
    }

    // Auto filter
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };

    const uint8Array = await workbook.xlsx.writeBuffer();
    return Buffer.from(uint8Array);
  }

  // 3. Clean Valid PDF 1.4 Generator
  async generateSimplePdf(title: string, columns: string[], rows: (string | number)[][]): Promise<Buffer> {
    const escapePdfText = (input: string) =>
      input.replace(/[^\x20-\x7E]/g, ' ').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

    const textLines: string[] = [
      `SNACKFLOW ERP - ${title.toUpperCase()}`,
      `Generated: ${new Date().toISOString()}`,
      columns.join(' | '),
      '-'.repeat(80),
      ...rows.slice(0, 45).map((r) => r.map((c) => String(c ?? '')).join(' | ')),
    ];

    const contentOps = [
      'BT',
      '/F1 9 Tf',
      '40 760 Td',
      '14 TL',
      ...textLines.map((line, i) => `${i === 0 ? '' : 'T* '}(${escapePdfText(line)}) Tj`),
      'ET',
    ].join('\n');

    const objects: string[] = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
      `4 0 obj << /Length ${Buffer.byteLength(contentOps, 'ascii')} >> stream\n${contentOps}\nendstream endobj`,
      '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj',
    ];

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];
    for (const obj of objects) {
      offsets.push(Buffer.byteLength(pdf, 'ascii'));
      pdf += `${obj}\n`;
    }
    const xrefStart = Buffer.byteLength(pdf, 'ascii');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
    return Buffer.from(pdf, 'ascii');
  }
}
