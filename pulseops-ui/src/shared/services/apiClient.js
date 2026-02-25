// ============================================================================
// ApiClient Service — PulseOps UI
//
// PURPOSE: Centralized HTTP client for all backend API communication.
// Handles JWT token management, request/response interceptors, and
// standardized error handling. All URLs come from urls.json config.
//
// ARCHITECTURE: Singleton service. Attaches Authorization header with JWT
// token to every request. Stores tokens in localStorage for persistence
// across page reloads. Stateless-safe — tokens survive pod bounces.
//
// USAGE:
//   import { ApiClient } from '@shared';
//   const data = await ApiClient.get('/users');
//   const result = await ApiClient.post('/auth/login', { email, password });
// ============================================================================
import urlsConfig from '@shared/config/urls.json';
import Logger from '@shared/services/logger';
import logsConfig from '@shared/config/logs.json';

const TOKEN_KEY = 'pulseops_token';
const REFRESH_TOKEN_KEY = 'pulseops_refresh_token';

class ApiClientService {
  constructor() {
    this._baseUrl = urlsConfig.apiBaseUrl || '/api';
  }

  getBaseUrl() { return this._baseUrl; }
  setBaseUrl(url) { this._baseUrl = url; }

  getToken() { return localStorage.getItem(TOKEN_KEY); }
  setToken(token) { localStorage.setItem(TOKEN_KEY, token); }
  getRefreshToken() { return localStorage.getItem(REFRESH_TOKEN_KEY); }
  setRefreshToken(token) { localStorage.setItem(REFRESH_TOKEN_KEY, token); }

  clearTokens() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  _buildHeaders(customHeaders = {}) {
    const headers = { 'Content-Type': 'application/json', ...customHeaders };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async _request(method, path, body = null, customHeaders = {}) {
    const url = `${this._baseUrl}${path}`;
    const start = performance.now();

    try {
      const options = {
        method,
        headers: this._buildHeaders(customHeaders),
      };
      if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      const latencyMs = Math.round(performance.now() - start);

      const contentType = response.headers.get('content-type');
      let responseData = null;
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = { success: response.ok, status: response.status };
      }

      Logger.logApiCall({
        method,
        url: path,
        path,
        statusCode: response.status,
        durationMs: latencyMs,
        success: response.ok,
        requestPayload: body,
        responsePayload: responseData,
        user: this._user?.email || 'system',
      });

      if (response.status === 401) {
        this.clearTokens();
        Logger.warn('ApiClient', logsConfig.messages.auth.sessionExpired);
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
      }

      return responseData;
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      Logger.logApiCall({
        method,
        url: path,
        path,
        statusCode: 0,
        durationMs: latencyMs,
        success: false,
        requestPayload: body,
        responsePayload: { error: err.message },
      });
      Logger.error('ApiClient', logsConfig.messages.api.requestFailed, { method, path, error: err.message, latencyMs });
      return { success: false, error: { message: err.message, code: 'NETWORK_ERROR' } };
    }
  }

  get(path, headers) { return this._request('GET', path, null, headers); }
  post(path, body, headers) { return this._request('POST', path, body, headers); }
  put(path, body, headers) { return this._request('PUT', path, body, headers); }
  patch(path, body, headers) { return this._request('PATCH', path, body, headers); }
  delete(path, headers) { return this._request('DELETE', path, null, headers); }
}

const ApiClient = new ApiClientService();
export default ApiClient;
