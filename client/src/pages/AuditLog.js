import React, { useState, useEffect } from 'react';
import api from '../utils/api';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    api.get('/audit').then(res => setLogs(res.data)).catch(console.error);
  }, []);

  const filtered = logs.filter(l =>
    l.action?.toLowerCase().includes(filter.toLowerCase()) ||
    l.entity?.toLowerCase().includes(filter.toLowerCase()) ||
    l.details?.toLowerCase().includes(filter.toLowerCase()) ||
    l.performedBy?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <h1>Audit Log</h1>
        <p>Complete history of all system actions</p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          placeholder="Search logs..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ padding: '8px 14px', border: '1px solid #ddd', borderRadius: 8, width: 300, fontSize: 14 }}
        />
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Entity ID</th>
                <th>Details</th>
                <th>Performed By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <tr key={log.logId}>
                  <td>{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</td>
                  <td>
                    <span className={`badge ${
                      log.action === 'CREATE' || log.action === 'IMPORT' ? 'badge-green' :
                      log.action === 'DELETE' ? 'badge-red' :
                      log.action === 'EXPORT' ? 'badge-yellow' :
                      'badge-blue'
                    }`}>{log.action}</span>
                  </td>
                  <td>{log.entity}</td>
                  <td style={{ fontSize: 12 }}>{log.entityId?.substring(0, 12)}</td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.details}</td>
                  <td>{log.performedBy}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="6" style={{ textAlign: 'center', color: '#999', padding: 40 }}>No audit logs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
