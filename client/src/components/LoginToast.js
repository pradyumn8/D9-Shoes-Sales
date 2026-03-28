import React, { useState, useEffect } from 'react';
import api from '../utils/api';

export default function LoginToast() {
  const [alerts, setAlerts] = useState([]);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if we just logged in (flag set by AuthContext)
    const justLoggedIn = sessionStorage.getItem('d9shoe_just_logged_in');
    if (!justLoggedIn) return;

    // Clear the flag
    sessionStorage.removeItem('d9shoe_just_logged_in');

    // Fetch recommendations
    api.get('/inventory/recommendations')
      .then(res => {
        if (res.data.length > 0) {
          setAlerts(res.data);
          setVisible(true);

          // Auto-hide after 15 seconds
          setTimeout(() => setVisible(false), 15000);
        }
      })
      .catch(() => {});
  }, []);

  if (!visible || dismissed || alerts.length === 0) return null;

  const fifoAlerts = alerts.filter(a => a.type === 'fifo');
  const lowAlerts = alerts.filter(a => a.type === 'low_stock');

  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 9999,
      maxWidth: 420, animation: 'slideIn 0.3s ease-out',
    }}>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      <div style={{
        background: '#fff', borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        overflow: 'hidden', border: '1px solid #e0e0e0',
      }}>
        {/* Header */}
        <div style={{
          background: fifoAlerts.length > 0 ? '#f39c12' : '#17a2b8',
          color: '#fff', padding: '14px 18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{'\u{1F514}'}</span>
            <div>
              <strong style={{ fontSize: 15 }}>Stock Alerts</strong>
              <div style={{ fontSize: 12, opacity: 0.9 }}>
                {fifoAlerts.length > 0 && `${fifoAlerts.length} FIFO alert${fifoAlerts.length > 1 ? 's' : ''}`}
                {fifoAlerts.length > 0 && lowAlerts.length > 0 && ' \u2022 '}
                {lowAlerts.length > 0 && `${lowAlerts.length} low stock`}
              </div>
            </div>
          </div>
          <button
            onClick={() => { setDismissed(true); setVisible(false); }}
            style={{
              background: 'rgba(255,255,255,0.2)', border: 'none',
              color: '#fff', borderRadius: 6, padding: '4px 10px',
              cursor: 'pointer', fontSize: 13,
            }}
          >
            Dismiss
          </button>
        </div>

        {/* Alert list (max 4) */}
        <div style={{ maxHeight: 280, overflow: 'auto' }}>
          {alerts.slice(0, 4).map((alert, idx) => (
            <div key={idx} style={{
              padding: '12px 18px', borderBottom: '1px solid #f0f0f0',
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>
                {alert.type === 'fifo' ? '\u26A0\uFE0F' : '\u{1F4E6}'}
              </span>
              <div style={{ fontSize: 13 }}>
                <strong>{alert.d9Model}</strong> — {alert.size}
                <div style={{ color: '#666', marginTop: 2 }}>
                  {alert.type === 'fifo' ? (
                    <>
                      Sell <span style={{ color: '#27ae60', fontWeight: 600 }}>Lot {alert.oldestLot.lot}</span> first
                      ({alert.oldestLot.qty} units) before {alert.newerLots.map(l => `Lot ${l.lot}`).join(', ')}
                    </>
                  ) : (
                    <>
                      Only <span style={{ color: '#e74c3c', fontWeight: 600 }}>{alert.qty} unit(s)</span> left
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
          {alerts.length > 4 && (
            <div style={{ padding: '8px 18px', fontSize: 12, color: '#999', textAlign: 'center' }}>
              +{alerts.length - 4} more alert(s) — check Dashboard for details
            </div>
          )}
        </div>

        {/* Auto-close progress bar */}
        <div style={{
          height: 3, background: '#f0f0f0',
        }}>
          <div style={{
            height: '100%',
            background: fifoAlerts.length > 0 ? '#f39c12' : '#17a2b8',
            animation: 'shrink 15s linear forwards',
          }} />
          <style>{`
            @keyframes shrink {
              from { width: 100%; }
              to { width: 0%; }
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}
