import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();

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
          <h2>D9SHOE</h2>
          <small>Inventory Management</small>
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
