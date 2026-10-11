import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { fetchMovies, getImageUrl } from '../utils/tmdb';
import { useAuth } from '../context/AuthContext';
import MovieCard from '../components/MovieCard';
import { Play, Heart, Plus, Check, Star, Calendar, Clock, ArrowLeft, MessageSquare } from 'lucide-react';

export default function MovieDetails() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mediaType = searchParams.get('type') || 'movie';
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visibleReviewsCount, setVisibleReviewsCount] = useState(2);

  const [similarMovies, setSimilarMovies] = useState([]);
  const [similarPage, setSimilarPage] = useState(1);
  const [hasMoreSimilar, setHasMoreSimilar] = useState(true);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  const { isWatchlist, isFavorite, toggleWatchlist, toggleFavorite } = useAuth();

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    setVisibleReviewsCount(2);

    Promise.all([
      fetchMovies.fetchMovieDetails(id, mediaType),
      fetchMovies.fetchRecommendations(id, mediaType, 1).catch(() => ({ data: { results: [] } }))
    ])
      .then(([movieRes, recRes]) => {
        const movieData = movieRes.data;
        setMovie(movieData);

        const similarFromApi = movieData.similar?.results || [];
        const recsFromApi = recRes.data.results || [];

        const combined = [...recsFromApi, ...similarFromApi].filter(m => m.poster_path);
        const uniqueMap = new Map();
        combined.forEach(m => {
          if (m.id && !uniqueMap.has(m.id)) {
            uniqueMap.set(m.id, m);
          }
        });

        const sim = Array.from(uniqueMap.values());
        setSimilarMovies(sim);
        setSimilarPage(1);
        setHasMoreSimilar(sim.length > 0);

        const mTitle = movieData.title || movieData.name || 'Movie';
        document.title = `${mTitle} — Watch Online Free | SnM Flix`;
        let metaDesc = document.querySelector("meta[name='description']");
        if (metaDesc) {
          metaDesc.setAttribute("content", `Watch ${mTitle} online in HD on SnM Flix. Stream ${mTitle} free with no ads.`);
        }
        let ogTitle = document.querySelector("meta[property='og:title']");
        if (ogTitle) ogTitle.setAttribute("content", `${mTitle} — Watch Online Free | SnM Flix`);
        let ogDesc = document.querySelector("meta[property='og:description']");
        if (ogDesc) ogDesc.setAttribute("content", `Watch ${mTitle} online in HD on SnM Flix. Stream ${mTitle} free with no ads.`);
        let ogImage = document.querySelector("meta[property='og:image']");
        if (ogImage) {
          ogImage.setAttribute("content", movieData.backdrop_path ? getImageUrl(movieData.backdrop_path, 'original') : '/images/og-image.png');
        }
        let twTitle = document.querySelector("meta[name='twitter:title']");
        if (twTitle) twTitle.setAttribute("content", `${mTitle} — Watch Online Free | SnM Flix`);
        let twDesc = document.querySelector("meta[name='twitter:description']");
        if (twDesc) twDesc.setAttribute("content", `Watch ${mTitle} online in HD on SnM Flix. Stream ${mTitle} free with no ads.`);
        let twImage = document.querySelector("meta[name='twitter:image']");
        if (twImage) {
          twImage.setAttribute("content", movieData.backdrop_path ? getImageUrl(movieData.backdrop_path, 'original') : '/images/og-image.png');
        }
      })
      .catch(() => setMovie(null))
      .finally(() => setLoading(false));
  }, [id, mediaType]);

  const loadMoreSimilar = () => {
    if (loadingSimilar || !hasMoreSimilar) return;
    setLoadingSimilar(true);
    const nextPage = similarPage + 1;

    Promise.all([
      fetchMovies.fetchRecommendations(id, mediaType, nextPage).catch(() => ({ data: { results: [] } })),
      fetchMovies.fetchSimilar(id, mediaType, nextPage).catch(() => ({ data: { results: [] } }))
    ])
      .then(([recRes, simRes]) => {
        const newRecs = recRes.data.results || [];
        const newSim = simRes.data.results || [];
        const combined = [...newRecs, ...newSim].filter(m => m.poster_path);

        const existingIds = new Set(similarMovies.map(m => m.id));
        const uniqueNew = combined.filter(m => !existingIds.has(m.id));

        setSimilarMovies(prev => [...prev, ...uniqueNew]);
        setSimilarPage(nextPage);
        if (uniqueNew.length === 0 || nextPage >= 5) {
          setHasMoreSimilar(false);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSimilar(false));
  };

  // Infinite scroll listener for Similar Movies
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 600) {
        if (!loadingSimilar && hasMoreSimilar) {
          loadMoreSimilar();
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadingSimilar, hasMoreSimilar, similarPage, id, mediaType]);

  if (loading) return (
    <div className="flex justify-center items-center h-screen bg-brand-background">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-emerald"></div>
    </div>
  );

  if (!movie) return (
    <div className="flex flex-col justify-center items-center h-screen bg-brand-background text-white gap-4">
      <p className="text-xl">Movie not found</p>
      <Link to="/" className="bg-brand-emerald px-4 py-2 rounded-lg text-black font-bold">Go Home</Link>
    </div>
  );

  const trailer = movie.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
  const cast = movie.credits?.cast?.slice(0, 10) || [];
  const genres = movie.genres || [];
  const reviews = movie.reviews?.results || [];

  const movieForCard = {
    id: String(movie.id),
    title: movie.title || movie.name,
    posterUrl: getImageUrl(movie.poster_path, 'w500'),
    backdropUrl: getImageUrl(movie.backdrop_path, 'original'),
    rating: movie.vote_average,
    mediaType,
  };

  return (
    <div className="min-h-screen bg-brand-background text-white pb-20">
      {/* HERO Backdrop */}
      <div className="relative w-full h-[50vh] sm:h-[60vh] overflow-hidden">
        <img
          src={getImageUrl(movie.backdrop_path, 'original')}
          alt={movie.title || movie.name}
          className="w-full h-full object-cover object-top opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-background to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-brand-background/60 to-transparent"></div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 -mt-40 relative z-10">
        <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors text-sm">
          <ArrowLeft size={16} /> Back
        </Link>

        <div className="flex flex-col md:flex-row gap-8">
          {/* POSTER */}
          <div className="flex-shrink-0 w-40 sm:w-56 md:w-64 lg:w-72 mx-auto md:mx-0">
            <img
              src={getImageUrl(movie.poster_path, 'w500')}
              alt={movie.title || movie.name}
              className="rounded-2xl shadow-2xl shadow-black/70 w-full ring-1 ring-brand-hover"
            />
          </div>

          {/* META */}
          <div className="flex-1 min-w-0">
            {/* Badge */}
            <div className="flex gap-2 flex-wrap mb-2">
              <span className="bg-brand-emerald text-black text-xs font-bold px-2 py-1 rounded uppercase">
                {mediaType === 'tv' ? 'TV Show' : 'Movie'}
              </span>
              {genres.map(g => (
                <span key={g.id} className="bg-brand-surface text-gray-300 text-xs px-2 py-1 rounded border border-brand-hover">
                  {g.name}
                </span>
              ))}
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-3 leading-tight">
              {movie.title || movie.name}
            </h1>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 mb-5 text-sm text-gray-300">
              {movie.vote_average > 0 && (
                <span className="flex items-center gap-1 text-yellow-400 font-semibold text-base">
                  <Star size={16} fill="currentColor" />
                  {parseFloat(movie.vote_average).toFixed(1)} / 10
                </span>
              )}
              {(movie.release_date || movie.first_air_date) && (
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} />
                  {new Date(movie.release_date || movie.first_air_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              )}
              {movie.runtime > 0 && (
                <span className="flex items-center gap-1.5">
                  <Clock size={14} />
                  {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
                </span>
              )}
              {movie.number_of_seasons && (
                <span>{movie.number_of_seasons} Season{movie.number_of_seasons > 1 ? 's' : ''}</span>
              )}
            </div>

            <p className="text-gray-300 text-base leading-relaxed mb-8 max-w-3xl">
              {movie.overview}
            </p>

            {/* ACTION BUTTONS */}
            <div className="flex flex-wrap gap-3 mb-8">
              <Link
                to={`/watch/${id}?type=${mediaType}`}
                className="bg-brand-emerald hover:bg-emerald-400 text-black font-bold px-8 py-3 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-brand-emerald/20"
              >
                <Play size={20} fill="currentColor" />
                Watch Now
              </Link>
              <button
                onClick={() => toggleWatchlist(movieForCard)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-colors border ${isWatchlist(String(id)) ? 'bg-brand-sage/20 border-brand-sage text-brand-sage' : 'bg-brand-surface border-brand-hover text-white hover:bg-brand-hover'}`}
              >
                {isWatchlist(String(id)) ? <Check size={18} /> : <Plus size={18} />}
                {isWatchlist(String(id)) ? 'In Watchlist' : 'Watchlist'}
              </button>
              <button
                onClick={() => toggleFavorite(movieForCard)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-colors border ${isFavorite(String(id)) ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-brand-surface border-brand-hover text-white hover:bg-brand-hover'}`}
              >
                <Heart size={18} fill={isFavorite(String(id)) ? 'currentColor' : 'none'} />
                {isFavorite(String(id)) ? 'Favorited' : 'Favorite'}
              </button>
            </div>

            {/* CAST */}
            {cast.length > 0 && (
              <div>
                <h3 className="text-lg font-bold mb-4 text-white">Top Cast</h3>
                <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
                  {cast.map(actor => (
                    <div key={actor.id} className="text-center flex-shrink-0 w-16 sm:w-20">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full overflow-hidden border-2 border-brand-hover bg-brand-surface mb-1">
                        <img
                          src={actor.profile_path ? getImageUrl(actor.profile_path, 'w185') : 'https://via.placeholder.com/64x64?text=?'}
                          alt={actor.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs text-gray-300 truncate w-full font-medium">{actor.name}</p>
                      <p className="text-xs text-gray-500 truncate w-full">{actor.character}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TRAILER */}
        {trailer && (
          <div className="mt-14">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-brand-emerald rounded-full"></span>
              Official Trailer
            </h2>
            <div className="rounded-2xl overflow-hidden max-w-3xl shadow-2xl">
              <iframe
                src={`https://www.youtube.com/embed/${trailer.key}`}
                title="Trailer"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full aspect-video"
              />
            </div>
          </div>
        )}

        {/* TMDB REVIEWS SECTION */}
        <div className="mt-14 max-w-3xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <MessageSquare size={20} className="text-brand-emerald" />
            TMDB Community Reviews ({reviews.length})
          </h2>

          {reviews.length === 0 ? (
            <p className="text-gray-400 text-sm">No community reviews found on TMDB for this title.</p>
          ) : (
            <div className="space-y-4">
              {reviews.slice(0, visibleReviewsCount).map(rev => (
                <div key={rev.id} className="bg-brand-surface/60 border border-brand-hover/60 p-5 rounded-2xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-sm text-brand-emerald flex items-center gap-2">
                      @{rev.author}
                      {rev.author_details?.rating && (
                        <span className="bg-brand-emerald/20 text-brand-emerald text-xs px-2 py-0.5 rounded font-semibold">
                          ★ {rev.author_details.rating} / 10
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(rev.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed line-clamp-6">
                    {rev.content}
                  </p>
                </div>
              ))}

              {visibleReviewsCount < reviews.length && (
                <div className="text-center pt-4">
                  <button
                    onClick={() => setVisibleReviewsCount(prev => prev + 3)}
                    className="px-6 py-2.5 bg-brand-surface hover:bg-brand-hover border border-brand-hover text-white font-bold rounded-xl transition-colors text-sm cursor-pointer shadow-md"
                  >
                    Load More Reviews ({reviews.length - visibleReviewsCount} remaining)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SIMILAR (Relevance-Enhanced & Auto Infinite Scroll) */}
        {similarMovies.length > 0 && (
          <div className="mt-14 mb-12">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="w-1 h-6 bg-brand-emerald rounded-full"></span>
              You Might Also Like
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {similarMovies.map(m => (
                <MovieCard key={m.id} movie={{
                  id: String(m.id),
                  title: m.title || m.name,
                  posterUrl: getImageUrl(m.poster_path, 'w500'),
                  backdropUrl: getImageUrl(m.backdrop_path, 'original'),
                  rating: m.vote_average,
                  mediaType,
                }} />
              ))}
            </div>

            {loadingSimilar && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-emerald"></div>
              </div>
            )}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `.scrollbar-hide::-webkit-scrollbar{display:none}.scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}`}} />
    </div>
  );
}
