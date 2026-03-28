const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const {
  readSheet, appendRow, appendRows, updateRow, getNextSrNo,
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

// POST /api/upload/bulk - Bulk upload inventory from Excel
// mode: "append" (default) = add new entries, skip duplicates
// mode: "update" = update existing entries by Sr No, add new ones
router.post('/bulk', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const mode = req.body.mode || 'append'; // "append" or "update"
    const { rows, errors: parseErrors, headers, headerRowNum } = await parseUploadedExcel(req.file.path);

    if (rows.length === 0) {
      return res.status(400).json({
        error: 'No data rows found in the uploaded file. Make sure the file has column headers like "Shoe Type", "D9 Model", "Size", "Qty".',
        errors: parseErrors,
        detectedHeaders: headers,
        headerRowFound: headerRowNum,
      });
    }

    // Map the first row to check if headers were detected correctly
    const testMapped = mapUploadedRow(rows[0]);
    const hasCriticalFields = testMapped.shoeType || testMapped.d9Model || testMapped.size;
    if (!hasCriticalFields) {
      return res.status(400).json({
        error: 'Could not map Excel columns to expected fields. Please ensure your file has columns like "Shoe Type", "D9 Model", "Size", "Qty".',
        detectedHeaders: headers,
        headerRowFound: headerRowNum,
        sampleMapped: testMapped,
        hint: 'Your Excel may have a title row (like "SALES REGISTER") before the actual headers. The system tried to auto-detect but could not find matching column names.',
      });
    }

    let nextSrNo = await getNextSrNo();
    const results = { success: 0, updated: 0, errors: [], duplicates: 0, total: rows.length, mode };
    const entriesToInsert = [];
    const newShoeTypes = new Set();
    const newModels = new Set();

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

      if (mode === 'update' && mapped.srNo) {
        // UPDATE mode: find existing entry by Sr No and update it
        const existingEntry = existingInventory.find(e => Number(e.srNo) === Number(mapped.srNo));
        if (existingEntry) {
          const updates = {};
          if (mapped.shoeType) updates.shoeType = String(mapped.shoeType).trim();
          if (mapped.d9Model) updates.d9Model = String(mapped.d9Model).trim();
          if (mapped.size) updates.size = String(mapped.size).trim();
          if (mapped.lot) updates.lot = String(mapped.lot).trim();
          if (mapped.qty) updates.qty = Number(mapped.qty);
          if (mapped.mrpIncGst) updates.mrpIncGst = cleanNumeric(mapped.mrpIncGst);
          if (mapped.discountReceived) updates.discountReceived = String(mapped.discountReceived);
          if (mapped.purchaseGstPercent) updates.purchaseGstPercent = cleanPercent(mapped.purchaseGstPercent);
          if (mapped.costPrice) updates.costPrice = cleanNumeric(mapped.costPrice);
          if (mapped.purchaseGstAmount) updates.purchaseGstAmount = cleanNumeric(mapped.purchaseGstAmount);
          if (mapped.totalCostPrice) updates.totalCostPrice = cleanNumeric(mapped.totalCostPrice);
          if (mapped.amount) updates.amount = cleanNumeric(mapped.amount);
          if (mapped.billingAmount) updates.billingAmount = cleanNumeric(mapped.billingAmount);
          if (mapped.saleGstPercent) updates.saleGstPercent = cleanPercent(mapped.saleGstPercent);
          if (mapped.salePrice) updates.salePrice = cleanNumeric(mapped.salePrice);
          if (mapped.saleGstAmount) updates.saleGstAmount = cleanNumeric(mapped.saleGstAmount);
          if (mapped.totalBillingAmount) updates.totalBillingAmount = cleanNumeric(mapped.totalBillingAmount);
          if (mapped.soldTo) updates.soldTo = String(mapped.soldTo);
          if (mapped.paid) updates.paid = cleanNumeric(mapped.paid);
          if (mapped.buyerName) updates.buyerName = String(mapped.buyerName);
          if (mapped.billingName) updates.billingName = String(mapped.billingName);
          if (mapped.invoicingDone) updates.invoicingDone = String(mapped.invoicingDone);
          if (mapped.paymentStatus) updates.paymentStatus = String(mapped.paymentStatus);
          if (mapped.remark) updates.remark = String(mapped.remark);

          if (updates.soldTo && String(updates.soldTo).trim() !== '') {
            updates.status = 'Sold';
          }

          await updateRow('Inventory', 'srNo', Number(mapped.srNo), updates);
          results.updated++;
          continue;
        }
        // If Sr No not found in update mode, treat as new entry
      }

      if (mode === 'append') {
        // Check for duplicate (same model + size + lot + qty + MRP)
        const isDuplicate = existingInventory.some(e =>
          e.d9Model === String(mapped.d9Model).trim() &&
          e.size === String(mapped.size).trim() &&
          String(e.lot).trim() === String(mapped.lot || '1st').trim() &&
          Number(e.qty) === Number(mapped.qty) &&
          cleanNumeric(e.mrpIncGst) === cleanNumeric(mapped.mrpIncGst)
        );

        if (isDuplicate) {
          results.duplicates++;
          results.errors.push({
            row: excelRow,
            field: 'Duplicate',
            error: `Possible duplicate: ${mapped.d9Model} Size ${mapped.size} Lot ${mapped.lot || '1st'} Qty ${mapped.qty}`,
          });
          continue;
        }
      }

      // New entry
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

    // Batch insert all new entries
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
      `Uploaded ${req.file.originalname} (${mode} mode): ${results.success} added, ${results.updated} updated, ${results.duplicates} duplicates, ${results.errors.length} errors`,
      req.user.username
    );

    res.json({
      message: `Upload complete (${mode} mode): ${results.success} entries added` +
        (results.updated > 0 ? `, ${results.updated} entries updated` : ''),
      ...results,
      newShoeTypes: [...newShoeTypes],
      newModels: [...newModels].map(m => JSON.parse(m).name),
      detectedHeaders: headers,
      headerRowFound: headerRowNum,
    });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

// POST /api/upload/preview - Preview uploaded Excel data before importing
router.post('/preview', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { rows, headers, headerRowNum } = await parseUploadedExcel(req.file.path);

    const previews = rows.slice(0, 20).map((raw, i) => {
      const mapped = mapUploadedRow(raw);
      const errors = validateInventoryRow(mapped, mapped._excelRow || (i + 2));
      return { ...mapped, _errors: errors };
    });

    res.json({
      totalRows: rows.length,
      headers,
      headerRowFound: headerRowNum,
      preview: previews,
      fileName: req.file.originalname,
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
  templateCols.forEach((_, i) => { sheet.getColumn(i + 1).width = 18; });

  // Add sample row
  sheet.addRow([1, 'Rubber Studs Shoes', 'Performer 2', 'UK 4', '1st', 1, 2207, '50%', '5%', 1050.95, 52, 1102.95, 1102.95, '', '', '', '', '', '', '', '', '', '', '', '']);

  const tempPath = path.join(__dirname, '..', 'uploads', `template-${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(tempPath);
  res.download(tempPath, 'D9SHOE_Template.xlsx', () => {
    require('fs').unlinkSync(tempPath);
  });
});

module.exports = router;
