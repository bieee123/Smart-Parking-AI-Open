import { useState, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import i18n from '../i18n';

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

  // Sync i18n language when user is loaded from localStorage
  useEffect(() => {
    if (user?.language) {
      i18n.changeLanguage(user.language);
    }
  }, [user?.language]);

  const login = useCallback(async (usernameOrEmail, password) => {
    const response = await api.auth.login({ username: usernameOrEmail, password });
    // Backend returns: { success: true, data: { token, id, username, email, role } }
    const { token, ...userData } = response.data;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
    
    // Set language from user data
    if (userData.language) {
      i18n.changeLanguage(userData.language);
    }
    
    return userData;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const getToken = useCallback(() => localStorage.getItem(TOKEN_KEY), []);

  const isAuthenticated = useCallback(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    return t && t !== 'null' && t !== 'undefined';
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
