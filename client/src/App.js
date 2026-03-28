import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import LoginToast from './components/LoginToast';
import Dashboard from './pages/Dashboard';
import InventoryList from './pages/InventoryList';
import AddStock from './pages/AddStock';
import SellStock from './pages/SellStock';
import StockSummary from './pages/StockSummary';
import ExcelUpload from './pages/ExcelUpload';
import ShoeTypes from './pages/ShoeTypes';
import Models from './pages/Models';
import AuditLog from './pages/AuditLog';
import Users from './pages/Users';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;
  return user ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <>
    {user && <LoginToast />}
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
      <Route path="/inventory" element={<PrivateRoute><Layout><InventoryList /></Layout></PrivateRoute>} />
      <Route path="/add-stock" element={<PrivateRoute><Layout><AddStock /></Layout></PrivateRoute>} />
      <Route path="/sell" element={<PrivateRoute><Layout><SellStock /></Layout></PrivateRoute>} />
      <Route path="/stock" element={<PrivateRoute><Layout><StockSummary /></Layout></PrivateRoute>} />
      <Route path="/upload" element={<PrivateRoute><Layout><ExcelUpload /></Layout></PrivateRoute>} />
      <Route path="/shoe-types" element={<PrivateRoute><Layout><ShoeTypes /></Layout></PrivateRoute>} />
      <Route path="/models" element={<PrivateRoute><Layout><Models /></Layout></PrivateRoute>} />
      <Route path="/audit" element={<AdminRoute><Layout><AuditLog /></Layout></AdminRoute>} />
      <Route path="/users" element={<AdminRoute><Layout><Users /></Layout></AdminRoute>} />
    </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
