import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function ShoeTypes() {
  const { isAdmin } = useAuth();
  const [types, setTypes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ typeName: '', description: '' });
  const [error, setError] = useState('');

  const load = () => {
    api.get('/shoe-types').then(res => setTypes(res.data)).catch(console.error);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/shoe-types', form);
      setShowModal(false);
      setForm({ typeName: '', description: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this shoe type?')) return;
    try {
      await api.delete(`/shoe-types/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Shoe Types</h1>
        <p>Manage shoe categories (e.g. Rubber Studs, Bowling Spikes)</p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => { setForm({ typeName: '', description: '' }); setShowModal(true); }}>
          + Add Shoe Type
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Shoe Type</th>
                <th>Description</th>
                <th>Created</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {types.map(t => (
                <tr key={t.typeId}>
                  <td><strong>{t.typeName}</strong></td>
                  <td>{t.description || '-'}</td>
                  <td>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '-'}</td>
                  {isAdmin && (
                    <td>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(t.typeId)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
              {types.length === 0 && (
                <tr><td colSpan="4" style={{ textAlign: 'center', color: '#999', padding: 40 }}>No shoe types. Add one or upload an Excel file to auto-create.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Shoe Type</h2>
            {error && <div className="alert alert-danger">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Type Name *</label>
                <input value={form.typeName} onChange={e => setForm({ ...form, typeName: e.target.value })}
                  placeholder="e.g. Rubber Studs Shoes" required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows="2" />
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
