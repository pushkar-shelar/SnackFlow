import { Controller, Get, Query, Res, Param, HttpStatus, Inject } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service.js';
import { ExportService } from './export.service.js';
import { RequirePermission } from '../../core/decorators/require-permission.decorator.js';
import { Permission } from '@snackflow/shared';

@Controller('reports')
export class ReportsController {
  constructor(
    @Inject(ReportsService) private readonly reportsService: ReportsService,
    @Inject(ExportService) private readonly exportService: ExportService,
  ) {}

  @Get('sales-register')
  @RequirePermission(Permission.REPORT_READ)
  async getSalesRegister(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getSalesRegister(startDate, endDate);
  }

  @Get('sales-by-customer')
  @RequirePermission(Permission.REPORT_READ)
  async getSalesByCustomer(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getSalesByCustomer(startDate, endDate);
  }

  @Get('sales-by-product')
  @RequirePermission(Permission.REPORT_READ)
  async getSalesByProduct(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getSalesByProduct(startDate, endDate);
  }

  @Get('gst-summary')
  @RequirePermission(Permission.REPORT_READ)
  async getGstSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getGstSummary(startDate, endDate);
  }

  @Get('purchase-register')
  @RequirePermission(Permission.REPORT_READ)
  async getPurchaseRegister(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getPurchaseRegister(startDate, endDate);
  }

  @Get('stock-summary')
  @RequirePermission(Permission.REPORT_READ)
  async getStockSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getStockSummary(startDate, endDate);
  }

  @Get('stock-ledger')
  @RequirePermission(Permission.REPORT_READ)
  async getStockLedger(
    @Query('itemId') itemId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getStockLedger(itemId, startDate, endDate);
  }

  @Get('production')
  @RequirePermission(Permission.REPORT_READ)
  async getProductionReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getProductionReport(startDate, endDate);
  }

  @Get('costing-comparison')
  @RequirePermission(Permission.REPORT_READ)
  async getCostingComparison(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getCostingComparison(startDate, endDate);
  }

  @Get('collections')
  @RequirePermission(Permission.REPORT_READ)
  async getCollectionsReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getCollectionsReport(startDate, endDate);
  }

  @Get('outstanding-ageing')
  @RequirePermission(Permission.REPORT_READ)
  async getOutstandingAgeing() {
    return this.reportsService.getOutstandingAgeing();
  }

  // File Exports (CSV & Excel)
  @Get('export/:reportType')
  @RequirePermission(Permission.REPORT_EXPORT)
  async exportReport(
    @Param('reportType') reportType: string,
    @Query('format') format: string = 'excel',
    @Res() res: Response,
  ) {
    let filename = `${reportType}-${new Date().toISOString().split('T')[0]}`;
    let columns: { header: string; key: string; width?: number }[] = [];
    let rows: Record<string, any>[] = [];

    switch (reportType) {
      case 'sales-register': {
        const data = await this.reportsService.getSalesRegister();
        columns = [
          { header: 'Invoice #', key: 'invoiceNumber', width: 18 },
          { header: 'Date', key: 'invoiceDate', width: 12 },
          { header: 'Customer', key: 'customerName', width: 25 },
          { header: 'GSTIN', key: 'customerGstin', width: 18 },
          { header: 'Taxable (₹)', key: 'taxableTotal', width: 15 },
          { header: 'CGST (₹)', key: 'cgstTotal', width: 12 },
          { header: 'SGST (₹)', key: 'sgstTotal', width: 12 },
          { header: 'IGST (₹)', key: 'igstTotal', width: 12 },
          { header: 'Total (₹)', key: 'grandTotal', width: 15 },
        ];
        rows = data.rows;
        break;
      }

      case 'stock-summary': {
        const data = await this.reportsService.getStockSummary();
        columns = [
          { header: 'Code', key: 'code', width: 15 },
          { header: 'Item Name', key: 'name', width: 30 },
          { header: 'Kind', key: 'kind', width: 14 },
          { header: 'UoM', key: 'uom', width: 8 },
          { header: 'Closing Qty', key: 'currentQty', width: 15 },
          { header: 'WAC (₹)', key: 'wac', width: 15 },
          { header: 'Valuation (₹)', key: 'currentValue', width: 18 },
        ];
        rows = data.rows;
        break;
      }

      case 'outstanding-ageing': {
        const data = await this.reportsService.getOutstandingAgeing();
        columns = [
          { header: 'Customer', key: 'customerName', width: 25 },
          { header: 'GSTIN', key: 'gstin', width: 18 },
          { header: '0–30 Days (₹)', key: 'bucket0To30', width: 15 },
          { header: '31–60 Days (₹)', key: 'bucket31To60', width: 15 },
          { header: '61–90 Days (₹)', key: 'bucket61To90', width: 15 },
          { header: '90+ Days (₹)', key: 'bucket90Plus', width: 15 },
          { header: 'Total Due (₹)', key: 'totalOutstanding', width: 18 },
        ];
        rows = data.rows;
        break;
      }

      default:
        return res.status(HttpStatus.BAD_REQUEST).json({ error: `Unknown report type: ${reportType}` });
    }

    if (format === 'csv') {
      const csv = this.exportService.generateCsv(columns, rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csv);
    } else {
      const excelBuffer = await this.exportService.generateExcel(reportType, columns, rows);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      return res.send(excelBuffer);
    }
  }
}
