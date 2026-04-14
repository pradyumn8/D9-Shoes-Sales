const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readSheet, appendRow, updateRow, deleteRow } = require('../services/excelService');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { logAction } = require('./audit');

const router = express.Router();

// Generate next D9-NNN code based on existing models. Skips any non-conforming codes.
function generateNextCode(existingModels) {
  let maxNum = 0;
  for (const m of existingModels) {
    const code = String(m.modelCode || '').trim().toUpperCase();
    const match = code.match(/^D9-(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `D9-${String(maxNum + 1).padStart(3, '0')}`;
}

// GET /api/models
router.get('/', authMiddleware, async (req, res) => {
  try {
    const models = await readSheet('Models');
    res.json(models);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/models
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { modelName, shoeType } = req.body;
    let { modelCode } = req.body;
    if (!modelName || !shoeType) {
      return res.status(400).json({ error: 'Model name and shoe type are required' });
    }

    const models = await readSheet('Models');
    if (models.find(m => m.modelName?.toLowerCase() === modelName.toLowerCase())) {
      return res.status(400).json({ error: 'Model already exists' });
    }

    // Auto-generate code if not provided; otherwise normalize and validate uniqueness
    if (!modelCode || String(modelCode).trim() === '') {
      modelCode = generateNextCode(models);
    } else {
      modelCode = String(modelCode).trim().toUpperCase();
      if (models.find(m => String(m.modelCode || '').toUpperCase() === modelCode)) {
        return res.status(400).json({ error: `Model code "${modelCode}" is already in use` });
      }
    }

    const model = {
      modelId: uuidv4(),
      modelCode,
      modelName,
      shoeType,
      createdAt: new Date().toISOString(),
    };

    await appendRow('Models', model);
    await logAction('CREATE', 'Model', model.modelId, `Created model: ${modelCode} - ${modelName} (${shoeType})`, req.user.username);
    res.status(201).json(model);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/models/:id
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const models = await readSheet('Models');
    const model = models.find(m => m.modelId === req.params.id);
    if (!model) return res.status(404).json({ error: 'Model not found' });

    const inventory = await readSheet('Inventory');
    if (inventory.some(i => i.d9Model === model.modelName)) {
      return res.status(400).json({ error: 'Cannot delete: model is used in inventory entries' });
    }

    await deleteRow('Models', 'modelId', req.params.id);
    await logAction('DELETE', 'Model', req.params.id, `Deleted model: ${model.modelName}`, req.user.username);
    res.json({ message: 'Model deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/models/bulk-delete (admin only)
router.post('/bulk-delete', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { modelIds } = req.body;
    if (!modelIds || !Array.isArray(modelIds) || modelIds.length === 0) {
      return res.status(400).json({ error: 'Provide an array of modelIds to delete' });
    }

    const models = await readSheet('Models');
    const inventory = await readSheet('Inventory');

    let deleted = 0;
    let skipped = 0;
    const skippedNames = [];

    for (const modelId of modelIds) {
      const model = models.find(m => m.modelId === modelId);
      if (!model) continue;

      if (inventory.some(i => i.d9Model === model.modelName)) {
        skipped++;
        skippedNames.push(model.modelName);
        continue;
      }

      await deleteRow('Models', 'modelId', modelId);
      deleted++;
    }

    await logAction('BULK_DELETE', 'Models', '', `Bulk deleted ${deleted} models, ${skipped} skipped (in use)`, req.user.username);
    res.json({
      message: `${deleted} models deleted` + (skipped > 0 ? `, ${skipped} skipped (used in inventory)` : ''),
      deleted, skipped, skippedNames,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.generateNextCode = generateNextCode;
