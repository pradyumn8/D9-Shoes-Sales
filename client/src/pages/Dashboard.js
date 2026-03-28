import React, { useState, useEffect } from 'react';
import api from '../utils/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/inventory/dashboard')
      .then(res => setStats(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40 }}>Loading dashboard...</div>;
  if (!stats) return <div className="alert alert-danger">Failed to load dashboard</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>D9SHOE Inventory Overview</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-label">Total Entries</div>
          <div className="stat-value">{stats.totalEntries}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">In Stock (Qty)</div>
          <div className="stat-value">{stats.unsoldQty}</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-label">Sold (Qty)</div>
          <div className="stat-value">{stats.soldQty}</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Total Cost</div>
          <div className="stat-value" style={{ fontSize: 22 }}>{'\u20B9'}{stats.totalCost?.toLocaleString()}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Total Revenue</div>
          <div className="stat-value" style={{ fontSize: 22 }}>{'\u20B9'}{stats.totalRevenue?.toLocaleString()}</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Payment Pending</div>
          <div className="stat-value">{stats.paymentPendingCount}</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Stock by Shoe Type</h3>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Shoe Type</th>
                  <th>Total</th>
                  <th>Unsold</th>
                  <th>Sold</th>
                </tr>
              </thead>
              <tbody>
                {stats.shoeTypes?.map(t => (
                  <tr key={t.name}>
                    <td><strong>{t.name}</strong></td>
                    <td>{t.total}</td>
                    <td><span className="badge badge-green">{t.unsold}</span></td>
                    <td><span className="badge badge-blue">{t.sold}</span></td>
                  </tr>
                ))}
                {(!stats.shoeTypes || stats.shoeTypes.length === 0) && (
                  <tr><td colSpan="4" style={{ textAlign: 'center', color: '#999' }}>No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Stock by D9 Model</h3>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Total</th>
                  <th>Available</th>
                </tr>
              </thead>
              <tbody>
                {stats.models?.map(m => (
                  <tr key={m.name}>
                    <td><strong>{m.name}</strong></td>
                    <td>{m.total}</td>
                    <td><span className={`badge ${m.unsold > 0 ? 'badge-green' : 'badge-red'}`}>{m.unsold}</span></td>
                  </tr>
                ))}
                {(!stats.models || stats.models.length === 0) && (
                  <tr><td colSpan="3" style={{ textAlign: 'center', color: '#999' }}>No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Stock by Lot</h3>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {stats.lots?.map(l => (
            <div key={l.lot} className="stat-card" style={{ minWidth: 120 }}>
              <div className="stat-label">Lot {l.lot}</div>
              <div className="stat-value" style={{ fontSize: 24 }}>{l.qty}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Recent Entries</h3>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Sr</th>
                <th>Shoe Type</th>
                <th>D9 Model</th>
                <th>Size</th>
                <th>Lot</th>
                <th>Qty</th>
                <th>MRP</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentEntries?.map(e => (
                <tr key={e.entryId || e.srNo}>
                  <td>{e.srNo}</td>
                  <td>{e.shoeType}</td>
                  <td><strong>{e.d9Model}</strong></td>
                  <td>{e.size}</td>
                  <td><span className="badge badge-blue">{e.lot}</span></td>
                  <td>{e.qty}</td>
                  <td>{e.mrpIncGst ? `\u20B9${Number(e.mrpIncGst).toLocaleString()}` : '-'}</td>
                  <td>
                    <span className={`badge ${e.status === 'Sold' ? 'badge-yellow' : 'badge-green'}`}>
                      {e.status || 'In Stock'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
