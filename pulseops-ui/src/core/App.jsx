// ============================================================================
// App — PulseOps UI (Root Component)
//
// PURPOSE: Thin orchestrator that manages authentication state and routes
// between the LoginForm and the AppShell. No business logic lives here.
//
// ARCHITECTURE: Core component. Uses AuthService for login/logout/session.
// Listens for 'auth:session-expired' events dispatched by ApiClient when
// a 401 is received. Renders LoginForm when unauthenticated, AppShell
// when authenticated. Single login page for ALL roles — the backend
// determines the user's role and returns it in the JWT payload.
// ============================================================================
import React, { useState, useEffect, useCallback } from 'react';
import { AuthService, Logger, LoginForm, LoadingSpinner } from '@shared';
import logsConfig from '@shared/config/logs.json';
import PlatformDashboard from '@modules/admin/PlatformDashboard';
import ShiftRosterApp from '@modules/roster/ShiftRosterApp';

export default function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      // Only check session if a token exists in localStorage
      const hasToken = !!localStorage.getItem('pulseops_token');
      
      if (!hasToken) {
        setIsLoading(false);
        return;
      }

      try {
        const currentUser = await AuthService.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          Logger.setUser(currentUser);
          Logger.info('App', logsConfig.messages.auth.loginSuccess, { userId: currentUser.id });
        }
      } catch {
        // Token invalid or expired — stay on login
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      Logger.warn('App', logsConfig.messages.auth.sessionExpired);
    };
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, []);

  const handleLogin = useCallback(async (email, password) => {
    setIsLoggingIn(true);
    try {
      const loggedInUser = await AuthService.login(email, password);
      setUser(loggedInUser);
      Logger.setUser(loggedInUser);
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    AuthService.logout();
    Logger.info('App', 'User signed out');
    Logger.setUser(null);
    setUser(null);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <LoadingSpinner title="PulseOps" subtitle="Checking session..." isOpen={true} />
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLogin={handleLogin} isLoading={isLoggingIn} />;
  }

  return <PlatformDashboard user={user} onLogout={handleLogout} />;
}
