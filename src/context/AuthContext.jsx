import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  STORAGE_KEYS,
  getAuthData,
  setAuthData,
  clearAuthData,
  getList,
  toggleInList,
  isInList
} from '../utils/storage';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    // Load auth
    const authList = getAuthData();
    if (authList.user) setUser(authList.user);
    if (authList.token) setToken(authList.token);

    // Load guest/user lists
    setWatchlist(getList(STORAGE_KEYS.WATCHLIST));
    setFavorites(getList(STORAGE_KEYS.FAVORITES));
  }, []);

  const login = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    setAuthData(userData, userToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    clearAuthData();
  };

  const toggleWatchlist = (item) => {
    const newList = toggleInList(STORAGE_KEYS.WATCHLIST, item);
    setWatchlist(newList);
  };

  const toggleFavorite = (item) => {
    const newList = toggleInList(STORAGE_KEYS.FAVORITES, item);
    setFavorites(newList);
  };

  const isWatchlist = (id) => isInList(STORAGE_KEYS.WATCHLIST, id);
  const isFavorite = (id) => isInList(STORAGE_KEYS.FAVORITES, id);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      logout,
      watchlist,
      favorites,
      toggleWatchlist,
      toggleFavorite,
      isWatchlist,
      isFavorite,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
