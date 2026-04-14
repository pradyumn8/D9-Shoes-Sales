import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Recommendations from '../components/Recommendations';

export default function InventoryList() {
  const { isAdmin } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [selected, setSelected] = useState(new Set());

  const load = () => {
    api.get('/inventory').then(res => setInventory(res.data)).catch(console.error);
    setSelected(new Set());
  };

  useEffect(() => { load(); }, []);

  // Aggregate unsold qty per (d9Model + size) for low-stock detection (threshold: <= 3)
  const LOW_STOCK_THRESHOLD = 3;
  const stockByModelSize = inventory.reduce((acc, i) => {
    const isInStock = !i.soldTo || String(i.soldTo).trim() === '';
    if (!isInStock) return acc;
    const key = `${i.d9Model}||${i.size}`;
    acc[key] = (acc[key] || 0) + (Number(i.qty) || 0);
    return acc;
  }, {});

  const filtered = inventory.filter(i => {
    const matchesSearch =
      i.shoeType?.toLowerCase().includes(filter.toLowerCase()) ||
      i.d9Model?.toLowerCase().includes(filter.toLowerCase()) ||
      i.size?.toLowerCase().includes(filter.toLowerCase()) ||
      i.buyerName?.toLowerCase().includes(filter.toLowerCase()) ||
      i.soldTo?.toLowerCase().includes(filter.toLowerCase());

    const isInStock = !i.soldTo || String(i.soldTo).trim() === '';
    const totalInStock = stockByModelSize[`${i.d9Model}||${i.size}`] || 0;
    const isLowStock = isInStock && totalInStock > 0 && totalInStock <= LOW_STOCK_THRESHOLD;

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'instock' && isInStock) ||
      (statusFilter === 'sold' && !isInStock) ||
      (statusFilter === 'lowstock' && isLowStock);

    return matchesSearch && matchesStatus;
  });

  // Selection handlers
  const toggleSelect = (entryId) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(e => e.entryId)));
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selected.size} selected entries? This cannot be undone.`)) return;
    try {
      const res = await api.post('/inventory/bulk-delete', { entryIds: [...selected] });
      alert(res.data.message);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Bulk delete failed');
    }
  };

  const handleEdit = (entry) => {
    setEditing(entry.entryId);
    setEditForm({ ...entry });
  };

  // Recompute cost / GST amount / total cost / amount from MRP, discount, GST%, qty.
  // Mirrors the formula in AddStock.js so editing MRP keeps derived values consistent.
  const updateFormWithRecalc = (changes) => {
    setEditForm(prev => {
      const next = { ...prev, ...changes };
      const mrp = Number(next.mrpIncGst) || 0;
      const discount = Number(String(next.discountReceived || '').replace('%', '')) || 0;
      const gstPercent = Number(String(next.purchaseGstPercent || '').replace('%', '')) || 0;
      const qty = Number(next.qty) || 1;
      if (mrp > 0) {
        const discountedPrice = mrp * (1 - discount / 100);
        const basePrice = discountedPrice / (1 + gstPercent / 100);
        next.costPrice = Math.round(basePrice * 100) / 100;
        next.purchaseGstAmount = Math.round((discountedPrice - basePrice) * 100) / 100;
        next.totalCostPrice = Math.round(discountedPrice * 100) / 100;
        next.amount = Math.round(discountedPrice * qty * 100) / 100;
      }
      return next;
    });
  };

  const handleSave = async () => {
    try {
      await api.put(`/inventory/${editing}`, editForm);
      setEditing(null);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Update failed');
    }
  };

  const handleDelete = async (entryId) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await api.delete(`/inventory/${entryId}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  };

  const downloadExcel = async () => {
    try {
      const res = await api.get('/upload/download', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'D9SHOE_Inventory.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Download failed');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>All Inventory Entries</h1>
        <p>Complete inventory list matching your Excel format</p>
      </div>

      <Recommendations compact />

      <div className="toolbar">
        <input
          placeholder="Search by type, model, size, buyer..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="search-input"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '8px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }}
        >
          <option value="all">All Status</option>
          <option value="instock">In Stock</option>
          <option value="sold">Sold</option>
          <option value="lowstock">{`Low Stock (\u2264 ${LOW_STOCK_THRESHOLD})`}</option>
        </select>
        <span style={{ color: '#666', fontSize: 13 }}>{filtered.length} entries</span>

        {isAdmin && selected.size > 0 && (
          <button className="btn btn-danger" onClick={handleBulkDelete}>
            Delete Selected ({selected.size})
          </button>
        )}

        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-success" onClick={downloadExcel}>Download Excel</button>
        </div>
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        <div className="table-container">
          <table style={{ minWidth: 1600 }}>
            <thead>
              <tr>
                {isAdmin && (
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onChange={toggleSelectAll}
                      title="Select all"
                    />
                  </th>
                )}
                <th>Sr</th>
                <th>Shoe Type</th>
                <th>Code</th>
                <th>D9 Model</th>
                <th>Size</th>
                <th>Lot</th>
                <th>Qty</th>
                <th>MRP (Inc GST)</th>
                <th>Discount</th>
                <th>GST%</th>
                <th>Cost Price</th>
                <th>Total Cost</th>
                <th>Sold To</th>
                <th>Sale Price</th>
                <th>Billing Amt</th>
                <th>Buyer</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(entry => (
                <tr key={entry.entryId || entry.srNo} style={{
                  background: selected.has(entry.entryId) ? '#e8f0fe' :
                    entry.soldTo && String(entry.soldTo).trim() ? '#f0fff0' : 'inherit'
                }}>
                  {isAdmin && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(entry.entryId)}
                        onChange={() => toggleSelect(entry.entryId)}
                      />
                    </td>
                  )}
                  <td>{entry.srNo}</td>
                  <td>{entry.shoeType}</td>
                  <td><code style={{ background: '#f1f3f4', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{entry.d9Code || '-'}</code></td>
                  <td><strong>{entry.d9Model}</strong></td>
                  <td>{entry.size}</td>
                  <td><span className="badge badge-blue">{entry.lot}</span></td>
                  <td>{entry.qty}</td>
                  <td>{entry.mrpIncGst ? `\u20B9${Number(entry.mrpIncGst).toLocaleString()}` : '-'}</td>
                  <td>{entry.discountReceived || '-'}</td>
                  <td>{entry.purchaseGstPercent || '-'}</td>
                  <td>{entry.costPrice ? `\u20B9${Number(entry.costPrice).toLocaleString()}` : '-'}</td>
                  <td>{entry.totalCostPrice ? `\u20B9${Number(entry.totalCostPrice).toLocaleString()}` : '-'}</td>
                  <td>{entry.soldTo || '-'}</td>
                  <td>{entry.salePrice ? `\u20B9${Number(entry.salePrice).toLocaleString()}` : '-'}</td>
                  <td>{entry.totalBillingAmount ? `\u20B9${Number(entry.totalBillingAmount).toLocaleString()}` : '-'}</td>
                  <td>{entry.buyerName || '-'}</td>
                  <td>
                    {entry.paymentStatus ? (
                      <span className={`badge ${
                        ['paid', 'done', 'completed'].includes(String(entry.paymentStatus).toLowerCase())
                          ? 'badge-green' : 'badge-yellow'
                      }`}>{entry.paymentStatus}</span>
                    ) : '-'}
                  </td>
                  <td>
                    <span className={`badge ${entry.status === 'Sold' ? 'badge-yellow' : 'badge-green'}`}>
                      {entry.status || 'In Stock'}
                    </span>
                  </td>
                  <td>
                    <div className="btn-group">
                      <button className="btn btn-sm btn-primary" onClick={() => handleEdit(entry)}>Edit</button>
                      {isAdmin && (
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(entry.entryId)}>Del</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={isAdmin ? 21 : 20} style={{ textAlign: 'center', color: '#999', padding: 40 }}>No entries found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <h2>Edit Entry - Sr {editForm.srNo}</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Shoe Type</label>
                <input value={editForm.shoeType || ''} onChange={e => setEditForm({ ...editForm, shoeType: e.target.value })} />
              </div>
              <div className="form-group">
                <label>D9 Code</label>
                <input value={editForm.d9Code || ''} onChange={e => setEditForm({ ...editForm, d9Code: e.target.value })} placeholder="e.g. D9-001" />
              </div>
              <div className="form-group">
                <label>D9 Model</label>
                <input value={editForm.d9Model || ''} onChange={e => setEditForm({ ...editForm, d9Model: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Size</label>
                <input value={editForm.size || ''} onChange={e => setEditForm({ ...editForm, size: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Lot</label>
                <input value={editForm.lot || ''} onChange={e => setEditForm({ ...editForm, lot: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Qty</label>
                <input type="number" value={editForm.qty || ''} onChange={e => updateFormWithRecalc({ qty: e.target.value })} />
              </div>
              <div className="form-group">
                <label>MRP (Inc GST)</label>
                <input type="number" step="0.01" value={editForm.mrpIncGst || ''} onChange={e => updateFormWithRecalc({ mrpIncGst: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Discount Received</label>
                <input value={editForm.discountReceived || ''} onChange={e => updateFormWithRecalc({ discountReceived: e.target.value })} placeholder="e.g. 50%" />
              </div>
              <div className="form-group">
                <label>GST%</label>
                <select value={editForm.purchaseGstPercent || ''} onChange={e => updateFormWithRecalc({ purchaseGstPercent: e.target.value })}>
                  <option value="">Select</option>
                  <option value="5%">5%</option>
                  <option value="12%">12%</option>
                  <option value="18%">18%</option>
                  <option value="28%">28%</option>
                </select>
              </div>
              <div className="form-group">
                <label>Cost Price <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>(auto)</span></label>
                <input type="number" step="0.01" value={editForm.costPrice || ''} onChange={e => setEditForm({ ...editForm, costPrice: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Sold To</label>
                <input value={editForm.soldTo || ''} onChange={e => setEditForm({ ...editForm, soldTo: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Sale Price</label>
                <input value={editForm.salePrice || ''} onChange={e => setEditForm({ ...editForm, salePrice: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Buyer Name</label>
                <input value={editForm.buyerName || ''} onChange={e => setEditForm({ ...editForm, buyerName: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Payment Status</label>
                <select value={editForm.paymentStatus || ''} onChange={e => setEditForm({ ...editForm, paymentStatus: e.target.value })}>
                  <option value="">Select</option>
                  <option value="Pending">Pending</option>
                  <option value="Partial">Partial</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>
              <div className="form-group">
                <label>Invoicing Done</label>
                <select value={editForm.invoicingDone || ''} onChange={e => setEditForm({ ...editForm, invoicingDone: e.target.value })}>
                  <option value="">Select</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
              <div className="form-group">
                <label>Remark</label>
                <input value={editForm.remark || ''} onChange={e => setEditForm({ ...editForm, remark: e.target.value })} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
