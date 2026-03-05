import ExcelJS from 'exceljs';
import { ActionRow, AuditRow, BarrelBillingRow, BulkBillingRow } from '../types';

export async function generateExcel(
  actions: ActionRow[],
  bulkInventory: BulkBillingRow[],
  auditRows: AuditRow[],
  barrelInventory: BarrelBillingRow[] = []
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'InnoVint Billing Engine';
  workbook.created = new Date();

  // ─── ACTIONS Tab ───
  const actionsSheet = workbook.addWorksheet('ACTIONS');
  actionsSheet.columns = [
    { header: 'Action Type', key: 'actionType', width: 18 },
    { header: 'Action ID', key: 'actionId', width: 20 },
    { header: 'Lot Codes', key: 'lotCodes', width: 30 },
    { header: 'Performer', key: 'performer', width: 18 },
    { header: 'Date', key: 'date', width: 18 },
    { header: 'Owner Code', key: 'ownerCode', width: 12 },
    { header: 'Analysis/Notes', key: 'analysisOrNotes', width: 35 },
    { header: 'Hours', key: 'hours', width: 10 },
    { header: 'Rate', key: 'rate', width: 12 },
    { header: 'Setup Fee', key: 'setupFee', width: 12 },
    { header: 'Total', key: 'total', width: 14 },
  ];

  // Style header row
  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B5797' } },
    alignment: { horizontal: 'center' },
  };

  actionsSheet.getRow(1).eachCell((cell) => {
    cell.style = headerStyle as ExcelJS.Style;
  });

  for (const row of actions) {
    const excelRow = actionsSheet.addRow({
      actionType: row.actionType,
      actionId: row.actionId,
      lotCodes: row.lotCodes,
      performer: row.performer,
      date: row.date,
      ownerCode: row.ownerCode,
      analysisOrNotes: row.analysisOrNotes,
      hours: row.hours || '',
      rate: row.rate,
      setupFee: row.setupFee,
      total: row.total,
    });

    // Color-code: green = matched, yellow = unmatched
    if (row.matched) {
      excelRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE2EFDA' },
        };
      });
    } else if (row.error) {
      excelRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFCE4EC' },
        };
      });
    } else {
      excelRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF9C4' },
        };
      });
    }
  }

  // Format currency columns
  ['rate', 'setupFee', 'total'].forEach((key) => {
    const col = actionsSheet.getColumn(key);
    col.numFmt = '$#,##0.00';
  });

  // ─── Bulk Inventory Tab ───
  const bulkSheet = workbook.addWorksheet('Bulk Inventory');
  bulkSheet.columns = [
    { header: 'Owner Code', key: 'ownerCode', width: 12 },
    { header: 'Lot Code', key: 'lotCode', width: 25 },
    { header: 'Tank Volume', key: 'tankVolume', width: 14 },
    { header: 'Barrel Count', key: 'barrelCount', width: 14 },
    { header: 'Keg Count', key: 'kegCount', width: 12 },
    { header: 'Tank Days', key: 'tankDaysPresent', width: 12 },
    { header: 'Barrel Days', key: 'barrelDaysPresent', width: 12 },
    { header: 'Keg Days', key: 'kegDaysPresent', width: 12 },
    { header: 'Total Days', key: 'totalDays', width: 12 },
    { header: 'Tank %', key: 'tankPct', width: 10 },
    { header: 'Barrel %', key: 'barrelPct', width: 10 },
    { header: 'Keg %', key: 'kegPct', width: 10 },
    { header: 'Tank Rate', key: 'tankRate', width: 12 },
    { header: 'Barrel Rate', key: 'barrelRate', width: 12 },
    { header: 'Keg Rate', key: 'kegRate', width: 12 },
    { header: 'Tank Cost', key: 'tankCost', width: 14 },
    { header: 'Barrel Cost', key: 'barrelCost', width: 14 },
    { header: 'Keg Cost', key: 'kegCost', width: 14 },
    { header: 'Total Cost', key: 'totalCost', width: 14 },
  ];

  bulkSheet.getRow(1).eachCell((cell) => {
    cell.style = headerStyle as ExcelJS.Style;
  });

  for (const row of bulkInventory) {
    bulkSheet.addRow(row);
  }

  ['tankRate', 'barrelRate', 'kegRate', 'tankCost', 'barrelCost', 'kegCost', 'totalCost'].forEach((key) => {
    const col = bulkSheet.getColumn(key);
    col.numFmt = '$#,##0.00';
  });

  ['tankPct', 'barrelPct', 'kegPct'].forEach((key) => {
    const col = bulkSheet.getColumn(key);
    col.numFmt = '0.00"%"';
  });

  // ─── Audit Report Tab ───
  const auditSheet = workbook.addWorksheet('Audit Report');
  auditSheet.columns = [
    { header: 'Action Type', key: 'actionType', width: 18 },
    { header: 'Action ID', key: 'actionId', width: 20 },
    { header: 'Lot Codes', key: 'lotCodes', width: 30 },
    { header: 'Performer', key: 'performer', width: 18 },
    { header: 'Date', key: 'date', width: 18 },
    { header: 'Owner Code', key: 'ownerCode', width: 12 },
    { header: 'Analysis/Notes', key: 'analysisOrNotes', width: 35 },
    { header: 'Reason', key: 'reason', width: 40 },
  ];

  auditSheet.getRow(1).eachCell((cell) => {
    cell.style = headerStyle as ExcelJS.Style;
  });

  for (const row of auditRows) {
    auditSheet.addRow(row);
  }

  // ─── Barrel Inventory Tab ───
  const barrelSheet = workbook.addWorksheet('Barrel Inventory');
  barrelSheet.columns = [
    { header: 'Owner Code', key: 'ownerCode', width: 12 },
    { header: 'Snapshot 1', key: 'snap1', width: 14 },
    { header: 'Snapshot 2', key: 'snap2', width: 14 },
    { header: 'Snapshot 3', key: 'snap3', width: 14 },
    { header: 'Avg Barrels', key: 'avgBarrels', width: 14 },
    { header: 'Rate', key: 'rate', width: 12 },
    { header: 'Charge', key: 'charge', width: 14 },
  ];

  barrelSheet.getRow(1).eachCell((cell) => {
    cell.style = headerStyle as ExcelJS.Style;
  });

  for (const row of barrelInventory) {
    barrelSheet.addRow(row);
  }

  ['rate', 'charge'].forEach((key) => {
    barrelSheet.getColumn(key).numFmt = '$#,##0.00';
  });

  // Write to buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
