import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Play, Heart, Plus, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MovieCard({ movie }) {
  const { isWatchlist, isFavorite, toggleWatchlist, toggleFavorite } = useAuth();
  const navigate = useNavigate();

  const handleWatchlist = (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleWatchlist(movie);
  };

  const handleFavorite = (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleFavorite(movie);
  };

  const navigateToMovie = () => {
    navigate(`/movie/${movie.id}`);
  };

  const navigateToPlay = (e) => {
    e.stopPropagation();
    e.preventDefault();
    navigate(`/watch/${movie.id}`);
  };

  // Allow missing poster paths by showing a placeholder. Check posterUrl or poster
  const imageUrl = movie.posterUrl || movie.poster || movie.posterPath || 'https://via.placeholder.com/300x450?text=No+Image';

  return (
    <div 
      onClick={navigateToMovie}
      className="group relative rounded-xl overflow-hidden block aspect-[2/3] bg-brand-surface cursor-pointer ring-1 ring-transparent hover:ring-brand-emerald transition-all"
    >
      <img
        src={imageUrl}
        alt={movie.title}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-brand-background via-brand-background/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2 sm:p-4">
        <h3 className="text-white font-bold mb-2 truncate text-sm sm:text-base">{movie.title}</h3>

        <div className="flex space-x-1 sm:space-x-2">
          <button
            onClick={navigateToPlay}
            className="flex-1 bg-brand-emerald hover:bg-emerald-400 text-white py-1.5 rounded-md flex items-center justify-center transition-colors"
          >
            <Play size={16} className="mr-1" fill="currentColor" />
            <span className="text-xs sm:text-sm font-medium">Play</span>
          </button>

          <button
            onClick={handleWatchlist}
            className={`p-1.5 rounded-md transition-colors ${
              isWatchlist(movie.id) ? 'bg-brand-sage text-white' : 'bg-brand-surface/80 text-gray-300 hover:text-white hover:bg-brand-hover'
            }`}
            title="Watchlist"
          >
            {isWatchlist(movie.id) ? <Check size={18} /> : <Plus size={18} />}
          </button>

          <button
            onClick={handleFavorite}
            className={`p-1.5 rounded-md transition-colors ${
              isFavorite(movie.id) ? 'bg-red-500 text-white' : 'bg-brand-surface/80 text-gray-300 hover:text-white hover:bg-brand-hover'
            }`}
            title="Favorite"
          >
            <Heart size={18} fill={isFavorite(movie.id) ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
    </div>
  );
}
