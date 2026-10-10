export const STORAGE_KEYS = {
  WATCHLIST: 'snmflix_watchlist',
  FAVORITES: 'snmflix_favorites',
  WATCH_HISTORY: 'snmflix_watch_history',
  USER: 'snmflix_user',
  TOKEN: 'snmflix_token'
};

export const getList = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error(`Error reading ${key} from storage`, error);
    return [];
  }
};

export const saveList = (key, list) => {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (error) {
    console.error(`Error saving ${key} to storage`, error);
  }
};

export const toggleInList = (key, item) => {
  const list = getList(key);
  const exists = list.some(i => i.id === item.id);
  let newList;

  if (exists) {
    newList = list.filter(i => i.id !== item.id);
  } else {
    newList = [item, ...list];
  }

  saveList(key, newList);
  return newList;
};

export const addToWatchHistory = (item) => {
  const list = getList(STORAGE_KEYS.WATCH_HISTORY);
  const filtered = list.filter(i => i.id !== item.id);
  const newList = [item, ...filtered].slice(0, 20);
  saveList(STORAGE_KEYS.WATCH_HISTORY, newList);
  return newList;
};

export const removeFromWatchHistory = (id) => {
  const list = getList(STORAGE_KEYS.WATCH_HISTORY);
  const newList = list.filter(i => String(i.id) !== String(id));
  saveList(STORAGE_KEYS.WATCH_HISTORY, newList);
  return newList;
};

export const isInList = (key, id) => {
  const list = getList(key);
  return list.some(item => item.id === id);
};

export const setAuthData = (user, token) => {
  try {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  } catch (error) {
    console.error('Error saving auth data', error);
  }
};

export const clearAuthData = () => {
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
};

export const getAuthData = () => {
  try {
    const userData = localStorage.getItem(STORAGE_KEYS.USER);
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    return {
      user: userData ? JSON.parse(userData) : null,
      token: token || null
    };
  } catch (error) {
    return { user: null, token: null };
  }
};
