import React, { useState, useEffect } from 'react';
import api from '../utils/api';

export default function StockSummary() {
  const [stock, setStock] = useState([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    api.get('/inventory/stock').then(res => setStock(res.data)).catch(console.error);
  }, []);

  const filtered = stock.filter(s =>
    s.shoeType?.toLowerCase().includes(filter.toLowerCase()) ||
    s.d9Model?.toLowerCase().includes(filter.toLowerCase()) ||
    s.size?.toLowerCase().includes(filter.toLowerCase())
  );

  const totalQty = filtered.reduce((sum, s) => sum + s.totalQty, 0);

  return (
    <div>
      <div className="page-header">
        <h1>Stock Summary</h1>
        <p>Current unsold inventory grouped by model and size</p>
      </div>

      <div className="toolbar">
        <input
          placeholder="Search by type, model, size..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="search-input"
        />
        <span style={{ color: '#666', fontSize: 13 }}>Total available: <strong>{totalQty}</strong> units</span>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Shoe Type</th>
                <th>D9 Model</th>
                <th>Size</th>
                <th>Total Available</th>
                <th>Lot Breakdown</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.shoeType}</td>
                  <td><strong>{item.d9Model}</strong></td>
                  <td>{item.size}</td>
                  <td style={{ fontSize: 18, fontWeight: 700 }}>{item.totalQty}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {item.lots.map((lot, li) => (
                        <span key={li} className={`badge ${lot.lot === '1st' ? 'badge-green' : lot.lot === '2nd' ? 'badge-yellow' : 'badge-blue'}`}>
                          {lot.lot}: {lot.qty}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    {item.totalQty === 0
                      ? <span className="badge badge-red">Out of Stock</span>
                      : item.totalQty < 3
                        ? <span className="badge badge-yellow">Low Stock</span>
                        : <span className="badge badge-green">In Stock</span>
                    }
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="6" style={{ textAlign: 'center', color: '#999', padding: 40 }}>No stock available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
