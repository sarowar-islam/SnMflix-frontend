import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  STORAGE_KEYS,
  getAuthData,
  setAuthData,
  clearAuthData,
  getList,
  toggleInList,
  isInList,
  addToWatchHistory,
  removeFromWatchHistory
} from '../utils/storage';
import api from '../utils/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [watchHistory, setWatchHistory] = useState([]);

  useEffect(() => {
    const authList = getAuthData();
    if (authList.user) setUser(authList.user);
    if (authList.token) setToken(authList.token);

    setWatchlist(getList(STORAGE_KEYS.WATCHLIST));
    setFavorites(getList(STORAGE_KEYS.FAVORITES));
    setWatchHistory(getList(STORAGE_KEYS.WATCH_HISTORY));

    if (authList.token) {
      api.get('/auth/me')
        .then(res => {
          if (res.data) {
            setUser(res.data);
          }
        })
        .catch(() => {
          // Token might be invalid or expired
          logout();
        });

      api.get('/users/me/watchlist')
        .then(res => {
          if (res.data && Array.isArray(res.data)) {
            // sync if needed
          }
        })
        .catch(() => {});
    }
  }, []);

  const login = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    setAuthData(userData, userToken);

    const currentWatchlist = getList(STORAGE_KEYS.WATCHLIST);
    if (currentWatchlist.length > 0) {
      api.post('/users/me/import-guest-data', currentWatchlist.map(item => ({ movieId: String(item.id) }))).catch(() => {});
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    clearAuthData();
    api.post('/auth/logout').catch(() => {});
  };

  const updateUserRoomCount = (newCount) => {
    if (user) {
      const updated = { ...user, roomCount: newCount };
      setUser(updated);
      setAuthData(updated, token);
    }
  };

  const toggleWatchlist = (item) => {
    const newList = toggleInList(STORAGE_KEYS.WATCHLIST, item);
    setWatchlist(newList);
    if (token) {
      const exists = newList.some(i => i.id === item.id);
      if (exists) {
        api.post('/users/me/watchlist', { movieId: String(item.id) }).catch(() => {});
      } else {
        api.delete('/users/me/watchlist', { data: { movieId: String(item.id) } }).catch(() => {});
      }
    }
  };

  const toggleFavorite = (item) => {
    const newList = toggleInList(STORAGE_KEYS.FAVORITES, item);
    setFavorites(newList);
  };

  const addHistory = (item) => {
    const newList = addToWatchHistory(item);
    setWatchHistory(newList);
  };

  const removeHistory = (id) => {
    const newList = removeFromWatchHistory(id);
    setWatchHistory(newList);
  };

  const isWatchlist = (id) => isInList(STORAGE_KEYS.WATCHLIST, id);
  const isFavorite = (id) => isInList(STORAGE_KEYS.FAVORITES, id);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      logout,
      updateUserRoomCount,
      watchlist,
      favorites,
      watchHistory,
      toggleWatchlist,
      toggleFavorite,
      addHistory,
      removeHistory,
      isWatchlist,
      isFavorite,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
