const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const {
  readSheet, appendRow, appendRows, getNextSrNo,
  parseUploadedExcel, mapUploadedRow, validateInventoryRow,
  cleanNumeric, cleanPercent, DB_FILE,
} = require('../services/excelService');
const { authMiddleware } = require('../middleware/auth');
const { logAction } = require('./audit');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    cb(null, `upload-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// POST /api/upload/bulk - Bulk upload inventory from client's Excel format
router.post('/bulk', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { rows, errors: parseErrors, headers } = await parseUploadedExcel(req.file.path);

    if (rows.length === 0) {
      return res.status(400).json({
        error: 'No data rows found in the uploaded file',
        errors: parseErrors,
      });
    }

    // Validate headers - check for required columns
    const requiredHeaders = ['Shoe Type', 'D9 Model', 'Size', 'Qty'];
    const headerLower = headers.filter(Boolean).map(h => h.toLowerCase().trim());
    const missingHeaders = requiredHeaders.filter(rh =>
      !headerLower.some(h => h === rh.toLowerCase())
    );

    if (missingHeaders.length > 0) {
      return res.status(400).json({
        error: `Missing required columns: ${missingHeaders.join(', ')}`,
        foundHeaders: headers.filter(Boolean),
        hint: 'Required columns: Sr No, Shoe Type, D9 Model, Size, Lot, Qty',
      });
    }

    let nextSrNo = await getNextSrNo();
    const results = { success: 0, errors: [], duplicates: 0, total: rows.length };
    const entriesToInsert = [];
    const newShoeTypes = new Set();
    const newModels = new Set();

    // Get existing data for duplicate detection
    const existingInventory = await readSheet('Inventory');
    const existingTypes = await readSheet('ShoeTypes');
    const existingModels = await readSheet('Models');

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const mapped = mapUploadedRow(raw);
      const excelRow = mapped._excelRow || (i + 2);

      // Validate
      const validationErrors = validateInventoryRow(mapped, excelRow);
      if (validationErrors.length > 0) {
        results.errors.push(...validationErrors);
        continue;
      }

      // Check for duplicate (same model + size + lot + qty + MRP)
      const isDuplicate = existingInventory.some(e =>
        e.d9Model === String(mapped.d9Model).trim() &&
        e.size === String(mapped.size).trim() &&
        e.lot === String(mapped.lot || '1st').trim() &&
        Number(e.qty) === Number(mapped.qty) &&
        Number(e.mrpIncGst) === Number(cleanNumeric(mapped.mrpIncGst))
      );

      if (isDuplicate) {
        results.duplicates++;
        results.errors.push({
          row: excelRow,
          field: 'Duplicate',
          error: `Duplicate entry: ${mapped.d9Model} Size ${mapped.size} Lot ${mapped.lot || '1st'} Qty ${mapped.qty}`,
        });
        continue;
      }

      const entryId = uuidv4();
      const entry = {
        srNo: mapped.srNo || nextSrNo++,
        shoeType: String(mapped.shoeType).trim(),
        d9Model: String(mapped.d9Model).trim(),
        size: String(mapped.size).trim(),
        lot: String(mapped.lot || '1st').trim(),
        qty: Number(mapped.qty),
        mrpIncGst: cleanNumeric(mapped.mrpIncGst),
        discountReceived: mapped.discountReceived || '',
        purchaseGstPercent: cleanPercent(mapped.purchaseGstPercent),
        costPrice: cleanNumeric(mapped.costPrice),
        purchaseGstAmount: cleanNumeric(mapped.purchaseGstAmount),
        totalCostPrice: cleanNumeric(mapped.totalCostPrice),
        amount: cleanNumeric(mapped.amount),
        billingAmount: cleanNumeric(mapped.billingAmount),
        saleGstPercent: cleanPercent(mapped.saleGstPercent),
        salePrice: cleanNumeric(mapped.salePrice),
        saleGstAmount: cleanNumeric(mapped.saleGstAmount),
        totalBillingAmount: cleanNumeric(mapped.totalBillingAmount),
        soldTo: mapped.soldTo || '',
        paid: cleanNumeric(mapped.paid),
        buyerName: mapped.buyerName || '',
        billingName: mapped.billingName || '',
        invoicingDone: mapped.invoicingDone || '',
        paymentStatus: mapped.paymentStatus || '',
        remark: mapped.remark || '',
        entryId,
        entryDate: new Date().toISOString(),
        enteredBy: req.user.username,
        status: (mapped.soldTo && String(mapped.soldTo).trim() !== '') ? 'Sold' : 'In Stock',
      };

      entriesToInsert.push(entry);

      // Track new shoe types and models
      const stLower = entry.shoeType.toLowerCase();
      if (!existingTypes.find(t => t.typeName?.toLowerCase() === stLower)) {
        newShoeTypes.add(entry.shoeType);
      }
      const mdLower = entry.d9Model.toLowerCase();
      if (!existingModels.find(m => m.modelName?.toLowerCase() === mdLower)) {
        newModels.add(JSON.stringify({ name: entry.d9Model, type: entry.shoeType }));
      }

      results.success++;
    }

    // Batch insert all entries
    if (entriesToInsert.length > 0) {
      await appendRows('Inventory', entriesToInsert);
    }

    // Auto-create new shoe types
    for (const typeName of newShoeTypes) {
      await appendRow('ShoeTypes', {
        typeId: uuidv4(), typeName, description: 'Auto-created from upload', createdAt: new Date().toISOString(),
      });
    }

    // Auto-create new models
    for (const modelJson of newModels) {
      const { name, type } = JSON.parse(modelJson);
      await appendRow('Models', {
        modelId: uuidv4(), modelName: name, shoeType: type, createdAt: new Date().toISOString(),
      });
    }

    await logAction('BULK_UPLOAD', 'Inventory', '',
      `Uploaded ${req.file.originalname}: ${results.success} entries added, ${results.duplicates} duplicates, ${results.errors.length} errors`,
      req.user.username
    );

    res.json({
      message: `Upload complete: ${results.success} entries imported`,
      ...results,
      newShoeTypes: [...newShoeTypes],
      newModels: [...newModels].map(m => JSON.parse(m).name),
    });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

// POST /api/upload/preview - Preview uploaded Excel data before importing
router.post('/preview', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { rows, headers } = await parseUploadedExcel(req.file.path);

    const previews = rows.slice(0, 20).map((raw, i) => {
      const mapped = mapUploadedRow(raw);
      const errors = validateInventoryRow(mapped, i + 2);
      return { ...mapped, _errors: errors };
    });

    res.json({
      totalRows: rows.length,
      headers: headers.filter(Boolean),
      preview: previews,
      fileName: req.file.originalname,
      filePath: req.file.path,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/upload/download - Download current inventory Excel
router.get('/download', authMiddleware, async (req, res) => {
  res.download(DB_FILE, 'D9SHOE_Inventory.xlsx');
});

// GET /api/upload/template - Download blank template
router.get('/template', authMiddleware, async (req, res) => {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Inventory');

  const templateCols = [
    'Sr No', 'Shoe Type', 'D9 Model', 'Size', 'Lot', 'Qty',
    'MRP [Including GST]', 'Discount Received', 'GST%', 'Cost Price',
    'GST Amount', 'Total Cost Price', 'Amount', 'Billing Amount',
    'GST%', 'Sale Price', 'GST Amount', 'Total Billing Amount',
    'Sold To', 'Paid', 'Buyer Name', 'Billing Name',
    'Invoicing Done', 'Payment Status', 'Remark',
  ];

  sheet.addRow(templateCols);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFF0000' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFCC' } };

  // Set column widths
  templateCols.forEach((_, i) => {
    sheet.getColumn(i + 1).width = 18;
  });

  // Add sample row
  sheet.addRow([1, 'Rubber Studs Shoes', 'Performer 2', 'UK 4', '1st', 1, 2207, '50%', '5%', 1050.95, 52, 1102.95, 1102.95, '', '', '', '', '', '', '', '', '', '', '', '']);

  const tempPath = path.join(__dirname, '..', 'uploads', `template-${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(tempPath);
  res.download(tempPath, 'D9SHOE_Template.xlsx', () => {
    require('fs').unlinkSync(tempPath);
  });
});

module.exports = router;
