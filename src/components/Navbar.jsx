import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Film, User, LogOut, Heart, Library, Search, Menu, X } from 'lucide-react';
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

  const links = [
    { name: 'Home', path: '/' },
    { name: 'Movies', path: '/movies' },
    { name: 'TV Shows', path: '/tv' },
  ];

  const handleSearch = (e) => {
    e.preventDefault();
    if(searchQuery.trim()) {
       navigate(`/?search=${encodeURIComponent(searchQuery)}`);
       setIsMenuOpen(false);
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-brand-surface/95 backdrop-blur-sm border-b border-brand-hover">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center space-x-2 text-brand-emerald">
              <Film size={26} />
              <span className="text-lg sm:text-xl font-bold text-white tracking-tight">SnM Flix</span>
            </Link>

            <div className="hidden md:flex space-x-2">
              {links.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    location.pathname === link.path
                      ? "bg-brand-hover text-white"
                      : "text-gray-300 hover:bg-brand-hover hover:text-white"
                  )}
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
          
          {/* Search bar visible everywhere including mobile */}
          <div className="flex-1 max-w-xs sm:max-w-sm mx-2">
            <form onSubmit={handleSearch} className="relative">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
               </div>
               <input
                  className="block w-full pl-9 pr-3 py-1.5 border border-brand-hover rounded-full leading-5 bg-brand-background text-gray-200 placeholder-gray-400 focus:outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald text-xs sm:text-sm transition-colors"
                  placeholder="Search movies..."
                  type="search"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
               />
            </form>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-3">
            <Link to="/watchlist" className="text-gray-300 hover:text-white p-2" title="Watchlist">
              <Library size={20} />
            </Link>
            <Link to="/favorites" className="text-gray-300 hover:text-white p-2" title="Favorites">
              <Heart size={20} />
            </Link>

            {user ? (
              <div className="hidden sm:flex items-center space-x-3 border-l border-brand-hover pl-3">
                <span className="text-sm font-medium text-gray-300 truncate max-w-[80px]">
                  {user.name || user.email}
                </span>
                <button
                  onClick={logout}
                  className="p-2 text-gray-300 hover:text-white rounded-md hover:bg-brand-hover transition-colors"
                  title="Logout"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden sm:flex items-center space-x-1 bg-brand-emerald text-black font-bold px-3 py-1.5 rounded-md text-sm hover:bg-emerald-400 transition-colors"
                title="Sign In"
              >
                <User size={16} />
                <span>Sign In</span>
              </Link>
            )}
            
            {/* Mobile hamburger for extra items */}
            <div className="flex md:hidden items-center">
               <button 
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="p-2 rounded-md text-gray-300 hover:text-white focus:outline-none"
               >
                 {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
               </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Menu for Navigation links */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-brand-hover bg-brand-surface px-4 py-3 space-y-2">
          <div className="flex gap-2">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsMenuOpen(false)}
                className="px-3 py-1.5 rounded-md text-sm font-medium bg-brand-background text-gray-300 hover:text-white"
              >
                {link.name}
              </Link>
            ))}
          </div>
          {user ? (
             <button
               onClick={() => { logout(); setIsMenuOpen(false); }}
               className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-red-400 bg-brand-background"
             >
               Logout ({user.email})
             </button>
          ) : (
             <Link
               to="/login"
               onClick={() => setIsMenuOpen(false)}
               className="block px-3 py-2 rounded-md text-sm font-medium text-brand-emerald bg-brand-background text-center"
             >
               Sign In / Create Account
             </Link>
          )}
        </div>
      )}
    </nav>
  );
}
