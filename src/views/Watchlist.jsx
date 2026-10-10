import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Film } from 'lucide-react';

const Watchlist = () => {
  const { watchlist, toggleWatchlist } = useAuth();
  
  return (
    <div className="p-8 min-h-screen text-white max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold mb-8 text-brand-emerald">My Watchlist</h2>
      {watchlist.length === 0 ? (
        <div className="text-center py-20 bg-brand-surface rounded-xl border border-brand-card">
          <Film className="mx-auto h-16 w-16 text-brand-sage mb-4 opacity-50" />
          <h3 className="text-xl text-brand-sage">Your watchlist is empty</h3>
          <p className="mt-2 text-sm text-brand-sage/70 max-w-md mx-auto">
            Explore the catalog and add movies you want to watch later.
          </p>
          <Link to="/" className="inline-block mt-6 px-6 py-2 bg-brand-emerald text-brand-background font-semibold rounded-lg hover:bg-brand-hover">
            Browse Movies
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 lg:grid-cols-5 gap-6">
          {watchlist.map(movie => (
            <div key={movie.id} className="group relative bg-brand-surface rounded-xl overflow-hidden hover:ring-2 hover:ring-brand-emerald transition-all shadow-lg">
              <Link to={`/movie/${movie.id}`}>
                <img 
                  src={movie.poster} 
                  alt={movie.title} 
                  className="w-full aspect-[2/3] object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                  <h3 className="font-semibold text-sm truncate">{movie.title}</h3>
                </div>
              </Link>
              <button 
                onClick={(e) => { e.preventDefault(); toggleWatchlist(movie.id); }}
                className="absolute top-2 right-2 bg-black/60 text-white hover:text-red-400 p-2 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove from Watchlist"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Watchlist;
