import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function AddStock() {
  const { isAdmin } = useAuth();
  const [shoeTypes, setShoeTypes] = useState([]);
  const [models, setModels] = useState([]);
  const [form, setForm] = useState({
    shoeType: '', d9Model: '', size: '', lot: '1st', qty: 1,
    mrpIncGst: '', discountReceived: '', purchaseGstPercent: '5%',
    costPrice: '', purchaseGstAmount: '', totalCostPrice: '', amount: '', remark: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get('/shoe-types').then(res => setShoeTypes(res.data)).catch(console.error);
    api.get('/models').then(res => setModels(res.data)).catch(console.error);
  }, []);

  // Auto-calculate pricing
  useEffect(() => {
    const mrp = Number(form.mrpIncGst) || 0;
    const discStr = String(form.discountReceived).replace('%', '');
    const discount = Number(discStr) || 0;
    const gstStr = String(form.purchaseGstPercent).replace('%', '');
    const gstPercent = Number(gstStr) || 0;

    if (mrp > 0) {
      const discountedPrice = mrp * (1 - discount / 100);
      const basePrice = discountedPrice / (1 + gstPercent / 100);
      const gstAmount = discountedPrice - basePrice;
      const costPrice = basePrice;
      const totalCost = discountedPrice;

      setForm(prev => ({
        ...prev,
        costPrice: Math.round(costPrice * 100) / 100,
        purchaseGstAmount: Math.round(gstAmount * 100) / 100,
        totalCostPrice: Math.round(totalCost * 100) / 100,
        amount: Math.round(totalCost * (Number(prev.qty) || 1) * 100) / 100,
      }));
    }
  }, [form.mrpIncGst, form.discountReceived, form.purchaseGstPercent, form.qty]);

  const filteredModels = form.shoeType
    ? models.filter(m => m.shoeType === form.shoeType)
    : models;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/inventory', form);
      if (res.data?.pending) {
        setSuccess(`Request submitted for admin approval: ${form.d9Model} Size ${form.size} x ${form.qty}. Track it under "My Requests".`);
      } else {
        setSuccess(`Stock added: ${form.d9Model} Size ${form.size} x ${form.qty}`);
      }
      setForm({
        shoeType: form.shoeType, d9Model: '', size: '', lot: '1st', qty: 1,
        mrpIncGst: '', discountReceived: '', purchaseGstPercent: '5%',
        costPrice: '', purchaseGstAmount: '', totalCostPrice: '', amount: '', remark: '',
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add stock');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Add Stock</h1>
        <p>{isAdmin
          ? 'Add new inventory entries'
          : 'Submit a stock request for admin approval — it will appear in inventory once approved.'}</p>
      </div>

      <div className="card">
        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <h3 style={{ marginBottom: 16 }}>Shoe Details</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Shoe Type *</label>
              <input
                list="shoeTypeList"
                value={form.shoeType}
                onChange={e => setForm({ ...form, shoeType: e.target.value })}
                placeholder="e.g. Rubber Studs Shoes"
                required
              />
              <datalist id="shoeTypeList">
                {shoeTypes.map(t => <option key={t.typeId} value={t.typeName} />)}
              </datalist>
            </div>
            <div className="form-group">
              <label>D9 Model *</label>
              <input
                list="modelList"
                value={form.d9Model}
                onChange={e => setForm({ ...form, d9Model: e.target.value })}
                placeholder="e.g. Performer 2"
                required
              />
              <datalist id="modelList">
                {filteredModels.map(m => <option key={m.modelId} value={m.modelName} />)}
              </datalist>
            </div>
            <div className="form-group">
              <label>Size *</label>
              <input
                value={form.size}
                onChange={e => setForm({ ...form, size: e.target.value })}
                placeholder="e.g. UK 4"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Lot</label>
              <select value={form.lot} onChange={e => setForm({ ...form, lot: e.target.value })}>
                <option value="1st">1st</option>
                <option value="2nd">2nd</option>
                <option value="3rd">3rd</option>
                <option value="4th">4th</option>
                <option value="5th">5th</option>
              </select>
            </div>
            <div className="form-group">
              <label>Qty *</label>
              <input type="number" min="1" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} required />
            </div>
          </div>

          <h3 style={{ marginBottom: 16, marginTop: 24 }}>Purchase Pricing</h3>
          <div className="form-row">
            <div className="form-group">
              <label>MRP (Including GST)</label>
              <input type="number" step="0.01" value={form.mrpIncGst} onChange={e => setForm({ ...form, mrpIncGst: e.target.value })} placeholder="e.g. 2207" />
            </div>
            <div className="form-group">
              <label>Discount Received</label>
              <input value={form.discountReceived} onChange={e => setForm({ ...form, discountReceived: e.target.value })} placeholder="e.g. 50%" />
            </div>
            <div className="form-group">
              <label>GST%</label>
              <select value={form.purchaseGstPercent} onChange={e => setForm({ ...form, purchaseGstPercent: e.target.value })}>
                <option value="5%">5%</option>
                <option value="12%">12%</option>
                <option value="18%">18%</option>
                <option value="28%">28%</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Cost Price (auto-calculated)</label>
              <input type="number" step="0.01" value={form.costPrice} onChange={e => setForm({ ...form, costPrice: e.target.value })} />
            </div>
            <div className="form-group">
              <label>GST Amount (auto-calculated)</label>
              <input type="number" step="0.01" value={form.purchaseGstAmount} readOnly style={{ background: '#f5f5f5' }} />
            </div>
            <div className="form-group">
              <label>Total Cost Price (auto-calculated)</label>
              <input type="number" step="0.01" value={form.totalCostPrice} readOnly style={{ background: '#f5f5f5' }} />
            </div>
          </div>

          <div className="form-group">
            <label>Remark</label>
            <input value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} placeholder="Optional notes" />
          </div>

          <button type="submit" className="btn btn-success" style={{ width: '100%', padding: 12, fontSize: 16, marginTop: 8 }}>
            {isAdmin ? 'Add to Inventory' : 'Submit for Approval'}
          </button>
        </form>
      </div>
    </div>
  );
}
