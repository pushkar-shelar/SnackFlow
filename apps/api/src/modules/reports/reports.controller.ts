import { Controller, Get, Query, Res, Param, HttpStatus, Inject } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service.js';
import { ExportService } from './export.service.js';
import { CurrentUser, AuthenticatedUser } from '../../core/decorators/current-user.decorator.js';
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
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getSalesRegister(startDate, endDate, user.companyId);
  }

  @Get('sales-by-customer')
  @RequirePermission(Permission.REPORT_READ)
  async getSalesByCustomer(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getSalesByCustomer(startDate, endDate, user.companyId);
  }

  @Get('sales-by-product')
  @RequirePermission(Permission.REPORT_READ)
  async getSalesByProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getSalesByProduct(startDate, endDate, user.companyId);
  }

  @Get('gst-summary')
  @RequirePermission(Permission.REPORT_READ)
  async getGstSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getGstSummary(startDate, endDate, user.companyId);
  }

  @Get('purchase-register')
  @RequirePermission(Permission.REPORT_READ)
  async getPurchaseRegister(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getPurchaseRegister(startDate, endDate, user.companyId);
  }

  @Get('stock-summary')
  @RequirePermission(Permission.REPORT_READ)
  async getStockSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getStockSummary(startDate, endDate, user.companyId);
  }

  @Get('stock-ledger')
  @RequirePermission(Permission.REPORT_READ)
  async getStockLedger(
    @CurrentUser() user: AuthenticatedUser,
    @Query('itemId') itemId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getStockLedger(itemId, startDate, endDate, user.companyId);
  }

  @Get('production')
  @RequirePermission(Permission.REPORT_READ)
  async getProductionReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getProductionReport(startDate, endDate, user.companyId);
  }

  @Get('costing-comparison')
  @RequirePermission(Permission.REPORT_READ)
  async getCostingComparison(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getCostingComparison(startDate, endDate, user.companyId);
  }

  @Get('collections')
  @RequirePermission(Permission.REPORT_READ)
  async getCollectionsReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getCollectionsReport(startDate, endDate, user.companyId);
  }

  @Get('outstanding-ageing')
  @RequirePermission(Permission.REPORT_READ)
  async getOutstandingAgeing(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.getOutstandingAgeing(user.companyId);
  }

  // T4.4: Tally Prime XML Export
  @Get('tally-xml')
  @RequirePermission(Permission.REPORT_EXPORT)
  async getTallyXml(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Res() res?: Response,
  ) {
    const xml = await this.reportsService.getTallyXml(startDate, endDate, user.companyId);
    if (res) {
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Disposition', 'attachment; filename="tally-vouchers.xml"');
      return res.send(xml);
    }
    return xml;
  }

  // File Exports (CSV, PDF & Excel)
  @Get('export/:reportType')
  @RequirePermission(Permission.REPORT_EXPORT)
  async exportReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportType') reportType: string,
    @Query('format') format: string = 'excel',
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Res() res: Response,
  ) {
    const filename = `${reportType}-${new Date().toISOString().split('T')[0]}`;
    let columns: { header: string; key: string; width?: number }[] = [];
    let rows: Record<string, any>[] = [];

    switch (reportType) {
      case 'sales-register': {
        const data = await this.reportsService.getSalesRegister(startDate, endDate, user.companyId);
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

      case 'sales-by-customer': {
        const data = await this.reportsService.getSalesByCustomer(startDate, endDate, user.companyId);
        columns = [
          { header: 'Customer', key: 'customerName', width: 28 },
          { header: 'GSTIN', key: 'gstin', width: 18 },
          { header: 'Invoices', key: 'invoiceCount', width: 12 },
          { header: 'Taxable (₹)', key: 'taxableTotal', width: 15 },
          { header: 'Grand Total (₹)', key: 'grandTotal', width: 15 },
        ];
        rows = data;
        break;
      }

      case 'sales-by-product': {
        const data = await this.reportsService.getSalesByProduct(startDate, endDate, user.companyId);
        columns = [
          { header: 'Item Code', key: 'itemCode', width: 16 },
          { header: 'Item Name', key: 'itemName', width: 28 },
          { header: 'UoM', key: 'uom', width: 10 },
          { header: 'Total Qty', key: 'totalQty', width: 14 },
          { header: 'Taxable (₹)', key: 'totalTaxable', width: 16 },
          { header: 'GST (₹)', key: 'totalTax', width: 14 },
          { header: 'Grand Total (₹)', key: 'totalGrand', width: 16 },
        ];
        rows = data;
        break;
      }

      case 'gst-summary': {
        const data = await this.reportsService.getGstSummary(startDate, endDate, user.companyId);
        columns = [
          { header: 'HSN Code', key: 'hsnCode', width: 14 },
          { header: 'Description', key: 'description', width: 28 },
          { header: 'UQC', key: 'uqc', width: 10 },
          { header: 'Total Qty', key: 'totalQty', width: 12 },
          { header: 'Taxable (₹)', key: 'taxableValue', width: 15 },
          { header: 'CGST (₹)', key: 'cgstAmount', width: 12 },
          { header: 'SGST (₹)', key: 'sgstAmount', width: 12 },
          { header: 'IGST (₹)', key: 'igstAmount', width: 12 },
          { header: 'Total Tax (₹)', key: 'totalTax', width: 15 },
        ];
        rows = data.gstr1.hsnSummary;
        break;
      }

      case 'purchase-register': {
        const data = await this.reportsService.getPurchaseRegister(startDate, endDate, user.companyId);
        columns = [
          { header: 'Purchase #', key: 'purchaseNumber', width: 18 },
          { header: 'Date', key: 'purchaseDate', width: 12 },
          { header: 'Supplier', key: 'supplierName', width: 25 },
          { header: 'GSTIN', key: 'supplierGstin', width: 18 },
          { header: 'Total (₹)', key: 'grandTotal', width: 15 },
          { header: 'Items', key: 'items', width: 40 },
        ];
        rows = data.rows;
        break;
      }

      case 'stock-summary': {
        const data = await this.reportsService.getStockSummary(startDate, endDate, user.companyId);
        columns = [
          { header: 'Code', key: 'code', width: 15 },
          { header: 'Item Name', key: 'name', width: 30 },
          { header: 'Kind', key: 'kind', width: 14 },
          { header: 'UoM', key: 'uom', width: 8 },
          { header: 'Opening Qty', key: 'openingQty', width: 14 },
          { header: 'Receipts', key: 'receiptsQty', width: 14 },
          { header: 'Issues', key: 'issuesQty', width: 14 },
          { header: 'Closing Qty', key: 'currentQty', width: 15 },
          { header: 'WAC (₹)', key: 'wac', width: 15 },
          { header: 'Valuation (₹)', key: 'currentValue', width: 18 },
        ];
        rows = data.rows;
        break;
      }

      case 'stock-ledger': {
        const data = await this.reportsService.getStockLedger(undefined, startDate, endDate, user.companyId);
        columns = [
          { header: 'Timestamp', key: 'txnAt', width: 22 },
          { header: 'Code', key: 'itemCode', width: 16 },
          { header: 'Item Name', key: 'itemName', width: 26 },
          { header: 'Batch #', key: 'batchNumber', width: 18 },
          { header: 'Type', key: 'movementType', width: 12 },
          { header: 'Qty In', key: 'qtyIn', width: 12 },
          { header: 'Qty Out', key: 'qtyOut', width: 12 },
          { header: 'Unit Cost (₹)', key: 'unitCost', width: 14 },
          { header: 'Value (₹)', key: 'value', width: 14 },
        ];
        rows = data.rows;
        break;
      }

      case 'production': {
        const data = await this.reportsService.getProductionReport(startDate, endDate, user.companyId);
        columns = [
          { header: 'Run #', key: 'runNumber', width: 16 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Batch #', key: 'batchNumber', width: 20 },
          { header: 'Planned Qty', key: 'plannedYield', width: 14 },
          { header: 'Actual Qty', key: 'actualYield', width: 14 },
          { header: 'Yield Variance (%)', key: 'yieldVariancePct', width: 18 },
          { header: 'Wastage', key: 'wastageSummary', width: 28 },
          { header: 'Consumption (Actual/Std)', key: 'consumptionSummary', width: 36 },
          { header: 'Material Cost (₹)', key: 'totalMaterialCost', width: 16 },
          { header: 'Overhead (₹)', key: 'totalOverheadCost', width: 14 },
          { header: 'Unit Cost (₹)', key: 'unitCost', width: 14 },
        ];
        rows = data.rows;
        break;
      }

      case 'costing-comparison': {
        const data = await this.reportsService.getCostingComparison(startDate, endDate, user.companyId);
        columns = [
          { header: 'Run #', key: 'runNumber', width: 16 },
          { header: 'Batch #', key: 'batchNumber', width: 20 },
          { header: 'Actual Yield', key: 'actualYield', width: 14 },
          { header: 'WAC Cost (₹)', key: 'wacUnitCost', width: 14 },
          { header: 'FIFO Cost (₹)', key: 'fifoUnitCost', width: 14 },
          { header: 'Wholesale Price (₹)', key: 'wholesalePrice', width: 18 },
          { header: 'Margin/Unit (₹)', key: 'grossMarginPerUnit', width: 15 },
          { header: 'Margin (%)', key: 'grossMarginPct', width: 12 },
        ];
        rows = data.rows;
        break;
      }

      case 'collections': {
        const data = await this.reportsService.getCollectionsReport(startDate, endDate, user.companyId);
        columns = [
          { header: 'Receipt #', key: 'paymentNumber', width: 18 },
          { header: 'Date', key: 'paymentDate', width: 12 },
          { header: 'Customer', key: 'customerName', width: 25 },
          { header: 'Amount (₹)', key: 'amount', width: 15 },
          { header: 'Mode', key: 'paymentMode', width: 12 },
          { header: 'Reference', key: 'referenceNo', width: 18 },
        ];
        rows = data.rows;
        break;
      }

      case 'outstanding-ageing': {
        const data = await this.reportsService.getOutstandingAgeing(user.companyId);
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
    } else if (format === 'pdf') {
      const pdfHeaders = columns.map((c) => c.header);
      const pdfRows = rows.map((r) => columns.map((c) => r[c.key] ?? ''));
      const pdfBuffer = await this.exportService.generateSimplePdf(reportType, pdfHeaders, pdfRows);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      return res.send(pdfBuffer);
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
