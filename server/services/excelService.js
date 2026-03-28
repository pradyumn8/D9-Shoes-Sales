const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'inventory.xlsx');

// Mutex-like lock for file writes
let writeLock = Promise.resolve();

function withLock(fn) {
  const prev = writeLock;
  let release;
  writeLock = new Promise(resolve => { release = resolve; });
  return prev.then(() => fn()).finally(release);
}

// Sheet column definitions matching the real Excel structure
const SHEET_DEFINITIONS = {
  Users: [
    { header: 'UserID', key: 'userId', width: 20 },
    { header: 'Username', key: 'username', width: 20 },
    { header: 'Password', key: 'password', width: 70 },
    { header: 'Role', key: 'role', width: 15 },
    { header: 'FullName', key: 'fullName', width: 25 },
    { header: 'CreatedAt', key: 'createdAt', width: 22 },
  ],
  // Main inventory sheet - matches client's Excel format exactly
  Inventory: [
    { header: 'Sr No', key: 'srNo', width: 8 },
    { header: 'Shoe Type', key: 'shoeType', width: 22 },
    { header: 'D9 Model', key: 'd9Model', width: 20 },
    { header: 'Size', key: 'size', width: 10 },
    { header: 'Lot', key: 'lot', width: 8 },
    { header: 'Qty', key: 'qty', width: 8 },
    { header: 'MRP [Including GST]', key: 'mrpIncGst', width: 22 },
    { header: 'Discount Received', key: 'discountReceived', width: 18 },
    { header: 'GST%', key: 'purchaseGstPercent', width: 8 },
    { header: 'Cost Price', key: 'costPrice', width: 14 },
    { header: 'GST Amount', key: 'purchaseGstAmount', width: 14 },
    { header: 'Total Cost Price', key: 'totalCostPrice', width: 16 },
    { header: 'Amount', key: 'amount', width: 14 },
    { header: 'Billing Amount', key: 'billingAmount', width: 16 },
    { header: 'GST% ', key: 'saleGstPercent', width: 8 },
    { header: 'Sale Price', key: 'salePrice', width: 14 },
    { header: 'GST Amount ', key: 'saleGstAmount', width: 14 },
    { header: 'Total Billing Amount', key: 'totalBillingAmount', width: 20 },
    { header: 'Sold To', key: 'soldTo', width: 20 },
    { header: 'Paid', key: 'paid', width: 12 },
    { header: 'Buyer Name', key: 'buyerName', width: 20 },
    { header: 'Billing Name', key: 'billingName', width: 20 },
    { header: 'Invoicing Done', key: 'invoicingDone', width: 15 },
    { header: 'Payment Status', key: 'paymentStatus', width: 16 },
    { header: 'Remark', key: 'remark', width: 25 },
    // Internal tracking fields
    { header: 'EntryID', key: 'entryId', width: 20 },
    { header: 'EntryDate', key: 'entryDate', width: 22 },
    { header: 'EnteredBy', key: 'enteredBy', width: 15 },
    { header: 'Status', key: 'status', width: 12 },
  ],
  // Track shoe types (categories)
  ShoeTypes: [
    { header: 'TypeID', key: 'typeId', width: 20 },
    { header: 'TypeName', key: 'typeName', width: 25 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'CreatedAt', key: 'createdAt', width: 22 },
  ],
  // Track D9 Models
  Models: [
    { header: 'ModelID', key: 'modelId', width: 20 },
    { header: 'ModelName', key: 'modelName', width: 25 },
    { header: 'ShoeType', key: 'shoeType', width: 25 },
    { header: 'CreatedAt', key: 'createdAt', width: 22 },
  ],
  AuditLog: [
    { header: 'LogID', key: 'logId', width: 20 },
    { header: 'Action', key: 'action', width: 20 },
    { header: 'Entity', key: 'entity', width: 15 },
    { header: 'EntityID', key: 'entityId', width: 20 },
    { header: 'Details', key: 'details', width: 60 },
    { header: 'PerformedBy', key: 'performedBy', width: 20 },
    { header: 'Timestamp', key: 'timestamp', width: 22 },
  ],
};

async function initializeExcel() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) return;

  const workbook = new ExcelJS.Workbook();

  for (const [sheetName, columns] of Object.entries(SHEET_DEFINITIONS)) {
    const sheet = workbook.addWorksheet(sheetName);
    sheet.columns = columns;
    // Style header row - red background with white text like the client's Excel
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFF0000' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: sheetName === 'Inventory' ? 'FFFFFFCC' : 'FF4472C4' },
    };
    if (sheetName !== 'Inventory') {
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    }
  }

  await workbook.xlsx.writeFile(DB_FILE);
}

