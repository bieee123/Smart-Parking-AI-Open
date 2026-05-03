import { useState, useCallback } from 'react';
import { api } from '../services/api';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export function useAuth() {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback(async (usernameOrEmail, password) => {
    const response = await api.auth.login({ username: usernameOrEmail, password });
    // Backend returns: { success: true, data: { token, id, username, email, role } }
    const { token, ...userData } = response.data;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const getToken = useCallback(() => localStorage.getItem(TOKEN_KEY), []);

  const isAuthenticated = useCallback(() => {
    return !!localStorage.getItem(TOKEN_KEY);
  }, []);

  return {
    user,
    login,
    logout,
    getToken,
    isAuthenticated,
  };
}

export default useAuth;
