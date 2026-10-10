import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Film, User, LogOut, Heart, Library, Search, Menu, X, Clock, Star, Home, Tv, Sparkles, Award, Globe, Bookmark, ShieldAlert } from 'lucide-react';
import { fetchMovies, getImageUrl } from '../utils/tmdb';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const searchRef = useRef(null);
  const moreRef = useRef(null);

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
      setIsMenuOpen(false);
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
    <>
      <nav className="sticky top-0 z-40 bg-brand-surface/95 backdrop-blur-sm border-b border-brand-hover">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-2">
            <div className="flex items-center gap-3">
              {/* More Button on the left of the logo */}
              <div ref={moreRef}>
                <button
                  onClick={() => setIsMoreOpen(true)}
                  className="p-2 sm:px-3 sm:py-2 rounded-xl bg-brand-surface hover:bg-brand-hover border border-brand-hover text-gray-200 transition-colors cursor-pointer flex items-center justify-center"
                  title="More Menu"
                >
                  <Menu size={18} className="text-brand-emerald" />
                </button>
              </div>

              {/* Logo using /images/logo.png */}
              <Link to="/" className="flex items-center space-x-2">
                <img src="/images/logo.png" alt="SnM Flix" className="h-6 sm:h-7 w-auto object-contain" />
              </Link>
            </div>

            {/* Enhanced Live Autocomplete Search Bar with History */}
            <div ref={searchRef} className="flex-1 max-w-xs sm:max-w-md mx-2 relative">
              <form onSubmit={handleSearchSubmit} className="relative">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                 </div>
                 <input
                    className="block w-full pl-9 pr-3 py-1.5 border border-brand-hover rounded-full leading-5 bg-brand-background text-gray-200 placeholder-gray-400 focus:outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald text-xs sm:text-sm transition-colors"
                    placeholder="Search movies, TV shows, anime..."
                    type="search"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                 />
              </form>

              {/* Suggestions & History Dropdown */}
              {isSearchFocused && (suggestions.length > 0 || searchHistory.length > 0) && (
                <div className="absolute left-0 right-0 mt-2 bg-brand-surface border border-brand-hover rounded-2xl shadow-2xl overflow-hidden z-50">
                  {/* Live Suggestions while typing */}
                  {searchQuery.trim() && suggestions.length > 0 && (
                    <div className="p-2">
                      <p className="text-[11px] font-bold text-gray-400 px-3 py-1 uppercase tracking-wider">Suggestions</p>
                      {suggestions.map(item => (
                        <div
                          key={item.id}
                          onClick={() => selectSuggestion(item)}
                          className="flex items-center gap-3 p-2 hover:bg-brand-hover/70 rounded-xl cursor-pointer transition-colors"
                        >
                          <img
                            src={getImageUrl(item.poster_path || item.profile_path, 'w92')}
                            alt={item.title || item.name}
                            className="w-10 h-14 object-cover rounded-lg flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-white truncate">{item.title || item.name}</p>
                            <div className="flex items-center gap-2 text-[11px] text-gray-400">
                              <span className="uppercase px-1.5 py-0.5 bg-brand-background rounded text-[10px] font-semibold text-brand-emerald">
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

                  {/* Search History (cached in localStorage) when input is empty or focused */}
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

            {/* Right Side: User Profile / Watchlist / Favorites / Auth */}
            <div className="flex items-center gap-3">
              <Link
                to="/watchlist"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-surface hover:bg-brand-hover border border-brand-hover text-gray-300 hover:text-white transition-colors text-xs font-semibold"
                title="Watchlist"
              >
                <Library size={16} className="text-brand-emerald" />
                <span className="hidden lg:inline">Watchlist</span>
              </Link>

              <Link
                to="/favorites"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-surface hover:bg-brand-hover border border-brand-hover text-gray-300 hover:text-white transition-colors text-xs font-semibold"
                title="Favorites"
              >
                <Heart size={16} className="text-red-500" />
                <span className="hidden lg:inline">Favorites</span>
              </Link>

              {/* {user ? (
                <div className="relative group">
                  <button className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-brand-surface hover:bg-brand-hover border border-brand-hover transition-colors">
                    <div className="w-7 h-7 rounded-full bg-brand-emerald text-black flex items-center justify-center font-bold text-xs">
                      {user.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span className="hidden md:inline text-xs font-bold text-white truncate max-w-[100px]">{user.username}</span>
                  </button>

                  <div className="absolute right-0 mt-2 w-48 bg-brand-surface border border-brand-hover rounded-2xl shadow-2xl py-2 hidden group-hover:block z-50">
                    <div className="px-4 py-2 border-b border-brand-hover">
                      <p className="text-xs text-gray-400">Signed in as</p>
                      <p className="text-xs font-bold text-white truncate">{user.username}</p>
                    </div>
                    <Link to="/watchlist" className="flex items-center gap-2 px-4 py-2 text-xs text-gray-300 hover:bg-brand-hover hover:text-white md:hidden">
                      <Library size={14} /> Watchlist
                    </Link>
                    <Link to="/favorites" className="flex items-center gap-2 px-4 py-2 text-xs text-gray-300 hover:bg-brand-hover hover:text-white md:hidden">
                      <Heart size={14} /> Favorites
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
                <div className="bg-brand-emerald/10 border border-brand-emerald/40 text-brand-emerald font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand-emerald animate-pulse"></span> Free Streaming
                </div>
              )} */}
            </div>
          </div>
        </div>
      </nav>

      {/* Proper Full-Viewport Slide-out Sidebar Drawer */}
      {isMoreOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
            onClick={() => setIsMoreOpen(false)}
          />

          {/* Sidebar Drawer */}
          <div className="relative w-80 max-w-[85vw] bg-[#121212] border-r border-brand-hover h-full flex flex-col shadow-2xl z-10">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-brand-hover bg-brand-surface">
              <div className="flex items-center gap-3">
                <img src="/images/logo.png" alt="SnM Flix" className="h-8 w-auto object-contain" />
                <span className="text-lg font-bold text-white">Browse Menu</span>
              </div>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="p-2 rounded-xl bg-brand-background text-gray-400 hover:text-white hover:bg-brand-hover transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Links */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#121212]">
              <Link
                to="/"
                onClick={() => setIsMoreOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-200 hover:bg-brand-hover hover:text-brand-emerald font-semibold transition-colors"
              >
                <Home size={18} className="text-brand-emerald" /> Home
              </Link>
              <Link
                to="/category/movies"
                onClick={() => setIsMoreOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-200 hover:bg-brand-hover hover:text-brand-emerald font-semibold transition-colors"
              >
                <Film size={18} className="text-brand-emerald" /> Movies
              </Link>
              <Link
                to="/category/tv"
                onClick={() => setIsMoreOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-200 hover:bg-brand-hover hover:text-brand-emerald font-semibold transition-colors"
              >
                <Tv size={18} className="text-brand-emerald" /> TV Series
              </Link>
              <Link
                to="/category/anime"
                onClick={() => setIsMoreOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-200 hover:bg-brand-hover hover:text-brand-emerald font-semibold transition-colors"
              >
                <Sparkles size={18} className="text-brand-emerald" /> Anime
              </Link>
              <Link
                to="/category/top_rated"
                onClick={() => setIsMoreOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-200 hover:bg-brand-hover hover:text-brand-emerald font-semibold transition-colors"
              >
                <Star size={18} className="text-brand-emerald" /> Best Rated
              </Link>
              <Link
                to="/category/award_winning"
                onClick={() => setIsMoreOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-200 hover:bg-brand-hover hover:text-brand-emerald font-semibold transition-colors"
              >
                <Award size={18} className="text-brand-emerald" /> Award Winning
              </Link>
              <Link
                to="/category/bangla"
                onClick={() => setIsMoreOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-200 hover:bg-brand-hover hover:text-brand-emerald font-semibold transition-colors"
              >
                <Globe size={18} className="text-brand-emerald" /> Bangla Movies
              </Link>
              <Link
                to="/watchlist"
                onClick={() => setIsMoreOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-200 hover:bg-brand-hover hover:text-brand-emerald font-semibold transition-colors"
              >
                <Bookmark size={18} className="text-brand-emerald" /> Watchlist
              </Link>
              <Link
                to="/favorites"
                onClick={() =>setIsMoreOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-200 hover:bg-brand-hover hover:text-brand-emerald font-semibold transition-colors"
              >
                <Heart size={18} className="text-brand-emerald" /> Favorites
              </Link>

              <div className="pt-4 border-t border-brand-hover">
                <Link
                  to="/category/adult"
                  onClick={() => setIsMoreOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-950/40 border border-red-900/50 text-red-400 hover:bg-red-900/40 hover:text-red-300 font-bold transition-colors shadow-lg"
                >
                  <ShieldAlert size={18} className="text-red-500" /> 18+ Adult Movies
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
