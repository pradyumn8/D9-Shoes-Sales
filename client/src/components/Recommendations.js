import React, { useState, useEffect } from 'react';
import api from '../utils/api';

export default function Recommendations({ compact = false }) {
  const [recs, setRecs] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());
  const [showAllLowStock, setShowAllLowStock] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/inventory/recommendations')
      .then(res => setRecs(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const dismiss = (idx) => {
    setDismissed(prev => new Set([...prev, idx]));
  };

  const visible = recs.filter((_, i) => !dismissed.has(i));
  const fifoRecs = visible.filter(r => r.type === 'fifo');
  const lowStockRecs = visible.filter(r => r.type === 'low_stock');

  if (loading || visible.length === 0) return null;

  // Compact mode: show only count + top recommendation
  if (compact) {
    return (
      <div style={{
        background: fifoRecs.length > 0 ? '#fff3cd' : '#d1ecf1',
        border: `1px solid ${fifoRecs.length > 0 ? '#ffc107' : '#bee5eb'}`,
        borderRadius: 10, padding: '12px 16px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong style={{ color: fifoRecs.length > 0 ? '#856404' : '#0c5460' }}>
              {fifoRecs.length > 0 ? `\u26A0\uFE0F ${fifoRecs.length} FIFO Alert(s)` : ''}
              {fifoRecs.length > 0 && lowStockRecs.length > 0 ? ' | ' : ''}
              {lowStockRecs.length > 0 ? `\u{1F4E6} ${lowStockRecs.length} Low Stock` : ''}
            </strong>
            {fifoRecs.length > 0 && (
              <span style={{ marginLeft: 12, fontSize: 13, color: '#856404' }}>
                {fifoRecs[0].message}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  const LOW_STOCK_LIMIT = 3;
  const lowStockToShow = showAllLowStock ? lowStockRecs : lowStockRecs.slice(0, LOW_STOCK_LIMIT);
  const hasMoreLowStock = lowStockRecs.length > LOW_STOCK_LIMIT;

  // Full mode
  return (
    <div style={{ marginBottom: 24 }}>
      {fifoRecs.length > 0 && (
        <div style={{
          background: '#fff3cd', border: '1px solid #ffc107',
          borderRadius: 12, padding: 20, marginBottom: 16,
        }}>
          <h3 style={{ color: '#856404', marginBottom: 12, fontSize: 16 }}>
            {'\u26A0\uFE0F'} FIFO Recommendations - Sell Older Lots First
          </h3>
          {fifoRecs.map((rec, idx) => (
            <div key={idx} style={{
              background: '#fff8e1', borderRadius: 8, padding: '12px 16px',
              marginBottom: 8, display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-start', borderLeft: '4px solid #f39c12',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {rec.d9Model} — {rec.size}
                  <span className="badge badge-blue" style={{ marginLeft: 8 }}>{rec.shoeType}</span>
                </div>
                <div style={{ fontSize: 13, color: '#666' }}>{rec.message}</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span className="badge badge-green">
                    Sell first: Lot {rec.oldestLot.lot} ({rec.oldestLot.qty} units)
                  </span>
                  {rec.newerLots.map((nl, i) => (
                    <span key={i} className="badge badge-yellow">
                      Then: Lot {nl.lot} ({nl.qty} units)
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => dismiss(recs.indexOf(rec))}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 18, color: '#999', padding: '0 4px',
                }}
                title="Dismiss"
              >
                {'\u2715'}
              </button>
            </div>
          ))}
        </div>
      )}

      {lowStockRecs.length > 0 && (
        <div style={{
          background: '#d1ecf1', border: '1px solid #bee5eb',
          borderRadius: 12, padding: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ color: '#0c5460', fontSize: 16, margin: 0 }}>
              {'\u{1F4E6}'} Low Stock Alerts
              <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 8 }}>({lowStockRecs.length} items)</span>
            </h3>
          </div>
          {lowStockToShow.map((rec, idx) => (
            <div key={idx} style={{
              background: '#e8f7fc', borderRadius: 8, padding: '10px 14px',
              marginBottom: 6, display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', borderLeft: '4px solid #17a2b8',
            }}>
              <div>
                <strong>{rec.d9Model}</strong> ({rec.size}) —
                <span style={{ color: '#dc3545', fontWeight: 600 }}> {rec.qty} unit(s) left</span>
                <span style={{ color: '#666', fontSize: 13, marginLeft: 8 }}>Lot {rec.lot}</span>
              </div>
              <button
                onClick={() => dismiss(recs.indexOf(rec))}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 16, color: '#999',
                }}
              >
                {'\u2715'}
              </button>
            </div>
          ))}
          {hasMoreLowStock && (
            <button
              onClick={() => setShowAllLowStock(!showAllLowStock)}
              style={{
                background: 'rgba(0,0,0,0.05)', border: '1px solid #bee5eb',
                borderRadius: 8, padding: '8px 16px', width: '100%',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                color: '#0c5460', marginTop: 8,
              }}
            >
              {showAllLowStock
                ? 'Show Less'
                : `Show ${lowStockRecs.length - LOW_STOCK_LIMIT} More Low Stock Alert${lowStockRecs.length - LOW_STOCK_LIMIT > 1 ? 's' : ''}`
              }
            </button>
          )}
        </div>
      )}
    </div>
  );
}
