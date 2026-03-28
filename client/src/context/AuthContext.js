import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Just trust localStorage on startup - no API call needed
    try {
      const token = localStorage.getItem('d9shoe_token');
      const savedUser = localStorage.getItem('d9shoe_user');
      if (token && savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch {
      localStorage.removeItem('d9shoe_token');
      localStorage.removeItem('d9shoe_user');
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    // Clear any old data first
    localStorage.removeItem('d9shoe_token');
    localStorage.removeItem('d9shoe_user');

    const res = await api.post('/auth/login', { username, password });
    const { token, user: userData } = res.data;

    localStorage.setItem('d9shoe_token', token);
    localStorage.setItem('d9shoe_user', JSON.stringify(userData));
    sessionStorage.setItem('d9shoe_just_logged_in', 'true');
    setUser(userData);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('d9shoe_token');
    localStorage.removeItem('d9shoe_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
