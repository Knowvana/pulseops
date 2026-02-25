// ============================================================================
// AuthService — PulseOps UI
//
// PURPOSE: Handles user authentication against the backend API.
// Currently implements database authentication (email/password against PGSQL).
// Contains a placeholder for future OpenID Connect integration.
//
// ARCHITECTURE: Stateless service. JWT tokens are managed by ApiClient.
// The backend performs all credential validation — the frontend never
// touches password hashes or database connections directly.
//
// USAGE:
//   import { AuthService } from '@shared';
//   const user = await AuthService.login(email, password);
//   AuthService.logout();
// ============================================================================
import ApiClient from '@shared/services/apiClient';
import Logger from '@shared/services/logger';
import logsConfig from '@shared/config/logs.json';

// ============================================================================
// AUTH PROVIDER STRATEGY
// Currently: 'database' (email/password against PGSQL)
// Future: 'oidc' (OpenID Connect via external IdP)
// ============================================================================
const AUTH_PROVIDER = 'database';

const AuthService = {
  /**
   * Get the current authentication provider type.
   * @returns {'database' | 'oidc'}
   */
  getProvider() {
    return AUTH_PROVIDER;
  },

  /**
   * Login with email and password (database auth).
   * Returns the authenticated user object with role and permissions.
   *
   * PLACEHOLDER: When AUTH_PROVIDER is switched to 'oidc', this method
   * should redirect to the IdP authorization endpoint instead.
   */
  async login(email, password) {
    if (AUTH_PROVIDER === 'oidc') {
      // ================================================================
      // OPENID CONNECT PLACEHOLDER
      // When implementing OIDC:
      //   1. Redirect to IdP authorization URL
      //   2. Handle callback with authorization code
      //   3. Exchange code for tokens via backend /api/auth/oidc/callback
      //   4. Backend validates tokens and returns user + JWT
      // ================================================================
      throw new Error('OpenID Connect not yet configured. Please contact your administrator.');
    }

    const response = await ApiClient.post('/auth/login', { email, password });

    if (!response.success) {
      Logger.warn('AuthService', logsConfig.messages.auth.loginFailed, { email });
      throw new Error(response.error?.message || logsConfig.messages.auth.loginFailed);
    }

    const { user, token, refreshToken } = response.data;
    ApiClient.setToken(token);
    if (refreshToken) ApiClient.setRefreshToken(refreshToken);
    Logger.setUser(user.email);
    Logger.info('AuthService', logsConfig.messages.auth.loginSuccess, { userId: user.id, role: user.role });

    return user;
  },

  /**
   * Logout the current user. Clears all tokens and logger state.
   */
  logout() {
    Logger.info('AuthService', logsConfig.messages.auth.logoutSuccess);
    ApiClient.clearTokens();
    Logger.setUser(null);
  },

  /**
   * Get the currently authenticated user from the backend.
   * Returns null if not authenticated.
   */
  async getCurrentUser() {
    const token = ApiClient.getToken();
    if (!token) return null;

    try {
      const response = await ApiClient.get('/auth/me');
      if (response.success && response.data) {
        Logger.setUser(response.data.email);
        return response.data;
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Check if a token exists (does not validate it).
   */
  isAuthenticated() {
    return !!ApiClient.getToken();
  },
};

export default AuthService;
