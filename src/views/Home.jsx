import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Play, Info, ChevronLeft, ChevronRight, Star, Flame, Sparkles, Tv, Film } from 'lucide-react';
import { fetchMovies, getImageUrl } from '../utils/tmdb';
import MovieCard from '../components/MovieCard';
import { useAuth } from '../context/AuthContext';

const ALL_CATEGORIES = [
  { title: "Trending Now", fetchFn: (p) => fetchMovies.fetchTrending(p) },
  { title: "Bangla Movies", fetchFn: (p) => fetchMovies.fetchBangla(p) },
  { title: "Bangla TV Shows", fetchFn: (p) => fetchMovies.fetchBanglaTv(p) },
  { title: "Top Rated Movies", fetchFn: (p) => fetchMovies.fetchTopRated(p) },
  { title: "Action Blockbusters", fetchFn: (p) => fetchMovies.fetchActionMovies(p) },
  { title: "Comedy Hits", fetchFn: (p) => fetchMovies.fetchComedyMovies(p) },
  { title: "Horror Thrillers", fetchFn: (p) => fetchMovies.fetchHorrorMovies(p) },
  { title: "Romance Specials", fetchFn: (p) => fetchMovies.fetchRomanceMovies(p) },
  { title: "Top Anime", fetchFn: (p) => fetchMovies.fetchAnime(p) },
  { title: "Documentaries", fetchFn: (p) => fetchMovies.fetchDocumentaries(p) },
  { title: "Bollywood Hits", fetchFn: (p) => fetchMovies.fetchBollywood(p) },
];

function CategoryRow({ title, fetchFn }) {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchFn(1)
      .then(res => setMovies(res.data.results || []))
      .catch(() => setMovies([]))
      .finally(() => setLoading(false));
  }, [fetchFn]);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      scrollRef.current.scrollTo({
        left: direction === 'left' ? scrollLeft - clientWidth * 0.75 : scrollLeft + clientWidth * 0.75,
        behavior: 'smooth'
      });
    }
  };

  if (!loading && movies.length === 0) return null;

  return (
    <div className="mb-8 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto">
      <h2 className="text-lg sm:text-xl font-extrabold text-white mb-3 flex items-center gap-2.5">
        <span className="w-1 h-5 bg-brand-emerald rounded-full"></span>
        {title}
      </h2>
      <div className="relative group">
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/80 text-white p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-brand-emerald hover:text-black shadow-lg cursor-pointer hidden sm:flex items-center justify-center"
        >
          <ChevronLeft size={22} />
        </button>
        <div ref={scrollRef} className="flex overflow-x-auto space-x-3 sm:space-x-4 pb-4 pt-1 px-1 scrollbar-hide snap-x">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="min-w-[140px] sm:min-w-[180px] h-[210px] sm:h-[270px] bg-brand-surface animate-pulse rounded-xl flex-shrink-0" />
            ))
          ) : (
            movies.filter(m => m.poster_path).map(movie => (
              <div key={movie.id} className="min-w-[140px] sm:min-w-[180px] w-[140px] sm:w-[180px] snap-start flex-shrink-0">
                <MovieCard movie={{
                  id: String(movie.id),
                  title: movie.title || movie.name,
                  posterUrl: getImageUrl(movie.poster_path, 'w500'),
                  backdropUrl: getImageUrl(movie.backdrop_path, 'original'),
                  rating: movie.vote_average,
                  releaseDate: movie.release_date || movie.first_air_date,
                  mediaType: movie.media_type || (movie.name ? 'tv' : 'movie'),
                }} />
              </div>
            ))
          )}
        </div>
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/80 text-white p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-brand-emerald hover:text-black shadow-lg cursor-pointer hidden sm:flex items-center justify-center"
        >
          <ChevronRight size={22} />
        </button>
      </div>
    </div>
  );
}

