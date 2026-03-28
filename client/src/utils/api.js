import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('d9shoe_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('d9shoe_token');
      localStorage.removeItem('d9shoe_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
