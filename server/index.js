const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeExcel } = require('./services/excelService');

const authRoutes = require('./routes/auth');
const inventoryRoutes = require('./routes/inventory');
const shoeTypesRoutes = require('./routes/shoeTypes');
const modelsRoutes = require('./routes/models');
const uploadRoutes = require('./routes/upload');
const auditRoutes = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize Excel file on startup
initializeExcel().then(() => {
  console.log('Excel database initialized');
}).catch(err => {
  console.error('Failed to initialize Excel:', err);
  process.exit(1);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/shoe-types', shoeTypesRoutes);
app.use('/api/models', modelsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/audit', auditRoutes);

// Serve React in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`D9SHOE server running on port ${PORT}`);
});
