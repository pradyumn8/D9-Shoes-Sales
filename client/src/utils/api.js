import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Add token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('d9shoe_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors - but NEVER redirect automatically
// Let React Router's PrivateRoute handle navigation
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only clear storage if it's NOT a login request
      const url = error.config?.url || '';
      if (!url.includes('/auth/login')) {
        localStorage.removeItem('d9shoe_token');
        localStorage.removeItem('d9shoe_user');
        // Don't redirect here - let PrivateRoute handle it
        // Just reload to reset React state
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
