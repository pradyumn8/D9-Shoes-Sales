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

// Known column headers to identify the real header row
const KNOWN_HEADERS = [
  'sr no', 'shoe type', 'd9 model', 'size', 'lot', 'qty', 'quantity',
  'mrp', 'mrp [including gst]', 'discount received', 'discount',
  'gst%', 'gst', 'cost price', 'gst amount', 'total cost price',
  'amount', 'billing amount', 'sale price', 'total billing amount',
  'sold to', 'paid', 'buyer name', 'billing name', 'invoicing done',
  'payment status', 'remark', 'remarks',
];

// Find the actual header row (skips title rows, merged cells like "SALES REGISTER")
function findHeaderRow(sheet) {
  let headerRowNumber = -1;
  let bestScore = 0;

  sheet.eachRow((row, rowNumber) => {
    const cells = [];
    row.eachCell((cell) => {
      let val = cell.value;
      if (val && typeof val === 'object' && val.richText) {
        val = val.richText.map(r => r.text).join('');
      }
      if (val) cells.push(String(val).trim().toLowerCase());
    });

    // Score: how many cells match known header names
    let score = 0;
    for (const cellVal of cells) {
      if (KNOWN_HEADERS.some(h => cellVal.includes(h) || h.includes(cellVal))) {
        score++;
      }
    }

    // Need at least 3 matching headers and must have distinct values (not all same like "SALES REGISTER")
    const uniqueCells = new Set(cells);
    if (score > bestScore && score >= 3 && uniqueCells.size >= 3) {
      bestScore = score;
      headerRowNumber = rowNumber;
    }
  });

  return headerRowNumber;
}

// Parse uploaded Excel file and return rows with validation
async function parseUploadedExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // Try all worksheets to find data
  let sheet = null;
  let headerRowNum = -1;

  for (const ws of workbook.worksheets) {
    const found = findHeaderRow(ws);
    if (found > 0) {
      sheet = ws;
      headerRowNum = found;
      break;
    }
  }

  if (!sheet || headerRowNum === -1) {
    // Fallback: try first worksheet, row 1
    sheet = workbook.worksheets[0];
    if (!sheet) return { rows: [], errors: [{ row: 0, error: 'No worksheet found in file' }], headers: [] };
    headerRowNum = 1;
  }

  // Extract headers from the detected header row
  const headers = [];
  sheet.getRow(headerRowNum).eachCell((cell, colNumber) => {
    let val = cell.value;
    if (val && typeof val === 'object' && val.richText) {
      val = val.richText.map(r => r.text).join('');
    }
    headers[colNumber] = String(val || '').trim();
  });

  const rows = [];
  const errors = [];

  sheet.eachRow((row, rowNumber) => {
    // Skip all rows up to and including header row
    if (rowNumber <= headerRowNum) return;

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
        // Handle formula results
        if (val && typeof val === 'object' && val.result !== undefined) {
          val = val.result;
        }
        // Handle currency strings like "₹ 2,207.00"
        if (typeof val === 'string') {
          const cleaned = val.replace(/[₹,]/g, '').trim();
          if (cleaned && !isNaN(Number(cleaned)) && cleaned !== '') {
            val = Number(cleaned);
          } else {
            val = val.trim();
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

  return { rows, errors, headers: headers.filter(Boolean), headerRowNum };
}

// Flexible header matching rules: each internal key maps to multiple possible header names
const HEADER_ALIASES = {
  srNo: ['sr no', 'sr.no', 'sr. no', 'sno', 's.no', 'serial', 'serial no', '#'],
  shoeType: ['shoe type', 'shoetype', 'type', 'category', 'shoe category'],
  d9Model: ['d9 model', 'd9model', 'model', 'model name', 'product', 'product name'],
  size: ['size', 'shoe size'],
  lot: ['lot', 'lot no', 'batch', 'lot number'],
  qty: ['qty', 'quantity', 'units', 'pcs', 'nos'],
  mrpIncGst: ['mrp [including gst]', 'mrp (including gst)', 'mrp including gst', 'mrp [inc gst]', 'mrp', 'mrp inc gst', 'mrp (inc gst)'],
  discountReceived: ['discount received', 'discount', 'disc', 'disc%', 'discount%', 'disc received'],
  purchaseGstPercent: ['gst%', 'gst %', 'gst percent', 'purchase gst%', 'purchase gst'],
  costPrice: ['cost price', 'cost', 'purchase price', 'buy price', 'cp'],
  purchaseGstAmount: ['gst amount', 'gst amt', 'purchase gst amount', 'purchase gst amt'],
  totalCostPrice: ['total cost price', 'total cost', 'total cp', 'net cost'],
  amount: ['amount', 'total amount', 'net amount'],
  billingAmount: ['billing amount', 'bill amount', 'bill amt'],
  saleGstPercent: ['sale gst%', 'selling gst%', 'sale gst', 'sell gst%'],
  salePrice: ['sale price', 'selling price', 'sp', 'sell price'],
  saleGstAmount: ['sale gst amount', 'sale gst amt', 'selling gst amount'],
  totalBillingAmount: ['total billing amount', 'total billing', 'total bill amount', 'total sale', 'total selling amount'],
  soldTo: ['sold to', 'soldto', 'customer', 'sold'],
  paid: ['paid', 'paid amount', 'payment received', 'received'],
  buyerName: ['buyer name', 'buyername', 'buyer'],
  billingName: ['billing name', 'billingname', 'bill name', 'bill to'],
  invoicingDone: ['invoicing done', 'invoice done', 'invoiced', 'invoice'],
  paymentStatus: ['payment status', 'pay status', 'status', 'payment'],
  remark: ['remark', 'remarks', 'note', 'notes', 'comment', 'comments'],
};

// Map uploaded Excel headers to our internal keys using fuzzy matching
function mapUploadedRow(row) {
  const mapped = {};
  const rowKeys = Object.keys(row).filter(k => !k.startsWith('_'));

  for (const [internalKey, aliases] of Object.entries(HEADER_ALIASES)) {
    // Try each alias against each row key
    for (const alias of aliases) {
      // Exact match
      const exactMatch = rowKeys.find(k => k === alias);
      if (exactMatch) {
        mapped[internalKey] = row[exactMatch];
        break;
      }
      // Case-insensitive match
      const caseMatch = rowKeys.find(k => k.toLowerCase().trim() === alias.toLowerCase());
      if (caseMatch) {
        mapped[internalKey] = row[caseMatch];
        break;
      }
      // Contains match (for headers like "GST%" appearing as first or second)
      const containsMatch = rowKeys.find(k => k.toLowerCase().trim().includes(alias.toLowerCase()));
      if (containsMatch && !mapped[internalKey]) {
        mapped[internalKey] = row[containsMatch];
      }
    }
  }

  // Handle duplicate GST% columns (purchase vs sale) by position
  // The first "GST%" is purchase, if there's a second one after "Billing Amount" it's sale
  const gstKeys = rowKeys.filter(k => k.toLowerCase().trim() === 'gst%' || k.toLowerCase().trim() === 'gst% ');
  if (gstKeys.length >= 2) {
    mapped.purchaseGstPercent = row[gstKeys[0]];
    mapped.saleGstPercent = row[gstKeys[1]];
  }

  // Same for duplicate "GST Amount" columns
  const gstAmtKeys = rowKeys.filter(k => k.toLowerCase().trim().startsWith('gst amount'));
  if (gstAmtKeys.length >= 2) {
    mapped.purchaseGstAmount = row[gstAmtKeys[0]];
    mapped.saleGstAmount = row[gstAmtKeys[1]];
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