async function getWorkbook() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(DB_FILE);
  return workbook;
}

async function saveWorkbook(workbook) {
  return withLock(async () => {
    await workbook.xlsx.writeFile(DB_FILE);
  });
}

function sheetToArray(sheet) {
  const rows = [];
  const headers = [];

  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value || '').trim();
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj = {};
    let hasData = false;
    row.eachCell((cell, colNumber) => {
      const key = headers[colNumber];
      if (key) {
        obj[key] = cell.value;
        hasData = true;
      }
    });
    if (hasData) {
      obj._rowNumber = rowNumber;
      rows.push(obj);
    }
  });

  return rows;
}

function mapRowToKeys(sheetName, row) {
  const columns = SHEET_DEFINITIONS[sheetName];
  if (!columns) return row;
  const mapped = {};
  for (const col of columns) {
    if (row[col.header] !== undefined) {
      mapped[col.key] = row[col.header];
    }
  }
  if (row._rowNumber) mapped._rowNumber = row._rowNumber;
  return mapped;
}

function mapArrayToKeys(sheetName, rows) {
  return rows.map(row => mapRowToKeys(sheetName, row));
}

async function readSheet(sheetName) {
  const workbook = await getWorkbook();
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) return [];
  const raw = sheetToArray(sheet);
  return mapArrayToKeys(sheetName, raw);
}

async function appendRow(sheetName, data) {
  const workbook = await getWorkbook();
  const sheet = workbook.getWorksheet(sheetName);
  const columns = SHEET_DEFINITIONS[sheetName];
  const rowValues = columns.map(col => data[col.key] ?? '');
  sheet.addRow(rowValues);
  await saveWorkbook(workbook);
}

async function appendRows(sheetName, dataArray) {
  const workbook = await getWorkbook();
  const sheet = workbook.getWorksheet(sheetName);
  const columns = SHEET_DEFINITIONS[sheetName];
  for (const data of dataArray) {
    const rowValues = columns.map(col => data[col.key] ?? '');
    sheet.addRow(rowValues);
  }
  await saveWorkbook(workbook);
}

async function updateRow(sheetName, matchKey, matchValue, updates) {
  const workbook = await getWorkbook();
  const sheet = workbook.getWorksheet(sheetName);
  const columns = SHEET_DEFINITIONS[sheetName];

  const headerKeyIndex = columns.findIndex(c => c.key === matchKey);
  if (headerKeyIndex === -1) return false;
  const colIndex = headerKeyIndex + 1;

  let found = false;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (String(row.getCell(colIndex).value) === String(matchValue)) {
      for (const [key, value] of Object.entries(updates)) {
        const ci = columns.findIndex(c => c.key === key);
        if (ci !== -1) {
          row.getCell(ci + 1).value = value;
        }
      }
      found = true;
    }
  });

  if (found) await saveWorkbook(workbook);
  return found;
}

async function deleteRow(sheetName, matchKey, matchValue) {
  const workbook = await getWorkbook();
  const sheet = workbook.getWorksheet(sheetName);
  const columns = SHEET_DEFINITIONS[sheetName];

  const headerKeyIndex = columns.findIndex(c => c.key === matchKey);
  if (headerKeyIndex === -1) return false;
  const colIndex = headerKeyIndex + 1;

  let rowToDelete = null;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (String(row.getCell(colIndex).value) === String(matchValue)) {
      rowToDelete = rowNumber;
    }
  });

  if (rowToDelete) {
    sheet.spliceRows(rowToDelete, 1);
    await saveWorkbook(workbook);
    return true;
  }
  return false;
}

// Get next Sr No for inventory
async function getNextSrNo() {
  const rows = await readSheet('Inventory');
  if (rows.length === 0) return 1;
  const maxSr = Math.max(...rows.map(r => Number(r.srNo) || 0));
  return maxSr + 1;
}

