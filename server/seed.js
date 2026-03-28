const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { initializeExcel, appendRow } = require('./services/excelService');

async function seed() {
  const fs = require('fs');
  const path = require('path');
  const dbFile = path.join(__dirname, 'data', 'inventory.xlsx');
  if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);

  await initializeExcel();
  console.log('Excel initialized');

  // Create admin user
  const adminPass = await bcrypt.hash('admin123', 10);
  await appendRow('Users', {
    userId: uuidv4(), username: 'admin', password: adminPass,
    role: 'admin', fullName: 'System Admin', createdAt: new Date().toISOString(),
  });

  // Create regular user
  const userPass = await bcrypt.hash('user123', 10);
  await appendRow('Users', {
    userId: uuidv4(), username: 'user', password: userPass,
    role: 'user', fullName: 'Shop User', createdAt: new Date().toISOString(),
  });

  // Create shoe types
  const types = [
    { typeId: uuidv4(), typeName: 'Rubber Studs Shoes', description: 'Rubber stud cricket shoes', createdAt: new Date().toISOString() },
    { typeId: uuidv4(), typeName: 'Bowling Spikes Shoes', description: 'Bowling spike cricket shoes', createdAt: new Date().toISOString() },
  ];
  for (const t of types) await appendRow('ShoeTypes', t);

  // Create models
  const models = [
    { modelId: uuidv4(), modelName: 'Performer 2', shoeType: 'Rubber Studs Shoes', createdAt: new Date().toISOString() },
    { modelId: uuidv4(), modelName: 'Blaster 2', shoeType: 'Rubber Studs Shoes', createdAt: new Date().toISOString() },
    { modelId: uuidv4(), modelName: 'Blaster 1', shoeType: 'Rubber Studs Shoes', createdAt: new Date().toISOString() },
    { modelId: uuidv4(), modelName: 'Commander 1', shoeType: 'Rubber Studs Shoes', createdAt: new Date().toISOString() },
    { modelId: uuidv4(), modelName: 'Warrior 2', shoeType: 'Bowling Spikes Shoes', createdAt: new Date().toISOString() },
    { modelId: uuidv4(), modelName: 'Performer 1', shoeType: 'Rubber Studs Shoes', createdAt: new Date().toISOString() },
  ];
  for (const m of models) await appendRow('Models', m);

  // Create sample inventory entries matching the Excel format
  const entries = [
    { srNo: 1, shoeType: 'Rubber Studs Shoes', d9Model: 'Performer 2', size: 'UK 4', lot: '1st', qty: 1, mrpIncGst: 2207, discountReceived: '50%', purchaseGstPercent: '5%', costPrice: 1050.95, purchaseGstAmount: 52, totalCostPrice: 1102.95, amount: 1102.95 },
    { srNo: 2, shoeType: 'Rubber Studs Shoes', d9Model: 'Blaster 2', size: 'UK 4', lot: '1st', qty: 1, mrpIncGst: 1967, discountReceived: '50%', purchaseGstPercent: '5%', costPrice: 936.67, purchaseGstAmount: 46.83, totalCostPrice: 983.50, amount: 983.50 },
    { srNo: 3, shoeType: 'Rubber Studs Shoes', d9Model: 'Blaster 2', size: 'UK 9', lot: '1st', qty: 1, mrpIncGst: 1967, discountReceived: '50%', purchaseGstPercent: '5%', costPrice: 936.67, purchaseGstAmount: 46.83, totalCostPrice: 983.50, amount: 983.50 },
    { srNo: 4, shoeType: 'Rubber Studs Shoes', d9Model: 'Commander 1', size: 'UK 10', lot: '1st', qty: 1, mrpIncGst: 4500, discountReceived: '50%', purchaseGstPercent: '18%', costPrice: 1906.78, purchaseGstAmount: 343.22, totalCostPrice: 2250, amount: 2250 },
    { srNo: 5, shoeType: 'Bowling Spikes Shoes', d9Model: 'Warrior 2', size: 'UK 12', lot: '1st', qty: 1, mrpIncGst: 9000, discountReceived: '50%', purchaseGstPercent: '18%', costPrice: 3813.75, purchaseGstAmount: 686.25, totalCostPrice: 4500, amount: 4500 },
    { srNo: 6, shoeType: 'Bowling Spikes Shoes', d9Model: 'Warrior 2', size: 'UK 12', lot: '1st', qty: 1, mrpIncGst: 9000, discountReceived: '50%', purchaseGstPercent: '18%', costPrice: 3813.75, purchaseGstAmount: 686.25, totalCostPrice: 4500, amount: 4500 },
    { srNo: 7, shoeType: 'Rubber Studs Shoes', d9Model: 'Blaster 1', size: 'UK 8', lot: '1st', qty: 1, mrpIncGst: 1967, discountReceived: '50%', purchaseGstPercent: '5%', costPrice: 936.67, purchaseGstAmount: 46.83, totalCostPrice: 983.50, amount: 983.50 },
    { srNo: 8, shoeType: 'Rubber Studs Shoes', d9Model: 'Blaster 1', size: 'UK 8', lot: '1st', qty: 1, mrpIncGst: 1967, discountReceived: '50%', purchaseGstPercent: '5%', costPrice: 936.67, purchaseGstAmount: 46.83, totalCostPrice: 983.50, amount: 983.50 },
    { srNo: 9, shoeType: 'Rubber Studs Shoes', d9Model: 'Performer 1', size: 'UK 4', lot: '2nd', qty: 1, mrpIncGst: 2207, discountReceived: '52%', purchaseGstPercent: '5%', costPrice: 1008.91, purchaseGstAmount: 50.45, totalCostPrice: 1059.36, amount: 1059.36 },
  ];

  for (const entry of entries) {
    await appendRow('Inventory', {
      ...entry,
      billingAmount: '', saleGstPercent: '', salePrice: '', saleGstAmount: '',
      totalBillingAmount: '', soldTo: '', paid: '', buyerName: '', billingName: '',
      invoicingDone: '', paymentStatus: '', remark: '',
      entryId: uuidv4(),
      entryDate: new Date().toISOString(),
      enteredBy: 'admin',
      status: 'In Stock',
    });
  }

  console.log('Seed data created successfully!');
  console.log('Admin login: admin / admin123');
  console.log('User login: user / user123');
  console.log(`${entries.length} inventory entries created`);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
