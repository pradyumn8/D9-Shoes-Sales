import React, { useState, useEffect } from 'react';
import api from '../utils/api';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'user', fullName: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadUsers = () => {
    api.get('/auth/users').then(res => setUsers(res.data)).catch(console.error);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.post('/auth/register', form);
      setSuccess('User created successfully!');
      setForm({ username: '', password: '', role: 'user', fullName: '' });
      setShowModal(false);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>User Management</h1>
        <p>Manage system users and roles</p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => { setForm({ username: '', password: '', role: 'user', fullName: '' }); setShowModal(true); }}>
          + Add User
        </button>
      </div>

      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Role</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.userId}>
                  <td><strong>{user.username}</strong></td>
                  <td>{user.fullName}</td>
                  <td>
                    <span className={`badge ${user.role === 'admin' ? 'badge-red' : 'badge-blue'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add User</h2>
            {error && <div className="alert alert-danger">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Full Name *</label>
                <input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Username *</label>
                <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />
              </div>
              <div className="form-group">
                <label>Role *</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