function ContinueWatchingRow({ watchHistory, onRemoveHistory }) {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      scrollRef.current.scrollTo({
        left: direction === -1 ? scrollLeft - clientWidth * 0.75 : scrollLeft + clientWidth * 0.75,
        behavior: 'smooth'
      });
    }
  };

  if (!watchHistory || watchHistory.length === 0) return null;

  return (
    <section className="mb-8 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto">
      <h2 className="text-lg sm:text-xl font-extrabold text-white mb-3 flex items-center gap-2.5">
        <span className="w-1 h-5 bg-brand-emerald rounded-full"></span>
        Continue Watching
      </h2>
      <div className="relative group">
        <button onClick={() => scroll(-1)} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/80 text-white p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-brand-emerald hover:text-black shadow-lg hidden sm:flex items-center justify-center">
          <ChevronLeft size={22} />
        </button>
        <div ref={scrollRef} className="flex overflow-x-auto space-x-3 sm:space-x-4 pb-4 pt-1 px-1 scrollbar-hide snap-x">
          {watchHistory.map(movie => (
            <div key={movie.id} className="min-w-[140px] sm:min-w-[180px] w-[140px] sm:w-[180px] snap-start flex-shrink-0">
              <MovieCard movie={movie} onRemove={onRemoveHistory} />
            </div>
          ))}
        </div>
        <button onClick={() => scroll(1)} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/80 text-white p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-brand-emerald hover:text-black shadow-lg hidden sm:flex items-center justify-center">
          <ChevronRight size={22} />
        </button>
      </div>
    </section>
  );
}

