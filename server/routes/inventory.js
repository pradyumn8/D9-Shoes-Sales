const express = require('express');
const { v4: uuidv4 } = require('uuid');
const {
  readSheet, appendRow, appendRows, updateRow, deleteRow,
  getNextSrNo, cleanNumeric, cleanPercent,
} = require('../services/excelService');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { logAction } = require('./audit');
const { generateNextCode } = require('./models');

const router = express.Router();

// Find the modelCode for a given model name from the Models sheet (case-insensitive).
function findModelCode(models, modelName) {
  const target = String(modelName || '').trim().toLowerCase();
  const match = models.find(m => String(m.modelName || '').trim().toLowerCase() === target);
  return match ? String(match.modelCode || '').trim() : '';
}

// GET /api/inventory - All inventory entries
router.get('/', authMiddleware, async (req, res) => {
  try {
    const inventory = await readSheet('Inventory');
    res.json(inventory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/dashboard - Dashboard stats
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const inventory = await readSheet('Inventory');

    const totalEntries = inventory.length;
    const totalQty = inventory.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);

    // Unsold items (no soldTo or paymentStatus not complete)
    const unsold = inventory.filter(i => !i.soldTo || String(i.soldTo).trim() === '');
    const sold = inventory.filter(i => i.soldTo && String(i.soldTo).trim() !== '');

    const unsoldQty = unsold.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
    const soldQty = sold.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);

    // Total cost & revenue
    const totalCost = inventory.reduce((sum, i) => sum + (Number(i.totalCostPrice) || 0), 0);
    const totalRevenue = sold.reduce((sum, i) => sum + (Number(i.totalBillingAmount) || 0), 0);

    // Payment status breakdown
    const paymentPending = sold.filter(i => {
      const status = String(i.paymentStatus || '').toLowerCase();
      return status !== 'paid' && status !== 'completed' && status !== 'done';
    });
    const paymentDone = sold.filter(i => {
      const status = String(i.paymentStatus || '').toLowerCase();
      return status === 'paid' || status === 'completed' || status === 'done';
    });

    // Shoe type breakdown
    const typeMap = {};
    inventory.forEach(i => {
      const type = i.shoeType || 'Unknown';
      if (!typeMap[type]) typeMap[type] = { total: 0, sold: 0, unsold: 0 };
      const qty = Number(i.qty) || 0;
      typeMap[type].total += qty;
      if (i.soldTo && String(i.soldTo).trim() !== '') {
        typeMap[type].sold += qty;
      } else {
        typeMap[type].unsold += qty;
      }
    });

    // Lot breakdown
    const lotMap = {};
    inventory.forEach(i => {
      const lot = i.lot || 'Unknown';
      if (!lotMap[lot]) lotMap[lot] = 0;
      lotMap[lot] += Number(i.qty) || 0;
    });

    // Model breakdown
    const modelMap = {};
    inventory.forEach(i => {
      const model = i.d9Model || 'Unknown';
      if (!modelMap[model]) modelMap[model] = { total: 0, unsold: 0 };
      const qty = Number(i.qty) || 0;
      modelMap[model].total += qty;
      if (!i.soldTo || String(i.soldTo).trim() === '') {
        modelMap[model].unsold += qty;
      }
    });

    // Recent entries (last 10)
    const recentEntries = inventory.slice(-10).reverse();

    res.json({
      totalEntries,
      totalQty,
      unsoldQty,
      soldQty,
      totalCost: Math.round(totalCost * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      paymentPendingCount: paymentPending.length,
      paymentDoneCount: paymentDone.length,
      shoeTypes: Object.entries(typeMap).map(([name, data]) => ({ name, ...data })),
      lots: Object.entries(lotMap).map(([lot, qty]) => ({ lot, qty })),
      models: Object.entries(modelMap).map(([name, data]) => ({ name, ...data })),
      recentEntries,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/stock - Current unsold stock summary grouped by model+size
router.get('/stock', authMiddleware, async (req, res) => {
  try {
    const inventory = await readSheet('Inventory');
    const unsold = inventory.filter(i => !i.soldTo || String(i.soldTo).trim() === '');

    // Group by shoeType + d9Model + size
    const stockMap = {};
    unsold.forEach(i => {
      const key = `${i.shoeType}|${i.d9Model}|${i.size}`;
      if (!stockMap[key]) {
        stockMap[key] = {
          shoeType: i.shoeType,
          d9Model: i.d9Model,
          size: i.size,
          totalQty: 0,
          lots: [],
        };
      }
      stockMap[key].totalQty += Number(i.qty) || 0;
      const lot = i.lot || 'Unknown';
      const existing = stockMap[key].lots.find(l => l.lot === lot);
      if (existing) {
        existing.qty += Number(i.qty) || 0;
        existing.entries.push(i);
      } else {
        stockMap[key].lots.push({ lot, qty: Number(i.qty) || 0, entries: [i] });
      }
    });

    // Sort lots by lot order (1st, 2nd, 3rd...)
    const lotOrder = (lot) => {
      const match = String(lot).match(/(\d+)/);
      return match ? parseInt(match[1]) : 999;
    };

    const stock = Object.values(stockMap).map(s => {
      s.lots.sort((a, b) => lotOrder(a.lot) - lotOrder(b.lot));
      return s;
    });

    res.json(stock);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory - Add single entry
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      shoeType, d9Model, size, lot, qty, mrpIncGst, discountReceived,
      purchaseGstPercent, costPrice, purchaseGstAmount, totalCostPrice,
      amount, remark,
    } = req.body;
    let { d9Code } = req.body;

    if (!shoeType || !d9Model || !size || !qty) {
      return res.status(400).json({ error: 'Shoe Type, D9 Model, Size, and Qty are required' });
    }

    // Non-admin users create a pending stock request; admin needs to approve before
    // it lands in the Inventory sheet.
    if (req.user.role !== 'admin') {
      const requestId = uuidv4();
      const request = {
        requestId,
        shoeType: String(shoeType).trim(),
        d9Code: d9Code ? String(d9Code).trim().toUpperCase() : '',
        d9Model: String(d9Model).trim(),
        size: String(size).trim(),
        lot: lot || '1st',
        qty: Number(qty),
        mrpIncGst: cleanNumeric(mrpIncGst),
        discountReceived: discountReceived || '',
        purchaseGstPercent: cleanPercent(purchaseGstPercent),
        costPrice: cleanNumeric(costPrice),
        purchaseGstAmount: cleanNumeric(purchaseGstAmount),
        totalCostPrice: cleanNumeric(totalCostPrice),
        amount: cleanNumeric(amount),
        remark: remark || '',
        requestedBy: req.user.username,
        requestedAt: new Date().toISOString(),
        status: 'Pending',
        reviewedBy: '',
        reviewedAt: '',
        reviewNote: '',
      };
      await appendRow('StockRequests', request);
      await logAction('REQUEST_STOCK', 'StockRequest', requestId,
        `Requested ${qty} x ${d9Model} (${size}) Lot:${lot || '1st'}`,
        req.user.username);
      return res.status(201).json({
        message: 'Stock request submitted for admin approval.',
        pending: true,
        request,
      });
    }

    const srNo = await getNextSrNo();
    const entryId = uuidv4();

    // Resolve d9Code: use provided value, else look up by model name from Models sheet
    const modelsAtStart = await readSheet('Models');
    const trimmedName = String(d9Model).trim();
    if (!d9Code || String(d9Code).trim() === '') {
      d9Code = findModelCode(modelsAtStart, trimmedName);
    } else {
      d9Code = String(d9Code).trim().toUpperCase();
      // Enforce code uniqueness: reject if this code is already used by a different model.
      const owner = modelsAtStart.find(m => String(m.modelCode || '').trim().toUpperCase() === d9Code);
      if (owner && String(owner.modelName || '').trim().toLowerCase() !== trimmedName.toLowerCase()) {
        return res.status(400).json({
          error: `Code "${d9Code}" is already used by model "${owner.modelName}". Codes must be unique.`,
        });
      }
      // If this model already exists with a different code, reject to avoid inconsistency.
      const existingModelByName = modelsAtStart.find(m => String(m.modelName || '').trim().toLowerCase() === trimmedName.toLowerCase());
      const existingCode = existingModelByName ? String(existingModelByName.modelCode || '').trim().toUpperCase() : '';
      if (existingCode && existingCode !== d9Code) {
        return res.status(400).json({
          error: `Model "${trimmedName}" already has code "${existingCode}". Leave D9 Code blank to use it, or update the model first.`,
        });
      }
    }

    const entry = {
      srNo,
      shoeType: String(shoeType).trim(),
      d9Code,
      d9Model: String(d9Model).trim(),
      size: String(size).trim(),
      lot: lot || '1st',
      qty: Number(qty),
      mrpIncGst: cleanNumeric(mrpIncGst),
      discountReceived: discountReceived || '',
      purchaseGstPercent: cleanPercent(purchaseGstPercent),
      costPrice: cleanNumeric(costPrice),
      purchaseGstAmount: cleanNumeric(purchaseGstAmount),
      totalCostPrice: cleanNumeric(totalCostPrice),
      amount: cleanNumeric(amount),
      billingAmount: '',
      saleGstPercent: '',
      salePrice: '',
      saleGstAmount: '',
      totalBillingAmount: '',
      soldTo: '',
      paid: '',
      buyerName: '',
      billingName: '',
      invoicingDone: '',
      paymentStatus: '',
      remark: remark || '',
      entryId,
      entryDate: new Date().toISOString(),
      enteredBy: req.user.username,
      status: 'In Stock',
    };

    await appendRow('Inventory', entry);

    // Auto-add shoe type and model if new
    const types = await readSheet('ShoeTypes');
    if (!types.find(t => t.typeName?.toLowerCase() === shoeType.toLowerCase())) {
      await appendRow('ShoeTypes', {
        typeId: uuidv4(), typeName: shoeType, description: '', createdAt: new Date().toISOString(),
      });
    }
    const models = await readSheet('Models');
    if (!models.find(m => m.modelName?.toLowerCase() === d9Model.toLowerCase())) {
      // Use the entry's d9Code if it was provided; otherwise auto-generate.
      const newModelCode = d9Code && d9Code.trim() !== '' ? d9Code : generateNextCode(models);
      await appendRow('Models', {
        modelId: uuidv4(), modelCode: newModelCode, modelName: d9Model, shoeType, createdAt: new Date().toISOString(),
      });
      // Backfill the inventory row's code if it was blank
      if (!entry.d9Code || entry.d9Code.trim() === '') {
        await updateRow('Inventory', 'entryId', entryId, { d9Code: newModelCode });
        entry.d9Code = newModelCode;
      }
    }

    await logAction('ADD_STOCK', 'Inventory', entryId, `Added ${qty} x ${d9Model} (${size}) Lot:${lot || '1st'}`, req.user.username);
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/inventory/:entryId - Update entry (including sale info)
router.put('/:entryId', authMiddleware, async (req, res) => {
  try {
    const updates = {};
    const allowed = [
      'shoeType', 'd9Code', 'd9Model', 'size', 'lot', 'qty', 'mrpIncGst', 'discountReceived',
      'purchaseGstPercent', 'costPrice', 'purchaseGstAmount', 'totalCostPrice',
      'amount', 'billingAmount', 'saleGstPercent', 'salePrice', 'saleGstAmount',
      'totalBillingAmount', 'soldTo', 'paid', 'buyerName', 'billingName',
      'invoicingDone', 'paymentStatus', 'remark', 'status',
    ];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (['qty', 'mrpIncGst', 'costPrice', 'purchaseGstAmount', 'totalCostPrice',
             'amount', 'billingAmount', 'salePrice', 'saleGstAmount', 'totalBillingAmount', 'paid'].includes(key)) {
          updates[key] = cleanNumeric(req.body[key]);
        } else if (['purchaseGstPercent', 'saleGstPercent'].includes(key)) {
          updates[key] = cleanPercent(req.body[key]);
        } else {
          updates[key] = req.body[key];
        }
      }
    }

    // Auto-set status if sold
    if (updates.soldTo && String(updates.soldTo).trim() !== '') {
      updates.status = 'Sold';
    }

    const found = await updateRow('Inventory', 'entryId', req.params.entryId, updates);
    if (!found) return res.status(404).json({ error: 'Entry not found' });

    await logAction('UPDATE', 'Inventory', req.params.entryId, `Updated: ${JSON.stringify(updates)}`, req.user.username);
    res.json({ message: 'Entry updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/inventory/:entryId/sell - Mark as sold
router.put('/:entryId/sell', authMiddleware, async (req, res) => {
  try {
    const {
      saleGstPercent, salePrice, saleGstAmount, totalBillingAmount, billingAmount,
      soldTo, paid, buyerName, billingName, invoicingDone, paymentStatus,
    } = req.body;

    if (!soldTo) {
      return res.status(400).json({ error: 'Sold To is required' });
    }

    const updates = {
      saleGstPercent: cleanPercent(saleGstPercent) || '',
      salePrice: cleanNumeric(salePrice) || '',
      saleGstAmount: cleanNumeric(saleGstAmount) || '',
      totalBillingAmount: cleanNumeric(totalBillingAmount) || '',
      billingAmount: cleanNumeric(billingAmount) || '',
      soldTo,
      paid: cleanNumeric(paid) || '',
      buyerName: buyerName || '',
      billingName: billingName || '',
      invoicingDone: invoicingDone || '',
      paymentStatus: paymentStatus || 'Pending',
      status: 'Sold',
    };

    const found = await updateRow('Inventory', 'entryId', req.params.entryId, updates);
    if (!found) return res.status(404).json({ error: 'Entry not found' });

    await logAction('SELL', 'Inventory', req.params.entryId, `Sold to ${soldTo}, Amount: ${totalBillingAmount}`, req.user.username);
    res.json({ message: 'Entry marked as sold' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/inventory/:entryId
router.delete('/:entryId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const found = await deleteRow('Inventory', 'entryId', req.params.entryId);
    if (!found) return res.status(404).json({ error: 'Entry not found' });

    await logAction('DELETE', 'Inventory', req.params.entryId, 'Deleted inventory entry', req.user.username);
    res.json({ message: 'Entry deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory/bulk-delete (admin only) - Delete multiple entries
router.post('/bulk-delete', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { entryIds } = req.body;
    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
      return res.status(400).json({ error: 'Provide an array of entryIds to delete' });
    }

    let deleted = 0;
    let failed = 0;
    for (const entryId of entryIds) {
      const found = await deleteRow('Inventory', 'entryId', entryId);
      if (found) deleted++;
      else failed++;
    }

    await logAction('BULK_DELETE', 'Inventory', '', `Bulk deleted ${deleted} entries (${failed} not found)`, req.user.username);
    res.json({ message: `${deleted} entries deleted`, deleted, failed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/fifo/:model/:size - FIFO order for a model+size
router.get('/fifo/:model/:size', authMiddleware, async (req, res) => {
  try {
    const inventory = await readSheet('Inventory');
    const unsold = inventory.filter(i =>
      i.d9Model === req.params.model &&
      i.size === req.params.size &&
      (!i.soldTo || String(i.soldTo).trim() === '')
    );

    // Sort by lot order (1st, 2nd, 3rd...) for FIFO
    const lotOrder = (lot) => {
      const match = String(lot || '').match(/(\d+)/);
      return match ? parseInt(match[1]) : 999;
    };
    unsold.sort((a, b) => lotOrder(a.lot) - lotOrder(b.lot));

    res.json(unsold);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory/export-stock - Export stock with FIFO
router.post('/export-stock', authMiddleware, async (req, res) => {
  try {
    const { d9Model, size, quantity, soldTo, buyerName, salePrice, saleGstPercent, destination, notes } = req.body;

    if (!d9Model || !size || !quantity || !soldTo) {
      return res.status(400).json({ error: 'Model, Size, Quantity, and Sold To are required' });
    }

    const inventory = await readSheet('Inventory');
    const unsold = inventory.filter(i =>
      i.d9Model === d9Model &&
      i.size === size &&
      (!i.soldTo || String(i.soldTo).trim() === '')
    );

    // Sort by lot (FIFO)
    const lotOrder = (lot) => {
      const match = String(lot || '').match(/(\d+)/);
      return match ? parseInt(match[1]) : 999;
    };
    unsold.sort((a, b) => lotOrder(a.lot) - lotOrder(b.lot));

    const totalAvailable = unsold.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
    if (Number(quantity) > totalAvailable) {
      return res.status(400).json({
        error: `Insufficient stock. Available: ${totalAvailable}, Requested: ${quantity}`,
      });
    }

    // FIFO: mark entries as sold from oldest lot first
    let remaining = Number(quantity);
    const soldEntries = [];

    for (const entry of unsold) {
      if (remaining <= 0) break;
      const entryQty = Number(entry.qty) || 0;

      if (entryQty <= remaining) {
        // Sell entire entry
        await updateRow('Inventory', 'entryId', entry.entryId, {
          soldTo,
          buyerName: buyerName || '',
          salePrice: cleanNumeric(salePrice) || '',
          saleGstPercent: cleanPercent(saleGstPercent) || '',
          paymentStatus: 'Pending',
          status: 'Sold',
          remark: notes || entry.remark || '',
        });
        soldEntries.push({ entryId: entry.entryId, lot: entry.lot, qty: entryQty });
        remaining -= entryQty;
      } else {
        // Partial: this entry has more than needed - we sell what we need
        // For now, mark the whole entry but update remark
        await updateRow('Inventory', 'entryId', entry.entryId, {
          soldTo,
          buyerName: buyerName || '',
          salePrice: cleanNumeric(salePrice) || '',
          saleGstPercent: cleanPercent(saleGstPercent) || '',
          paymentStatus: 'Pending',
          status: 'Sold',
          remark: `Sold ${remaining} of ${entryQty}. ${notes || ''}`.trim(),
        });
        soldEntries.push({ entryId: entry.entryId, lot: entry.lot, qty: remaining });
        remaining = 0;
      }
    }

    await logAction('EXPORT', 'Inventory', '', `Exported ${quantity} x ${d9Model} (${size}) to ${soldTo}. Lots: ${soldEntries.map(e => e.lot).join(', ')}`, req.user.username);

    res.json({
      message: `Successfully exported ${quantity} units`,
      soldEntries,
      fifoOrder: unsold.map(e => ({ lot: e.lot, qty: e.qty, entryId: e.entryId })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/recommendations - FIFO lot recommendations
router.get('/recommendations', authMiddleware, async (req, res) => {
  try {
    const inventory = await readSheet('Inventory');
    const unsold = inventory.filter(i => !i.soldTo || String(i.soldTo).trim() === '');

    const lotOrder = (lot) => {
      const match = String(lot || '').match(/(\d+)/);
      return match ? parseInt(match[1]) : 999;
    };

    // Group unsold by model + size
    const groups = {};
    unsold.forEach(i => {
      const key = `${i.d9Model}|${i.size}`;
      if (!groups[key]) {
        groups[key] = { d9Model: i.d9Model, shoeType: i.shoeType, size: i.size, lots: {} };
      }
      const lot = String(i.lot || '1st').trim();
      if (!groups[key].lots[lot]) {
        groups[key].lots[lot] = { lot, qty: 0, entries: [] };
      }
      groups[key].lots[lot].qty += Number(i.qty) || 0;
      groups[key].lots[lot].entries.push({
        entryId: i.entryId, srNo: i.srNo, qty: i.qty,
        mrpIncGst: i.mrpIncGst, costPrice: i.costPrice,
      });
    });

    const recommendations = [];

    for (const [key, group] of Object.entries(groups)) {
      const lotNames = Object.keys(group.lots);
      if (lotNames.length <= 1) continue; // Only one lot, no FIFO issue

      const sortedLots = lotNames.sort((a, b) => lotOrder(a) - lotOrder(b));
      const oldestLot = sortedLots[0];
      const newerLots = sortedLots.slice(1);

      // Recommend selling oldest lot first
      recommendations.push({
        type: 'fifo',
        priority: 'high',
        d9Model: group.d9Model,
        shoeType: group.shoeType,
        size: group.size,
        message: `Sell "${group.d9Model}" (${group.size}) from Lot ${oldestLot} first (${group.lots[oldestLot].qty} units) before moving to ${newerLots.map(l => `Lot ${l}`).join(', ')}`,
        oldestLot: {
          lot: oldestLot,
          qty: group.lots[oldestLot].qty,
          entries: group.lots[oldestLot].entries,
        },
        newerLots: newerLots.map(l => ({
          lot: l,
          qty: group.lots[l].qty,
        })),
      });
    }

    // Also flag items sitting in oldest lots with low qty (sell soon)
    for (const [key, group] of Object.entries(groups)) {
      const sortedLots = Object.keys(group.lots).sort((a, b) => lotOrder(a) - lotOrder(b));
      const oldestLot = sortedLots[0];
      const oldestData = group.lots[oldestLot];

      if (oldestData.qty > 0 && oldestData.qty <= 3 && sortedLots.length === 1) {
        recommendations.push({
          type: 'low_stock',
          priority: 'medium',
          d9Model: group.d9Model,
          shoeType: group.shoeType,
          size: group.size,
          message: `Only ${oldestData.qty} unit(s) left of "${group.d9Model}" (${group.size}) in Lot ${oldestLot}. Consider restocking or selling soon.`,
          lot: oldestLot,
          qty: oldestData.qty,
        });
      }
    }

    // Sort: high priority first
    recommendations.sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (a.priority !== 'high' && b.priority === 'high') return 1;
      return 0;
    });

    res.json(recommendations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Stock Request Approval Workflow ----------

// GET /api/inventory/requests - list stock requests (admin only; users see their own pending)
router.get('/requests', authMiddleware, async (req, res) => {
  try {
    const all = await readSheet('StockRequests');
    const isAdmin = req.user.role === 'admin';
    const list = isAdmin ? all : all.filter(r => r.requestedBy === req.user.username);
    // Sort newest first
    list.sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory/requests/:requestId/approve - admin approves → promote to Inventory
router.post('/requests/:requestId/approve', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reviewNote } = req.body;
    const requests = await readSheet('StockRequests');
    const request = requests.find(r => r.requestId === requestId);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'Pending') {
      return res.status(400).json({ error: `Request is already ${request.status}` });
    }

    // Resolve d9Code the same way admin Add Stock does
    const modelsAtStart = await readSheet('Models');
    const trimmedName = String(request.d9Model || '').trim();
    let d9Code = request.d9Code ? String(request.d9Code).trim().toUpperCase() : '';
    if (!d9Code) {
      d9Code = findModelCode(modelsAtStart, trimmedName);
    } else {
      const owner = modelsAtStart.find(m => String(m.modelCode || '').trim().toUpperCase() === d9Code);
      if (owner && String(owner.modelName || '').trim().toLowerCase() !== trimmedName.toLowerCase()) {
        return res.status(400).json({
          error: `Code "${d9Code}" is already used by model "${owner.modelName}". Edit the request or reject it.`,
        });
      }
      const existingByName = modelsAtStart.find(m => String(m.modelName || '').trim().toLowerCase() === trimmedName.toLowerCase());
      const existingCode = existingByName ? String(existingByName.modelCode || '').trim().toUpperCase() : '';
      if (existingCode && existingCode !== d9Code) {
        return res.status(400).json({
          error: `Model "${trimmedName}" already has code "${existingCode}". Edit the request to match or clear the D9 Code.`,
        });
      }
    }

    const srNo = await getNextSrNo();
    const entryId = uuidv4();
    const entry = {
      srNo,
      shoeType: String(request.shoeType).trim(),
      d9Code,
      d9Model: trimmedName,
      size: String(request.size).trim(),
      lot: request.lot || '1st',
      qty: Number(request.qty),
      mrpIncGst: cleanNumeric(request.mrpIncGst),
      discountReceived: request.discountReceived || '',
      purchaseGstPercent: cleanPercent(request.purchaseGstPercent),
      costPrice: cleanNumeric(request.costPrice),
      purchaseGstAmount: cleanNumeric(request.purchaseGstAmount),
      totalCostPrice: cleanNumeric(request.totalCostPrice),
      amount: cleanNumeric(request.amount),
      billingAmount: '', saleGstPercent: '', salePrice: '', saleGstAmount: '',
      totalBillingAmount: '', soldTo: '', paid: '', buyerName: '', billingName: '',
      invoicingDone: '', paymentStatus: '',
      remark: request.remark || '',
      entryId,
      entryDate: new Date().toISOString(),
      enteredBy: request.requestedBy,
      status: 'In Stock',
    };
    await appendRow('Inventory', entry);

    // Auto-create shoe type and model if missing
    const types = await readSheet('ShoeTypes');
    if (!types.find(t => t.typeName?.toLowerCase() === entry.shoeType.toLowerCase())) {
      await appendRow('ShoeTypes', {
        typeId: uuidv4(), typeName: entry.shoeType, description: '', createdAt: new Date().toISOString(),
      });
    }
    if (!modelsAtStart.find(m => m.modelName?.toLowerCase() === trimmedName.toLowerCase())) {
      const newCode = d9Code && d9Code.trim() !== '' ? d9Code : generateNextCode(modelsAtStart);
      await appendRow('Models', {
        modelId: uuidv4(), modelCode: newCode, modelName: trimmedName,
        shoeType: entry.shoeType, createdAt: new Date().toISOString(),
      });
      if (!entry.d9Code || entry.d9Code === '') {
        await updateRow('Inventory', 'entryId', entryId, { d9Code: newCode });
        entry.d9Code = newCode;
      }
    }

    await updateRow('StockRequests', 'requestId', requestId, {
      status: 'Approved',
      reviewedBy: req.user.username,
      reviewedAt: new Date().toISOString(),
      reviewNote: reviewNote || '',
    });

    await logAction('APPROVE_STOCK', 'StockRequest', requestId,
      `Approved request from ${request.requestedBy}: ${request.qty} x ${request.d9Model} (${request.size})`,
      req.user.username);
    res.json({ message: 'Request approved and added to inventory', entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory/requests/:requestId/reject - admin rejects
router.post('/requests/:requestId/reject', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reviewNote } = req.body;
    const requests = await readSheet('StockRequests');
    const request = requests.find(r => r.requestId === requestId);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'Pending') {
      return res.status(400).json({ error: `Request is already ${request.status}` });
    }
    await updateRow('StockRequests', 'requestId', requestId, {
      status: 'Rejected',
      reviewedBy: req.user.username,
      reviewedAt: new Date().toISOString(),
      reviewNote: reviewNote || '',
    });
    await logAction('REJECT_STOCK', 'StockRequest', requestId,
      `Rejected request from ${request.requestedBy}: ${request.qty} x ${request.d9Model} (${request.size})${reviewNote ? ' — ' + reviewNote : ''}`,
      req.user.username);
    res.json({ message: 'Request rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/inventory/requests/:requestId - user can cancel their own pending request; admin can delete any
router.delete('/requests/:requestId', authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.params;
    const requests = await readSheet('StockRequests');
    const request = requests.find(r => r.requestId === requestId);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && request.requestedBy !== req.user.username) {
      return res.status(403).json({ error: 'You can only cancel your own requests' });
    }
    if (!isAdmin && request.status !== 'Pending') {
      return res.status(400).json({ error: 'Only pending requests can be cancelled' });
    }
    await deleteRow('StockRequests', 'requestId', requestId);
    await logAction('DELETE_STOCK_REQUEST', 'StockRequest', requestId,
      `Deleted request from ${request.requestedBy}`,
      req.user.username);
    res.json({ message: 'Request removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
