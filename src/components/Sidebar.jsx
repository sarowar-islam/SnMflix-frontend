import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Film, Compass, Sparkles, Smile, ShieldAlert, Tv,
  Flame, Eye, Heart, Zap, Activity, Globe, Users,
  Library, LogIn, LogOut, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const currentPath = location.pathname;

  const quickAccessItems = [
    { label: 'Watch Together', path: '/watch-together', icon: Users, badge: 'Live' },
    { label: 'Watchlist', path: '/watchlist', icon: Library },
    { label: 'Favorites', path: '/favorites', icon: Heart },
  ];

  const categoryItems = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Action', path: '/category/action', icon: Film },
    { label: 'Adventure', path: '/category/adventure', icon: Compass },
    { label: 'Animation', path: '/category/animation', icon: Sparkles },
    { label: 'Comedy', path: '/category/comedy', icon: Smile },
    { label: 'Crime', path: '/category/crime', icon: ShieldAlert },
    { label: 'Drama', path: '/category/drama', icon: Tv },
    { label: 'Fantasy', path: '/category/fantasy', icon: Sparkles },
    { label: 'Horror', path: '/category/horror', icon: Flame },
    { label: 'Mystery', path: '/category/mystery', icon: Eye },
    { label: 'Romance', path: '/category/romance', icon: Heart },
    { label: 'Sci-Fi', path: '/category/scifi', icon: Zap },
    { label: 'Thriller', path: '/category/thriller', icon: Activity },
    { label: 'Western', path: '/category/western', icon: Globe },
    { label: '18+ Adult Movies', path: '/category/adult', icon: ShieldAlert, adult: true },
  ];

  const renderContent = (isMobile = false) => (
    <div className="flex flex-col h-full bg-[#121212] border-r border-brand-hover text-gray-200">
      {isMobile && (
        <div className="flex items-center justify-between p-4 border-b border-brand-hover bg-brand-surface">
          <div className="flex items-center gap-3">
            <img src="/images/logo.png" alt="SnM Flix" className="h-7 w-auto object-contain" />
            <span className="text-base font-bold text-white">Browse Menu</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-brand-background text-gray-400 hover:text-white hover:bg-brand-hover transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-3 scrollbar-hide">
        {/* Quick Access Section */}
        <div>
          <p className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-1.5 lg:block md:hidden group-hover:block">
            Quick Access
          </p>
          <div className="space-y-1">
            {quickAccessItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;

              return (
                <Link
                  key={idx}
                  to={item.path}
                  onClick={onClose}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors group ${
                    isActive
                      ? 'bg-brand-hover text-brand-emerald font-bold border border-brand-emerald/30'
                      : 'text-gray-300 hover:bg-brand-hover hover:text-brand-emerald font-semibold'
                  }`}
                  title={item.label}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon size={18} className={`flex-shrink-0 ${isActive ? 'text-brand-emerald' : 'text-brand-emerald/80 group-hover:text-brand-emerald'}`} />
                    <span className="text-xs sm:text-sm truncate lg:inline md:hidden group-hover:inline">
                      {item.label}
                    </span>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-brand-emerald/20 text-brand-emerald rounded-full lg:inline md:hidden group-hover:inline">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Divider between sections */}
        <hr className="border-brand-hover my-2" />

        {/* Categories Section */}
        <div>
          <p className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-1.5 lg:block md:hidden group-hover:block">
            Discover
          </p>
          <div className="space-y-1">
            {categoryItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;

              if (item.adult) {
                return (
                  <Link
                    key={idx}
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group ${
                      isActive
                        ? 'bg-red-900/50 text-red-200 font-bold border border-red-800'
                        : 'text-red-400 hover:bg-red-950/40 hover:text-red-300 font-bold bg-red-950/20 border border-red-950/60'
                    }`}
                    title={item.label}
                  >
                    <Icon size={18} className="flex-shrink-0 text-red-500" />
                    <span className="text-xs sm:text-sm truncate lg:inline md:hidden group-hover:inline">
                      {item.label}
                    </span>
                  </Link>
                );
              }

              return (
                <Link
                  key={idx}
                  to={item.path}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group ${
                    isActive
                      ? 'bg-brand-hover text-brand-emerald font-bold'
                      : 'text-gray-300 hover:bg-brand-hover hover:text-brand-emerald font-semibold'
                  }`}
                  title={item.label}
                >
                  <Icon size={18} className={`flex-shrink-0 ${isActive ? 'text-brand-emerald' : 'text-gray-400 group-hover:text-brand-emerald'}`} />
                  <span className="text-xs sm:text-sm truncate lg:inline md:hidden group-hover:inline">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Auth Section in Sidebar */}
        <div className="pt-3 mt-3 border-t border-brand-hover">
          {user ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-brand-surface border border-brand-hover">
                <div className="w-7 h-7 rounded-full bg-brand-emerald text-black flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {user.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="truncate lg:block md:hidden group-hover:block">
                  <p className="text-xs font-bold text-white truncate">{user.username}</p>
                  <p className="text-[10px] text-brand-emerald">Online</p>
                </div>
              </div>
              <button
                onClick={() => { logout(); onClose && onClose(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-brand-hover hover:text-red-300 font-semibold transition-colors cursor-pointer group"
                title="Sign Out"
              >
                <LogOut size={18} className="flex-shrink-0 text-red-400" />
                <span className="text-xs sm:text-sm truncate lg:inline md:hidden group-hover:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-brand-emerald text-black hover:bg-emerald-400 font-bold transition-colors shadow-lg shadow-brand-emerald/20 group"
              title="Sign In"
            >
              <LogIn size={18} className="flex-shrink-0 text-black" />
              <span className="text-xs sm:text-sm truncate lg:inline md:hidden group-hover:inline">Sign In / Up</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop & Tablet Persistent Sidebar (hidden on mobile, compact w-16 on md, full w-64 on lg) */}
      <aside className="hidden md:flex flex-col fixed left-0 top-16 bottom-0 z-30 bg-[#121212] border-r border-brand-hover w-16 lg:w-64 hover:w-64 transition-all duration-300 group overflow-x-hidden">
        {renderContent(false)}
      </aside>

      {/* Mobile Drawer (visible only when isOpen is true on mobile) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
          <div className="relative w-85 max-w-[85vw] bg-[#121212] border-r border-brand-hover h-full flex flex-col shadow-2xl z-10">
            {renderContent(true)}
          </div>
        </div>
      )}
    </>
  );
}
