import React, { useState, useEffect } from 'react';
import api from '../utils/api';

export default function SellStock() {
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [fifoEntries, setFifoEntries] = useState([]);
  const [availableSizes, setAvailableSizes] = useState([]);
  const [allStock, setAllStock] = useState([]);
  const [form, setForm] = useState({
    quantity: 1, soldTo: '', buyerName: '', salePrice: '',
    saleGstPercent: '5%', destination: '', notes: '',
  });
  const [fifoWarning, setFifoWarning] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get('/inventory/stock').then(res => {
      setAllStock(res.data);
      const modelSet = [...new Set(res.data.map(s => s.d9Model))];
      setModels(modelSet);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedModel) {
      const sizes = [...new Set(allStock.filter(s => s.d9Model === selectedModel).map(s => s.size))];
      setAvailableSizes(sizes);
      setSelectedSize('');
      setFifoEntries([]);
    }
  }, [selectedModel, allStock]);

  useEffect(() => {
    if (selectedModel && selectedSize) {
      api.get(`/inventory/fifo/${encodeURIComponent(selectedModel)}/${encodeURIComponent(selectedSize)}`)
        .then(res => {
          setFifoEntries(res.data);
          // Check FIFO warning
          if (res.data.length > 1) {
            const lots = res.data.map(e => e.lot);
            const uniqueLots = [...new Set(lots)];
            if (uniqueLots.length > 1) {
              setFifoWarning(`Multiple lots available: ${uniqueLots.join(', ')}. FIFO will export from ${uniqueLots[0]} first.`);
            } else {
              setFifoWarning(null);
            }
          } else {
            setFifoWarning(null);
          }
        })
        .catch(console.error);
    }
  }, [selectedModel, selectedSize]);

  const totalAvailable = fifoEntries.reduce((sum, e) => sum + (Number(e.qty) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedModel || !selectedSize) {
      setError('Select a model and size');
      return;
    }

    try {
      const res = await api.post('/inventory/export-stock', {
        d9Model: selectedModel,
        size: selectedSize,
        quantity: Number(form.quantity),
        soldTo: form.soldTo,
        buyerName: form.buyerName,
        salePrice: form.salePrice,
        saleGstPercent: form.saleGstPercent,
        notes: form.notes,
      });
      setSuccess(res.data.message);
      setForm({ quantity: 1, soldTo: '', buyerName: '', salePrice: '', saleGstPercent: '5%', destination: '', notes: '' });

      // Refresh stock
      const stockRes = await api.get('/inventory/stock');
      setAllStock(stockRes.data);
      const fifoRes = await api.get(`/inventory/fifo/${encodeURIComponent(selectedModel)}/${encodeURIComponent(selectedSize)}`);
      setFifoEntries(fifoRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Export failed');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Sell / Export Stock</h1>
        <p>FIFO-based stock export</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Export Stock</h3>
          {error && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>D9 Model *</label>
              <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} required>
                <option value="">Select Model</option>
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Size *</label>
              <select value={selectedSize} onChange={e => setSelectedSize(e.target.value)} required disabled={!selectedModel}>
                <option value="">Select Size</option>
                {availableSizes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {selectedSize && (
              <div className="alert alert-info">
                Available: <strong>{totalAvailable}</strong> units across <strong>{fifoEntries.length}</strong> entries
              </div>
            )}

            {fifoWarning && (
              <div className="fifo-warning">
                <h4>FIFO Notice</h4>
                <p>{fifoWarning}</p>
              </div>
            )}

            <div className="form-group">
              <label>Quantity *</label>
              <input type="number" min="1" max={totalAvailable || 999} value={form.quantity}
                onChange={e => setForm({ ...form, quantity: e.target.value })} required />
            </div>

            <div className="form-group">
              <label>Sold To *</label>
              <input value={form.soldTo} onChange={e => setForm({ ...form, soldTo: e.target.value })}
                placeholder="Shop / Agency name" required />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Buyer Name</label>
                <input value={form.buyerName} onChange={e => setForm({ ...form, buyerName: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Sale Price</label>
                <input type="number" step="0.01" value={form.salePrice}
                  onChange={e => setForm({ ...form, salePrice: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Sale GST%</label>
                <select value={form.saleGstPercent} onChange={e => setForm({ ...form, saleGstPercent: e.target.value })}>
                  <option value="5%">5%</option>
                  <option value="12%">12%</option>
                  <option value="18%">18%</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Notes</label>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>

            <button type="submit" className="btn btn-warning" style={{ width: '100%', padding: 12, fontSize: 16 }}
              disabled={totalAvailable === 0}>
              Export / Sell Stock
            </button>
          </form>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 16 }}>FIFO Queue</h3>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
            Oldest lots are exported first. Items from Lot 1st will be sold before Lot 2nd.
          </p>

          {fifoEntries.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Lot</th>
                    <th>Qty</th>
                    <th>MRP</th>
                    <th>Cost</th>
                    <th>FIFO</th>
                  </tr>
                </thead>
                <tbody>
                  {fifoEntries.map((entry, idx) => (
                    <tr key={entry.entryId}>
                      <td><span className={`badge ${entry.lot === '1st' ? 'badge-green' : entry.lot === '2nd' ? 'badge-yellow' : 'badge-blue'}`}>{entry.lot}</span></td>
                      <td><strong>{entry.qty}</strong></td>
                      <td>{entry.mrpIncGst ? `\u20B9${Number(entry.mrpIncGst).toLocaleString()}` : '-'}</td>
                      <td>{entry.costPrice ? `\u20B9${Number(entry.costPrice).toLocaleString()}` : '-'}</td>
                      <td>
                        {idx === 0
                          ? <span className="badge badge-green">Export First</span>
                          : <span className="badge badge-yellow">Queue #{idx + 1}</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: '#999', textAlign: 'center', padding: 30 }}>
              {selectedModel && selectedSize ? 'No stock available' : 'Select a model and size'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
