import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { fetchMovies, getImageUrl } from '../utils/tmdb';
import MovieCard from '../components/MovieCard';
import { Play, Info, ChevronLeft, ChevronRight } from 'lucide-react';

const ALL_CATEGORIES = [
  { title: '🔥 Trending This Week', fetch: () => fetchMovies.fetchTrending() },
  { title: '🎬 Hollywood Blockbusters', fetch: () => fetchMovies.fetchActionMovies() },
  { title: '💃 Bollywood Hits', fetch: () => fetchMovies.fetchBollywood() },
  { title: '🍿 Top Rated Movies', fetch: () => fetchMovies.fetchTopRated() },
  { title: '🔪 Horror & Thrillers', fetch: () => fetchMovies.fetchHorrorMovies() },
  { title: '😂 Comedy Hits', fetch: () => fetchMovies.fetchComedyMovies() },
  { title: '💕 Romance & Drama', fetch: () => fetchMovies.fetchRomanceMovies() },
  { title: '🎌 Japanese Anime', fetch: () => fetchMovies.fetchAnime() },
  { title: '📺 Netflix Originals', fetch: () => fetchMovies.fetchNetflixOriginals() },
  { title: '🎙️ Documentaries', fetch: () => fetchMovies.fetchDocumentaries() },
  { title: '✨ You May Also Like', fetch: () => fetchMovies.fetchTopRated() },
];

function MovieRow({ title, fetchFn }) {
  const [items, setItems] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchFn().then(res => setItems(res.data.results || [])).catch(() => {});
  }, [fetchFn]);

  const scroll = (dir) => {
    scrollRef.current.scrollBy({ left: dir * 700, behavior: 'smooth' });
  };

  if (!items.length) return null;

  return (
    <section className="mb-8">
      <h2 className="text-lg sm:text-xl font-bold text-white mb-3 pl-2 flex items-center gap-2">
        <span className="w-1 h-5 bg-brand-emerald rounded-full"></span>
        {title}
      </h2>
      <div className="relative group">
        <button onClick={() => scroll(-1)} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/80 text-white p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-brand-emerald hover:text-black shadow-lg">
          <ChevronLeft size={22} />
        </button>
        <div ref={scrollRef} className="flex overflow-x-auto space-x-3 sm:space-x-4 pb-4 pt-1 px-2 -mx-2 scrollbar-hide snap-x">
          {items.map(movie => (
            <div key={movie.id} className="min-w-[130px] sm:min-w-[160px] md:min-w-[190px] w-[130px] sm:w-[160px] md:w-[190px] snap-start flex-shrink-0">
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
          ))}
        </div>
        <button onClick={() => scroll(1)} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/80 text-white p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-brand-emerald hover:text-black shadow-lg">
          <ChevronRight size={22} />
        </button>
      </div>
    </section>
  );
}

export default function Home({ type = 'all' }) {
  const [heroList, setHeroList] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [visibleRowsCount,setVisibleRowsCount] = useState(4); // Infinite scrolling pagination
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const location = useLocation();

  const searchQuery = new URLSearchParams(location.search).get('search');

  // Fetch trending for hero slider
  useEffect(() => {
    if (searchQuery) {
      setSearching(true);
      fetchMovies.searchMulti(searchQuery)
        .then(res => setSearchResults(res.data.results || []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    } else {
      fetchMovies.fetchTrending().then(res => {
        const items = (res.data.results || []).filter(m => m.backdrop_path).slice(0, 8);
        setHeroList(items);
      }).catch(() => {});
    }
  }, [searchQuery]);

  // Slideshow timer for Banner (changes every 2 seconds as requested)
  useEffect(() => {
    if (heroList.length === 0 || searchQuery) return;
    const interval = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % heroList.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [heroList, searchQuery]);

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
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-10 min-h-screen">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <span className="w-1 h-6 bg-brand-emerald rounded-full"></span>
          {searching ? 'Searching...' : `Results for "${searchQuery}"`}
        </h2>
        {searching ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-emerald"></div>
          </div>
        ) : searchResults?.length === 0 ? (
          <p className="text-gray-400 py-20 text-center text-lg">No movies or TV shows found matching your query.</p>
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
    );
  }

  return (
    <div className="min-h-screen bg-brand-background">
      {/* ANIMATED SLIDESHOW HERO BANNER */}
      {!searchQuery && hero && (
        <div className="relative w-full h-[60vh] sm:h-[75vh] md:h-[85vh] flex items-end md:items-center overflow-hidden">
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
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/50 text-white p-3 rounded-full hover:bg-brand-emerald hover:text-black transition-colors hidden sm:block"
          >
            <ChevronLeft size={24} />
          </button>
          <button 
            onClick={() => setHeroIndex(prev => (prev + 1) % heroList.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/50 text-white p-3 rounded-full hover:bg-brand-emerald hover:text-black transition-colors hidden sm:block"
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
                  <span className="text-yellow-400 font-bold text-sm">⭑ {parseFloat(hero.vote_average).toFixed(1)}</span>
                )}
                {(hero.release_date || hero.first_air_date) && (
                  <span className="text-gray-300 text-sm">{new Date(hero.release_date || hero.first_air_date).getFullYear()}</span>
                )}
              </div>
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-white mb-4 leading-tight drop-shadow-md">
                {hero.title || hero.name}
              </h1>
              <p className="text-gray-200 text-sm sm:text-base md:text-lg line-clamp-3 mb-6 drop-shadow">
                {hero.overview}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to={`/watch/${hero.id}?type=${hero.media_type || (hero.name ? 'tv' : 'movie')}`}
                  className="bg-brand-emerald hover:bg-emerald-400 text-black font-extrabold px-7 py-3 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-brand-emerald/25 text-base"
                >
                  <Play size={20} fill="currentColor" />
                  Play Now
                </Link>
                <Link
                  to={`/movie/${hero.id}?type=${hero.media_type || (hero.name ? 'tv' : 'movie')}`}
                  className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md font-bold px-7 py-3 rounded-xl flex items-center gap-2 transition-colors border border-white/20 text-base"
                >
                  <Info size={20} />
                  More Info
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY ROWS WITH INFINITE SCROLLING */}
      <div className={`max-w-[1400px] mx-auto px-4 sm:px-6 pb-24 ${!searchQuery && hero ? '-mt-24 relative z-20' : 'pt-8'}`}>
        {activeRows.map((row, i) => (
          <MovieRow key={i} title={row.title} fetchFn={row.fetch} />
        ))}

        {visibleRowsCount < categories.length && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400 animate-pulse">Loading more categories...</p>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
