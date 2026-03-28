import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const panelRef = useRef(null);

  // Fetch recommendations
  useEffect(() => {
    api.get('/inventory/recommendations')
      .then(res => setAlerts(res.data))
      .catch(() => {});

    // Refresh every 2 minutes
    const interval = setInterval(() => {
      api.get('/inventory/recommendations')
        .then(res => setAlerts(res.data))
        .catch(() => {});
    }, 120000);

    return () => clearInterval(interval);
  }, []);

  // Close panel on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fifoCount = alerts.filter(a => a.type === 'fifo').length;
  const lowStockCount = alerts.filter(a => a.type === 'low_stock').length;
  const totalAlerts = alerts.length;

  const navItems = [
    { to: '/', label: 'Dashboard', icon: '\u{1F4CA}' },
    { to: '/inventory', label: 'All Entries', icon: '\u{1F4CB}' },
    { to: '/add-stock', label: 'Add Stock', icon: '\u{1F4E5}' },
    { to: '/sell', label: 'Sell / Export', icon: '\u{1F4E4}' },
    { to: '/stock', label: 'Stock Summary', icon: '\u{1F4E6}' },
    { to: '/upload', label: 'Excel Upload', icon: '\u{1F4C4}' },
    { to: '/shoe-types', label: 'Shoe Types', icon: '\u{1F3F7}' },
    { to: '/models', label: 'D9 Models', icon: '\u{1F45F}' },
  ];

  if (isAdmin) {
    navItems.push({ to: '/audit', label: 'Audit Log', icon: '\u{1F4DD}' });
    navItems.push({ to: '/users', label: 'Users', icon: '\u{1F465}' });
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2>D9SHOE</h2>
              <small>Inventory Management</small>
            </div>
            {/* Notification Bell */}
            <div ref={panelRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowPanel(!showPanel)}
                style={{
                  background: totalAlerts > 0 ? 'rgba(255,193,7,0.2)' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 10px',
                  cursor: 'pointer',
                  fontSize: 20,
                  position: 'relative',
                  color: '#fff',
                }}
                title={`${totalAlerts} alert(s)`}
              >
                {'\u{1F514}'}
                {totalAlerts > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4,
                    background: '#e74c3c', color: '#fff',
                    borderRadius: '50%', width: 20, height: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                  }}>
                    {totalAlerts}
                  </span>
                )}
              </button>

              {/* Alert Panel Dropdown - fixed position so it's not clipped by sidebar */}
              {showPanel && (
                <div style={{
                  position: 'fixed', top: 70, left: 270,
                  background: '#fff', borderRadius: 12,
                  boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                  width: 380, maxHeight: 450, overflow: 'auto',
                  zIndex: 9999, color: '#333',
                }}>
                  <div style={{
                    padding: '14px 16px', borderBottom: '1px solid #eee',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <strong style={{ fontSize: 15 }}>Notifications</strong>
                    {fifoCount > 0 && (
                      <span style={{
                        background: '#fff3cd', color: '#856404',
                        padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                      }}>
                        {fifoCount} FIFO Alert{fifoCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {alerts.length === 0 ? (
                    <div style={{ padding: 30, textAlign: 'center', color: '#999' }}>
                      {'\u2705'} No alerts — all stock is in order!
                    </div>
                  ) : (
                    <div>
                      {alerts.map((alert, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setShowPanel(false);
                            navigate('/sell');
                          }}
                          style={{
                            padding: '12px 16px', borderBottom: '1px solid #f5f5f5',
                            cursor: 'pointer', transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <span style={{ fontSize: 18, flexShrink: 0 }}>
                              {alert.type === 'fifo' ? '\u26A0\uFE0F' : '\u{1F4E6}'}
                            </span>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                                {alert.d9Model} — {alert.size}
                              </div>
                              <div style={{ fontSize: 12, color: '#666', lineHeight: 1.4 }}>
                                {alert.type === 'fifo' ? (
                                  <>
                                    Sell from <strong style={{ color: '#27ae60' }}>Lot {alert.oldestLot.lot}</strong> first
                                    ({alert.oldestLot.qty} units) before{' '}
                                    {alert.newerLots.map(l => `Lot ${l.lot}`).join(', ')}
                                  </>
                                ) : (
                                  <>
                                    Only <strong style={{ color: '#e74c3c' }}>{alert.qty} unit(s)</strong> left
                                    in Lot {alert.lot}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    onClick={() => { setShowPanel(false); navigate('/sell'); }}
                    style={{
                      padding: '10px 16px', textAlign: 'center', borderTop: '1px solid #eee',
                      color: '#4472c4', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Go to Sell / Export {'\u2192'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {/* Show alert badge on Sell page nav item */}
              {item.to === '/sell' && fifoCount > 0 && (
                <span style={{
                  marginLeft: 'auto', background: '#e74c3c', color: '#fff',
                  borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                }}>
                  {fifoCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div>
              <div className="user-name">{user?.fullName}</div>
              <div className="user-role">{user?.role}</div>
            </div>
            <button onClick={logout}>Logout</button>
          </div>
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
