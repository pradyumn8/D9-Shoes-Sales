const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readSheet, appendRow, updateRow, deleteRow } = require('../services/excelService');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { logAction } = require('./audit');

const router = express.Router();

// GET /api/shoe-types
router.get('/', authMiddleware, async (req, res) => {
  try {
    const types = await readSheet('ShoeTypes');
    res.json(types);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shoe-types
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { typeName, description } = req.body;
    if (!typeName) {
      return res.status(400).json({ error: 'Shoe Type name is required' });
    }

    const types = await readSheet('ShoeTypes');
    if (types.find(t => t.typeName?.toLowerCase() === typeName.toLowerCase())) {
      return res.status(400).json({ error: 'Shoe Type already exists' });
    }

    const type = {
      typeId: uuidv4(),
      typeName,
      description: description || '',
      createdAt: new Date().toISOString(),
    };

    await appendRow('ShoeTypes', type);
    await logAction('CREATE', 'ShoeType', type.typeId, `Created shoe type: ${typeName}`, req.user.username);
    res.status(201).json(type);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/shoe-types/:id
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { typeName, description } = req.body;
    const updates = {};
    if (typeName) updates.typeName = typeName;
    if (description !== undefined) updates.description = description;

    const found = await updateRow('ShoeTypes', 'typeId', req.params.id, updates);
    if (!found) return res.status(404).json({ error: 'Shoe Type not found' });

    await logAction('UPDATE', 'ShoeType', req.params.id, `Updated shoe type: ${JSON.stringify(updates)}`, req.user.username);
    res.json({ message: 'Shoe Type updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/shoe-types/:id
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const types = await readSheet('ShoeTypes');
    const type = types.find(t => t.typeId === req.params.id);
    if (!type) return res.status(404).json({ error: 'Shoe Type not found' });

    // Check if any inventory entries use this type
    const inventory = await readSheet('Inventory');
    if (inventory.some(i => i.shoeType === type.typeName)) {
      return res.status(400).json({ error: 'Cannot delete: shoe type is used in inventory entries' });
    }

    await deleteRow('ShoeTypes', 'typeId', req.params.id);
    await logAction('DELETE', 'ShoeType', req.params.id, `Deleted shoe type: ${type.typeName}`, req.user.username);
    res.json({ message: 'Shoe Type deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
