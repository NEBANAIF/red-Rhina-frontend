import axios from 'axios';

// The backend issues a bearer JWT (see AuthService/JwtTokenProvider) and
// expects it in the Authorization header - no cookie-based session exists
// server-side, so the token has to live somewhere the JS can read it back
// out. localStorage is the pragmatic choice for a from-scratch build like
// this; it is vulnerable to XSS reading the token, which a real production
// deployment would want to mitigate (short token lifetime + refresh flow,
// or moving to an httpOnly-cookie auth scheme on the backend instead).
const TOKEN_KEY = 'erp.accessToken';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A 401 means the token is missing/expired/invalid - there is no refresh
// endpoint in this backend, so the only correct move is to drop the stale
// token and send the user back to login. We don't redirect from here
// directly (this module has no router access); ProtectedRoute reacts to
// AuthContext's user becoming null instead. Listeners can subscribe via
// window events if a global toast is ever wired up.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      setToken(null);
      window.dispatchEvent(new CustomEvent('erp:unauthorized'));
    }
    return Promise.reject(error);
  },
);

/**
 * Every backend error is GlobalExceptionHandler's ApiError shape
 * ({ status, error, message, path, timestamp }) - this pulls out the one
 * field worth showing a user, with sane fallbacks for network failures
 * that never reached the backend at all.
 */
export function extractErrorMessage(error) {
  const data = error.response?.data;
  if (data?.fieldErrors?.length) {
    return data.fieldErrors.map((fe) => `${fe.field}: ${fe.message}`).join('; ');
  }
  if (data?.message) return data.message;
  if (error.response?.status) return `Request failed (${error.response.status})`;
  if (error.request) return 'Could not reach the server. Check your connection.';
  return error.message || 'Something went wrong.';
}

export default apiClient;
