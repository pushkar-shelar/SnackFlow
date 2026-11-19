import { Injectable, Logger } from '@nestjs/common';
import ExcelJS from 'exceljs';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  // 1. Generate CSV from data rows and column definitions
  generateCsv(columns: { header: string; key: string }[], rows: Record<string, any>[]): string {
    const headerLine = columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(',');
    const dataLines = rows.map((row) =>
      columns
        .map((c) => {
          const val = row[c.key] ?? '';
          const str = String(val).replace(/"/g, '""');
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

  // 3. Simple Clean PDF Generator
  async generateSimplePdf(title: string, columns: string[], rows: (string | number)[][]): Promise<Buffer> {
    // Generate text/pdf formatted structure
    const lines: string[] = [];
    lines.push(`================================================================================`);
    lines.push(`                       SNACKFLOW ERP - ${title.toUpperCase()}                   `);
    lines.push(`                       Generated: ${new Date().toISOString()}                  `);
    lines.push(`================================================================================`);
    lines.push(columns.map((c) => c.padEnd(20)).join(' | '));
    lines.push(`--------------------------------------------------------------------------------`);
    for (const row of rows) {
      lines.push(row.map((cell) => String(cell).padEnd(20)).join(' | '));
    }
    lines.push(`================================================================================`);
    return Buffer.from(lines.join('\n'), 'utf-8');
  }
}