// Parse uploaded Excel file and return rows with validation
async function parseUploadedExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { rows: [], errors: [{ row: 0, error: 'No worksheet found in file' }] };

  const headers = [];
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value || '').trim();
  });

  const rows = [];
  const errors = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj = {};
    let hasData = false;

    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        let val = cell.value;
        // Handle rich text
        if (val && typeof val === 'object' && val.richText) {
          val = val.richText.map(r => r.text).join('');
        }
        // Handle currency strings like "₹ 2,207.00"
        if (typeof val === 'string') {
          val = val.replace(/[₹,\s]/g, '').trim();
          if (val && !isNaN(Number(val))) {
            val = Number(val);
          }
        }
        obj[header] = val;
        hasData = true;
      }
    });

    if (hasData) {
      obj._excelRow = rowNumber;
      rows.push(obj);
    }
  });

  return { rows, errors, headers };
}

// Map uploaded Excel headers to our internal keys
function mapUploadedRow(row) {
  const headerMap = {
    'Sr No': 'srNo',
    'Shoe Type': 'shoeType',
    'D9 Model': 'd9Model',
    'Size': 'size',
    'Lot': 'lot',
    'Qty': 'qty',
    'MRP [Including GST]': 'mrpIncGst',
    'Discount Received': 'discountReceived',
    'GST%': 'purchaseGstPercent',
    'Cost Price': 'costPrice',
    'GST Amount': 'purchaseGstAmount',
    'Total Cost Price': 'totalCostPrice',
    'Amount': 'amount',
    'Billing Amount': 'billingAmount',
    'GST% ': 'saleGstPercent',
    'Sale Price': 'salePrice',
    'GST Amount ': 'saleGstAmount',
    'Total Billing Amount': 'totalBillingAmount',
    'Sold To': 'soldTo',
    'Paid': 'paid',
    'Buyer Name': 'buyerName',
    'Billing Name': 'billingName',
    'Invoicing Done': 'invoicingDone',
    'Payment Status': 'paymentStatus',
    'Remark': 'remark',
  };

  const mapped = {};
  for (const [excelHeader, internalKey] of Object.entries(headerMap)) {
    // Try exact match first, then case-insensitive
    if (row[excelHeader] !== undefined) {
      mapped[internalKey] = row[excelHeader];
    } else {
      const found = Object.keys(row).find(k => k.trim().toLowerCase() === excelHeader.trim().toLowerCase());
      if (found) mapped[internalKey] = row[found];
    }
  }
  mapped._excelRow = row._excelRow;
  return mapped;
}

// Validate a mapped inventory row
function validateInventoryRow(row, rowIndex) {
  const errors = [];

  if (!row.shoeType || String(row.shoeType).trim() === '') {
    errors.push({ row: rowIndex, field: 'Shoe Type', error: 'Shoe Type is required' });
  }
  if (!row.d9Model || String(row.d9Model).trim() === '') {
    errors.push({ row: rowIndex, field: 'D9 Model', error: 'D9 Model is required' });
  }
  if (!row.size || String(row.size).trim() === '') {
    errors.push({ row: rowIndex, field: 'Size', error: 'Size is required' });
  }
  if (!row.qty || isNaN(Number(row.qty)) || Number(row.qty) <= 0) {
    errors.push({ row: rowIndex, field: 'Qty', error: 'Quantity must be a positive number' });
  }
  if (row.mrpIncGst && isNaN(Number(String(row.mrpIncGst).replace(/[₹,\s%]/g, '')))) {
    errors.push({ row: rowIndex, field: 'MRP', error: 'MRP must be a valid number' });
  }
  if (row.purchaseGstPercent) {
    const gst = String(row.purchaseGstPercent).replace('%', '');
    if (isNaN(Number(gst))) {
      errors.push({ row: rowIndex, field: 'GST%', error: 'GST% must be a valid number' });
    }
  }

  return errors;
}

// Clean numeric values (remove ₹, commas, %)
function cleanNumeric(val) {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/[₹,\s]/g, '').trim();
  return isNaN(Number(cleaned)) ? val : Number(cleaned);
}

function cleanPercent(val) {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace('%', '').trim();
  return isNaN(Number(cleaned)) ? val : Number(cleaned) + '%';
}

module.exports = {
  initializeExcel,
  getWorkbook,
  saveWorkbook,
  readSheet,
  appendRow,
  appendRows,
  updateRow,
  deleteRow,
  sheetToArray,
  mapArrayToKeys,
  getNextSrNo,
  parseUploadedExcel,
  mapUploadedRow,
  validateInventoryRow,
  cleanNumeric,
  cleanPercent,
  DB_FILE,
  SHEET_DEFINITIONS,
};