export default function Home({ type = 'all' }) {
  const [heroList, setHeroList] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [visibleRowsCount, setVisibleRowsCount] = useState(4); // Infinite scrolling pagination
  const [searchResults, setSearchResults] = useState(null);
  const [fallbackResults, setFallbackResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const location = useLocation();
  const { watchHistory, removeHistory } = useAuth();

  const searchQuery = new URLSearchParams(location.search).get('search');

  // Fetch search results and relevant recommendations based on top search match
  useEffect(() => {
    if (searchQuery) {
      setSearching(true);
      fetchMovies.searchMulti(searchQuery)
        .then(async (searchRes) => {
          const results = searchRes.data.results || [];
          setSearchResults(results);

          if (results.length > 0) {
            const topMatch = results[0];
            const topId = topMatch.id;
            const topType = topMatch.media_type || (topMatch.name ? 'tv' : 'movie');

            try {
              const recRes = await fetchMovies.fetchRecommendations(topId, topType);
              const recs = recRes.data.results || [];
              if (recs.length > 0) {
                setFallbackResults(recs);
              } else {
                const simRes = await fetchMovies.fetchSimilar(topId, topType);
                setFallbackResults(simRes.data.results || []);
              }
            } catch (err) {
              setFallbackResults([]);
            }
          } else {
            const trendRes = await fetchMovies.fetchTrending().catch(() => ({ data: { results: [] } }));
            setFallbackResults(trendRes.data.results || []);
          }
        })
        .finally(() => setSearching(false));
    } else {
      fetchMovies.fetchTrending().then(res => {
        const items = (res.data.results || []).filter(m => m.backdrop_path).slice(0, 8);
        setHeroList(items);
      }).catch(() => {});
    }
  }, [searchQuery]);

  // Slideshow timer for Banner (changes every 4 seconds, pauses on hover)
  useEffect(() => {
    if (heroList.length === 0 || searchQuery || heroPaused) return;
    const interval = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % heroList.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [heroList, searchQuery, heroPaused]);

  // Infinite scroll trigger when reaching bottom of page
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        setVisibleRowsCount(prev => Math.min(prev + 3, ALL_CATEGORIES.length));
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const hero = heroList[heroIndex];

  let categories = ALL_CATEGORIES;
  if (type === 'movies') {
    categories = ALL_CATEGORIES.filter(c => !c.title.includes('Anime') && !c.title.includes('Netflix Originals'));
  } else if (type === 'tv') {
    categories = ALL_CATEGORIES.filter(c => c.title.includes('Anime') || c.title.includes('Netflix Originals') || c.title.includes('Trending'));
  }

  const activeRows = categories.slice(0, visibleRowsCount);

  if (searchQuery) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-10 min-h-screen space-y-12">
        <div>
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-brand-emerald rounded-full"></span>
            {searching ? 'Searching...' : `Results for "${searchQuery}"`}
          </h2>
          {searching ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-emerald"></div>
            </div>
          ) : searchResults?.length === 0 ? (
            <p className="text-gray-400 py-6 text-base">No direct matches found for "{searchQuery}". See relevant recommendations below.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
              {searchResults?.filter(m => m.poster_path).map(movie => (
                <MovieCard key={movie.id} movie={{
                  id: String(movie.id),
                  title: movie.title || movie.name,
                  posterUrl: getImageUrl(movie.poster_path, 'w500'),
                  backdropUrl: getImageUrl(movie.backdrop_path, 'original'),
                  rating: movie.vote_average,
                  releaseDate: movie.release_date || movie.first_air_date,
                  mediaType: movie.media_type || (movie.name ? 'tv' : 'movie'),
                }} />
              ))}
            </div>
          )}
        </div>

        {/* Relevant Movies section based on top search match */}
        {fallbackResults.length > 0 && (
          <div>
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="w-1 h-6 bg-brand-emerald rounded-full"></span>
              Relevant to "{searchQuery}"
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
              {fallbackResults.filter(m => m.poster_path).slice(0, 10).map(movie => (
                <MovieCard key={movie.id} movie={{
                  id: String(movie.id),
                  title: movie.title || movie.name,
                  posterUrl: getImageUrl(movie.poster_path, 'w500'),
                  backdropUrl: getImageUrl(movie.backdrop_path, 'original'),
                  rating: movie.vote_average,
                  releaseDate: movie.release_date || movie.first_air_date,
                  mediaType: movie.media_type || (movie.name ? 'tv' : 'movie'),
                }} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-background">
      {/* ANIMATED SLIDESHOW HERO BANNER */}
      {!searchQuery && hero && (
        <div
          onMouseEnter={() => setHeroPaused(true)}
          onMouseLeave={() => setHeroPaused(false)}
          className="relative w-full h-[60vh] sm:h-[75vh] md:h-[85vh] flex items-end md:items-center overflow-hidden"
        >
          <div className="absolute inset-0">
            <img
              key={hero.id}
              src={getImageUrl(hero.backdrop_path, 'original')}
              alt={hero.title || hero.name}
              className="w-full h-full object-cover object-top transition-opacity duration-1000 opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-background via-brand-background/40 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-brand-background via-brand-background/50 to-transparent"></div>
          </div>

          {/* Manual Left/Right Hero controls */}
          <button
            onClick={() => setHeroIndex(prev => (prev - 1 + heroList.length) % heroList.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/50 text-white p-3 rounded-full hover:bg-brand-emerald hover:text-black transition-colors hidden sm:block cursor-pointer"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={() => setHeroIndex(prev => (prev + 1) % heroList.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/50 text-white p-3 rounded-full hover:bg-brand-emerald hover:text-black transition-colors hidden sm:block cursor-pointer"
          >
            <ChevronRight size={24} />
          </button>

          <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 w-full pb-12 md:pb-0">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-brand-emerald text-black text-xs font-bold px-2.5 py-1 rounded uppercase">
                  Trending #{heroIndex + 1}
                </span>
                {hero.vote_average > 0 && (
                  <span className="text-yellow-400 font-bold text-sm flex items-center gap-1">
                    <Star size={14} className="text-yellow-400 fill-current" /> {parseFloat(hero.vote_average).toFixed(1)}
                  </span>
                )}
                {(hero.release_date || hero.first_air_date) && (
                  <span className="text-gray-300 text-sm">{new Date(hero.release_date || hero.first_air_date).getFullYear()}</span>
                )}
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold text-white mb-4 leading-tight">
                {hero.title || hero.name}
              </h1>
              <p className="text-gray-300 text-sm sm:text-base line-clamp-3 mb-6 leading-relaxed">
                {hero.overview}
              </p>
              <div className="flex items-center gap-4">
                <Link
                  to={`/watch/${hero.id}?type=${hero.media_type || (hero.title ? 'movie' : 'tv')}`}
                  className="bg-brand-emerald text-black px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-400 transition-colors shadow-lg shadow-brand-emerald/20 cursor-pointer"
                >
                  <Play size={20} fill="currentColor" /> Watch Now
                </Link>
                <Link
                  to={`/movie/${hero.id}?type=${hero.media_type || (hero.title ? 'movie' : 'tv')}`}
                  className="bg-brand-surface/80 backdrop-blur-md text-white border border-brand-hover px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-brand-hover transition-colors cursor-pointer"
                >
                  <Info size={20} /> Details
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="py-8 space-y-4">
        {/* Continue Watching Section */}
        <ContinueWatchingRow watchHistory={watchHistory} onRemoveHistory={removeHistory} />

        {/* Dynamic Category Rows */}
        {activeRows.map((cat, idx) => (
          <CategoryRow key={idx} title={cat.title} fetchFn={cat.fetchFn} />
        ))}
      </div>
    </div>
  );
}
