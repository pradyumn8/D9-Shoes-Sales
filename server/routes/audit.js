const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readSheet, appendRow } = require('../services/excelService');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

async function logAction(action, entity, entityId, details, performedBy) {
  await appendRow('AuditLog', {
    logId: uuidv4(),
    action,
    entity,
    entityId,
    details,
    performedBy,
    timestamp: new Date().toISOString(),
  });
}

// GET /api/audit
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const logs = await readSheet('AuditLog');
    res.json(logs.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.logAction = logAction;
