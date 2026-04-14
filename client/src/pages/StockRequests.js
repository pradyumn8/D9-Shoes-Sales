import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function StockRequests() {
  const { isAdmin, user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(null);
  const [statusFilter, setStatusFilter] = useState('Pending');

  const load = () => {
    setLoading(true);
    api.get('/inventory/requests')
      .then(res => setRequests(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (requestId) => {
    if (!window.confirm('Approve this stock request and add it to inventory?')) return;
    setActioning(requestId);
    try {
      await api.post(`/inventory/requests/${requestId}/approve`, {});
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Approval failed');
    }
    setActioning(null);
  };

  const handleReject = async (requestId) => {
    const note = window.prompt('Reason for rejection (optional):');
    if (note === null) return;
    setActioning(requestId);
    try {
      await api.post(`/inventory/requests/${requestId}/reject`, { reviewNote: note });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Rejection failed');
    }
    setActioning(null);
  };

  const handleCancel = async (requestId) => {
    if (!window.confirm('Cancel this pending request?')) return;
    setActioning(requestId);
    try {
      await api.delete(`/inventory/requests/${requestId}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Cancel failed');
    }
    setActioning(null);
  };

  const filtered = statusFilter === 'all'
    ? requests
    : requests.filter(r => (r.status || 'Pending') === statusFilter);

  const pendingCount = requests.filter(r => (r.status || 'Pending') === 'Pending').length;

  const statusBadge = (status) => {
    const s = status || 'Pending';
    const map = {
      Pending: 'badge-yellow',
      Approved: 'badge-green',
      Rejected: 'badge-red',
    };
    return <span className={`badge ${map[s] || 'badge-blue'}`}>{s}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <h1>{isAdmin ? 'Stock Requests' : 'My Stock Requests'}</h1>
        <p>{isAdmin
          ? `Review and approve stock additions submitted by users${pendingCount > 0 ? ` — ${pendingCount} pending` : ''}`
          : 'Requests you submitted for admin approval'}</p>
      </div>

      <div className="toolbar">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '8px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }}
        >
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
          <option value="all">All</option>
        </select>
        <span style={{ color: '#666', fontSize: 13 }}>{filtered.length} request(s)</span>
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        <div className="table-container">
          <table style={{ minWidth: 1200 }}>
            <thead>
              <tr>
                <th>Requested</th>
                <th>By</th>
                <th>Shoe Type</th>
                <th>Code</th>
                <th>Model</th>
                <th>Size</th>
                <th>Lot</th>
                <th>Qty</th>
                <th>MRP</th>
                <th>Status</th>
                <th>Reviewed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={12} style={{ textAlign: 'center', color: '#999', padding: 40 }}>Loading...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={12} style={{ textAlign: 'center', color: '#999', padding: 40 }}>No requests</td></tr>
              )}
              {!loading && filtered.map(r => {
                const status = r.status || 'Pending';
                const canAct = isAdmin && status === 'Pending';
                const canCancel = !isAdmin && status === 'Pending' && r.requestedBy === user?.username;
                return (
                  <tr key={r.requestId}>
                    <td style={{ fontSize: 12, color: '#666' }}>
                      {r.requestedAt ? new Date(r.requestedAt).toLocaleString() : '-'}
                    </td>
                    <td>{r.requestedBy || '-'}</td>
                    <td>{r.shoeType || '-'}</td>
                    <td>
                      {r.d9Code
                        ? <code style={{ background: '#f1f3f4', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{r.d9Code}</code>
                        : <span style={{ color: '#999' }}>auto</span>}
                    </td>
                    <td><strong>{r.d9Model || '-'}</strong></td>
                    <td>{r.size || '-'}</td>
                    <td><span className="badge badge-blue">{r.lot || '1st'}</span></td>
                    <td>{r.qty || '-'}</td>
                    <td>{r.mrpIncGst ? `\u20B9${Number(r.mrpIncGst).toLocaleString()}` : '-'}</td>
                    <td>{statusBadge(status)}</td>
                    <td style={{ fontSize: 12, color: '#666' }}>
                      {r.reviewedBy ? (
                        <>
                          <div>{r.reviewedBy}</div>
                          <div style={{ fontSize: 10 }}>{r.reviewedAt ? new Date(r.reviewedAt).toLocaleString() : ''}</div>
                          {r.reviewNote && <div style={{ fontStyle: 'italic', marginTop: 4 }}>{r.reviewNote}</div>}
                        </>
                      ) : '-'}
                    </td>
                    <td>
                      {canAct && (
                        <div className="btn-group">
                          <button
                            className="btn btn-sm btn-success"
                            disabled={actioning === r.requestId}
                            onClick={() => handleApprove(r.requestId)}
                          >Approve</button>
                          <button
                            className="btn btn-sm btn-danger"
                            disabled={actioning === r.requestId}
                            onClick={() => handleReject(r.requestId)}
                          >Reject</button>
                        </div>
                      )}
                      {canCancel && (
                        <button
                          className="btn btn-sm btn-secondary"
                          disabled={actioning === r.requestId}
                          onClick={() => handleCancel(r.requestId)}
                        >Cancel</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
