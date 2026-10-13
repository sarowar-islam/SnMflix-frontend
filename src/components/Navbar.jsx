import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Heart, Library, Search, Menu, Clock, Star, Users, LogIn } from 'lucide-react';
import { fetchMovies, getImageUrl } from '../utils/tmdb';

export default function Navbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef(null);

  // Load search history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('snmflix_search_history');
      if (saved) setSearchHistory(JSON.parse(saved));
    } catch(e) {}
  }, []);

  // Live autocomplete search while typing
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      fetchMovies.searchMulti(searchQuery)
        .then(res => {
          setSuggestions((res.data.results || []).filter(m => m.poster_path || m.profile_path).slice(0, 6));
        })
        .catch(() => setSuggestions([]));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveToHistory = (query) => {
    if (!query.trim()) return;
    try {
      const updated = [query, ...searchHistory.filter(h => h !== query)].slice(0, 5);
      setSearchHistory(updated);
      localStorage.setItem('snmflix_search_history', JSON.stringify(updated));
    } catch(e) {}
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if(searchQuery.trim()) {
      saveToHistory(searchQuery.trim());
      navigate(`/?search=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchFocused(false);
    }
  };

  const selectSuggestion = (item) => {
    saveToHistory(item.title || item.name);
    setIsSearchFocused(false);
    setSearchQuery('');
    const mType = item.media_type || (item.name && !item.title ? 'tv' : 'movie');
    navigate(`/movie/${item.id}?type=${mType}`);
  };

  const selectHistoryItem = (historyQuery) => {
    setSearchQuery(historyQuery);
    setIsSearchFocused(false);
    navigate(`/?search=${encodeURIComponent(historyQuery)}`);
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('snmflix_search_history');
  };

  return (
    <nav className="sticky top-0 z-40 bg-brand-surface/95 backdrop-blur-md border-b border-brand-hover h-16 flex items-center">
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Hamburger menu button + Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-xl bg-brand-surface hover:bg-brand-hover border border-brand-hover text-gray-200 transition-colors cursor-pointer flex items-center justify-center"
              title="Toggle Menu"
            >
              <Menu size={20} className="text-brand-emerald" />
            </button>

            <Link to="/" className="flex items-center space-x-2">
              <img src="/images/logo.png" alt="SnM Flix" className="h-7 sm:h-8 w-auto object-contain" />
            </Link>
          </div>

          {/* Center: Proper UI Matched Big Movie Search Bar with Live Autocomplete & History */}
          <div ref={searchRef} className="flex-1 max-w-sm sm:max-w-xl mx-2 relative">
            <form onSubmit={handleSearchSubmit} className="relative">
               <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-brand-emerald" />
               </div>
               <input
                  className="block w-full pl-10 pr-4 py-2 border border-brand-hover rounded-xl leading-5 bg-brand-background text-gray-100 placeholder-gray-400 focus:outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald text-xs sm:text-sm transition-colors shadow-inner"
                  placeholder="Search movies, TV shows, anime, K-drama..."
                  type="search"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
               />
            </form>

            {/* Suggestions & History Dropdown */}
            {isSearchFocused && (suggestions.length > 0 || searchHistory.length > 0) && (
              <div className="absolute left-0 right-0 mt-2 bg-brand-surface border border-brand-hover rounded-xl shadow-2xl overflow-hidden z-50">
                {/* Live Suggestions */}
                {searchQuery.trim() && suggestions.length > 0 && (
                  <div className="p-2">
                    <p className="text-[11px] font-bold text-gray-400 px-3 py-1 uppercase tracking-wider">Suggestions</p>
                    {suggestions.map(item => (
                      <div
                        key={item.id}
                        onClick={() => selectSuggestion(item)}
                        className="flex items-center gap-3 p-2.5 hover:bg-brand-hover/70 rounded-xl cursor-pointer transition-colors"
                      >
                        <img
                          src={getImageUrl(item.poster_path || item.profile_path, 'w92')}
                          alt={item.title || item.name}
                          className="w-10 h-14 object-cover rounded-xl flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-white truncate">{item.title || item.name}</p>
                          <div className="flex items-center gap-2 text-[11px] text-gray-400">
                            <span className="uppercase px-1.5 py-0.5 bg-brand-background rounded-xl text-[10px] font-semibold text-brand-emerald">
                              {item.media_type || (item.name && !item.title ? 'tv' : 'movie')}
                            </span>
                            {(item.release_date || item.first_air_date) && (
                              <span>{new Date(item.release_date || item.first_air_date).getFullYear()}</span>
                            )}
                            {item.vote_average > 0 && (
                              <span className="flex items-center gap-0.5 text-yellow-400">
                                <Star size={12} fill="currentColor" /> {parseFloat(item.vote_average).toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recent Search History */}
                {!searchQuery.trim() && searchHistory.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center justify-between px-3 py-1">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock size={12} /> Recent Searches
                      </p>
                      <button
                        type="button"
                        onClick={clearHistory}
                        className="text-[10px] text-brand-emerald hover:underline font-semibold cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                    {searchHistory.map((h, i) => (
                      <div
                        key={i}
                        onClick={() => selectHistoryItem(h)}
                        className="flex items-center justify-between px-3 py-2 hover:bg-brand-hover/70 rounded-xl cursor-pointer transition-colors text-xs text-gray-300"
                      >
                        <span className="truncate">{h}</span>
                        <span className="text-[10px] text-gray-500">History</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Side: Action Buttons & Clean Sign In Button */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <Link
              to="/watch-together"
              className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-emerald/10 hover:bg-brand-emerald/20 border border-brand-emerald/30 text-brand-emerald transition-colors text-xs font-bold"
              title="Watch Together"
            >
              <Users size={15} />
              <span className="hidden lg:inline">Watch Together</span>
            </Link>

            <Link
              to="/watchlist"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-surface hover:bg-brand-hover border border-brand-hover text-gray-300 hover:text-white transition-colors text-xs font-semibold"
              title="Watchlist"
            >
              <Library size={15} className="text-brand-emerald" />
              <span className="hidden lg:inline">Watchlist</span>
            </Link>

            <Link
              to="/favorites"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-surface hover:bg-brand-hover border border-brand-hover text-gray-300 hover:text-white transition-colors text-xs font-semibold"
              title="Favorites"
            >
              <Heart size={15} className="text-red-500" />
              <span className="hidden lg:inline">Favorites</span>
            </Link>

            {user ? (
              <div className="relative group">
                <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-surface hover:bg-brand-hover border border-brand-hover transition-colors cursor-pointer">
                  <div className="w-7 h-7 rounded-full bg-brand-emerald text-black flex items-center justify-center font-bold text-xs">
                    {user.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="hidden md:inline text-xs font-bold text-white truncate max-w-[100px]">{user.username}</span>
                </button>

                <div className="absolute right-0 mt-2 w-56 bg-brand-surface border border-brand-hover rounded-xl shadow-2xl py-2 hidden group-hover:block z-50">
                  <div className="px-4 py-2 border-b border-brand-hover">
                    <p className="text-[11px] text-gray-400">Signed in as</p>
                    <p className="text-xs font-bold text-white truncate">{user.username}</p>
                    <p className="text-[10px] text-brand-emerald mt-1 font-semibold">Rooms Created: {user.roomCount || 0}</p>
                  </div>
                  <Link to="/watch-together" className="flex items-center gap-2 px-4 py-2 text-xs text-brand-emerald font-bold hover:bg-brand-hover md:hidden">
                    <Users size={14} /> Watch Together
                  </Link>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-400 hover:bg-brand-hover hover:text-red-300 font-semibold cursor-pointer"
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 rounded-xl bg-brand-emerald text-black hover:bg-emerald-400 transition-colors font-bold text-xs sm:text-sm flex items-center justify-center shadow-lg shadow-brand-emerald/20"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
