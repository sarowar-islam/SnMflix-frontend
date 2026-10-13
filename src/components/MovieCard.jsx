import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Heart, Plus, Check, X, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MovieCard({ movie, onRemove }) {
  const { isWatchlist, isFavorite, toggleWatchlist, toggleFavorite } = useAuth();
  const navigate = useNavigate();

  const mediaType = movie.mediaType || (movie.name && !movie.title ? 'tv' : 'movie');

  const handleWatchlist = (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleWatchlist({ ...movie, mediaType });
  };

  const handleFavorite = (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleFavorite({ ...movie, mediaType });
  };

  const navigateToMovie = () => {
    navigate(`/movie/${movie.id}?type=${mediaType}`);
  };

  const navigateToPlay = (e) => {
    e.stopPropagation();
    e.preventDefault();
    navigate(`/watch/${movie.id}?type=${mediaType}`);
  };

  const imageUrl = movie.posterUrl || movie.poster || movie.posterPath || 'https://via.placeholder.com/300x450?text=No+Image';
  const releaseYear = movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : '';

  return (
    <div
      onClick={navigateToMovie}
      className="group relative flex flex-col bg-brand-surface rounded-xl overflow-hidden cursor-pointer ring-1 ring-transparent hover:ring-brand-emerald transition-all shadow-md"
    >
      {/* Poster container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-brand-background">
        <img
          src={imageUrl}
          alt={movie.title || movie.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Rating badge */}
        {movie.rating > 0 && (
          <span className="absolute top-2 left-2 bg-black/70 backdrop-blur-md text-yellow-400 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-xl flex items-center gap-1">
            <Star size={12} className="text-yellow-400 fill-current" /> {parseFloat(movie.rating).toFixed(1)}
          </span>
        )}

        {/* Remove button for Watch History */}
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onRemove(movie.id);
            }}
            className="absolute top-2 right-2 bg-black/70 hover:bg-red-600 text-white p-1.5 rounded-xl transition-colors z-20 shadow-md cursor-pointer"
            title="Remove from Watching Now"
          >
            <X size={14} />
          </button>
        )}

        {/* Quick action overlay on hover (Desktop) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden sm:flex flex-col justify-end p-3">
          <div className="flex gap-1.5">
            <button
              onClick={navigateToPlay}
              className="flex-1 bg-brand-emerald hover:bg-emerald-400 text-black py-2 rounded-xl flex items-center justify-center transition-colors font-bold text-xs"
            >
              <Play size={14} className="mr-1" fill="currentColor" />
              <span>Watch</span>
            </button>
            <button
              onClick={handleWatchlist}
              className={`p-2 rounded-xl transition-colors ${
                isWatchlist(String(movie.id)) ? 'bg-brand-emerald text-black' : 'bg-black/60 text-white hover:bg-brand-hover'
              }`}
              title="Watchlist"
            >
              {isWatchlist(String(movie.id)) ? <Check size={16} /> : <Plus size={16} />}
            </button>
            <button
              onClick={handleFavorite}
              className={`p-2 rounded-xl transition-colors ${
                isFavorite(String(movie.id)) ? 'bg-red-500 text-white' : 'bg-black/60 text-white hover:bg-brand-hover'
              }`}
              title="Favorite"
            >
              <Heart size={16} fill={isFavorite(String(movie.id)) ? "currentColor" : "none"} />
            </button>
          </div>
        </div>
      </div>

      {/* Title & info always visible below poster (optimized for mobile & desktop) */}
      <div className="p-2 sm:p-2.5 flex flex-col justify-between bg-brand-surface flex-1">
        <h3 className="text-white font-bold text-xs sm:text-sm truncate w-full">
          {movie.title || movie.name}
        </h3>
        <div className="flex items-center justify-between text-[10px] sm:text-xs text-gray-400 mt-1">
          <span>{releaseYear || (movie.mediaType === 'tv' ? 'TV Series' : 'Movie')}</span>
          <div className="flex items-center gap-1 sm:hidden">
            <button
              onClick={navigateToPlay}
              className="text-brand-emerald hover:underline font-bold text-[11px]"
            >
              Watch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
