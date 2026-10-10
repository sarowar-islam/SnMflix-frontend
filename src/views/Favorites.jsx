import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Film } from 'lucide-react';
import MovieCard from '../components/MovieCard';

const Favorites = () => {
  const { favorites } = useAuth();

  return (
    <div className="p-4 sm:p-8 min-h-screen text-white max-w-[1400px] mx-auto">
      <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-brand-emerald flex items-center gap-2">
        <span className="w-1.5 h-6 bg-brand-emerald rounded-full"></span>
        My Favorites
      </h2>
      {favorites.length === 0 ? (
        <div className="text-center py-20 bg-brand-surface rounded-2xl border border-brand-hover">
          <Film className="mx-auto h-16 w-16 text-brand-emerald mb-4 opacity-50" />
          <h5 className="text-xl text-white font-bold">Your favorites is empty</h5>
          <p className="mt-2 text-sm text-gray-400 max-w-md mx-auto">
            Explore the catalog and add movies or TV shows to your favorites.
          </p>
          <Link to="/" className="inline-block mt-6 px-6 py-3 bg-brand-emerald text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors">
            Browse Movies
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {favorites.map(movie => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites;
