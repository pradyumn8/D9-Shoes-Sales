const express = require('express');
const { v4: uuidv4 } = require('uuid');
const {
  readSheet, appendRow, appendRows, updateRow, deleteRow,
  getNextSrNo, cleanNumeric, cleanPercent,
} = require('../services/excelService');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { logAction } = require('./audit');

const router = express.Router();

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

    if (!shoeType || !d9Model || !size || !qty) {
      return res.status(400).json({ error: 'Shoe Type, D9 Model, Size, and Qty are required' });
    }

    const srNo = await getNextSrNo();
    const entryId = uuidv4();

    const entry = {
      srNo,
      shoeType: String(shoeType).trim(),
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
      await appendRow('Models', {
        modelId: uuidv4(), modelName: d9Model, shoeType, createdAt: new Date().toISOString(),
      });
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
      'shoeType', 'd9Model', 'size', 'lot', 'qty', 'mrpIncGst', 'discountReceived',
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

module.exports = router;
