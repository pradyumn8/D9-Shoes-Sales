import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Models() {
  const { isAdmin } = useAuth();
  const [models, setModels] = useState([]);
  const [shoeTypes, setShoeTypes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ modelName: '', shoeType: '' });
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(new Set());

  const load = () => {
    api.get('/models').then(res => setModels(res.data)).catch(console.error);
    api.get('/shoe-types').then(res => setShoeTypes(res.data)).catch(console.error);
    setSelected(new Set());
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/models', form);
      setShowModal(false);
      setForm({ modelName: '', shoeType: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this model?')) return;
    try {
      await api.delete(`/models/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  };

  const toggleSelect = (modelId) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === models.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(models.map(m => m.modelId)));
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} selected models?`)) return;
    try {
      const res = await api.post('/models/bulk-delete', { modelIds: [...selected] });
      alert(res.data.message);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Bulk delete failed');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>D9 Models</h1>
        <p>Manage shoe models (e.g. Performer 2, Blaster 2, Commander 1)</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={() => { setForm({ modelName: '', shoeType: shoeTypes[0]?.typeName || '' }); setShowModal(true); }}>
          + Add Model
        </button>
        {isAdmin && selected.size > 0 && (
          <button className="btn btn-danger" onClick={handleBulkDelete}>
            Delete Selected ({selected.size})
          </button>
        )}
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {isAdmin && (
                  <th style={{ width: 40 }}>
                    <input type="checkbox"
                      checked={models.length > 0 && selected.size === models.length}
                      onChange={toggleSelectAll} title="Select all" />
                  </th>
                )}
                <th>Model Name</th>
                <th>Shoe Type</th>
                <th>Created</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {models.map(m => (
                <tr key={m.modelId} style={{ background: selected.has(m.modelId) ? '#e8f0fe' : 'inherit' }}>
                  {isAdmin && (
                    <td>
                      <input type="checkbox" checked={selected.has(m.modelId)} onChange={() => toggleSelect(m.modelId)} />
                    </td>
                  )}
                  <td><strong>{m.modelName}</strong></td>
                  <td><span className="badge badge-blue">{m.shoeType}</span></td>
                  <td>{m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '-'}</td>
                  {isAdmin && (
                    <td>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(m.modelId)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
              {models.length === 0 && (
                <tr><td colSpan={isAdmin ? 5 : 3} style={{ textAlign: 'center', color: '#999', padding: 40 }}>No models. Add one or upload an Excel file to auto-create.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add D9 Model</h2>
            {error && <div className="alert alert-danger">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Model Name *</label>
                <input value={form.modelName} onChange={e => setForm({ ...form, modelName: e.target.value })}
                  placeholder="e.g. Performer 2" required />
              </div>
              <div className="form-group">
                <label>Shoe Type *</label>
                <select value={form.shoeType} onChange={e => setForm({ ...form, shoeType: e.target.value })} required>
                  <option value="">Select Shoe Type</option>
                  {shoeTypes.map(t => <option key={t.typeId} value={t.typeName}>{t.typeName}</option>)}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
