import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { fetchMovies, getImageUrl } from '../utils/tmdb';
import MovieCard from '../components/MovieCard';

export default function CategoryPage() {
  const { category } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const sortBy = searchParams.get('sort') || 'popularity.desc';
  const year = searchParams.get('year') || '';

  const genreMap = {
    action: 28,
    adventure: 12,
    animation: 16,
    comedy: 35,
    crime: 80,
    drama: 18,
    fantasy: 14,
    horror: 27,
    mystery: 9648,
    romance: 10749,
    scifi: 878,
    thriller: 53,
    western: 37,
  };

  const categoryTitles = {
    action: 'Action Movies & Series',
    adventure: 'Adventure Movies & Series',
    animation: 'Animation Movies & Series',
    comedy: 'Comedy Movies & Series',
    crime: 'Crime Movies & Series',
    drama: 'Drama Movies & Series',
    fantasy: 'Fantasy Movies & Series',
    horror: 'Horror Movies & Series',
    mystery: 'Mystery Movies & Series',
    romance: 'Romance Movies & Series',
    scifi: 'Sci-Fi Movies & Series',
    thriller: 'Thriller Movies & Series',
    western: 'Western Movies & Series',
    movies: 'Movies',
    tv: 'TV Series',
    anime: 'Japanese Anime',
    kdrama: 'Korean Dramas (K-Drama)',
    bangla: 'Bangla Movies',
    award_winning: 'Award Winning & Masterpieces',
    top_rated: 'Best Rated Movies',
    adult: '18+ Adult Movies & Series',
  };

  const title = categoryTitles[category] || 'Browse Collection';

  useEffect(() => {
    document.title = `${title} — SnM Flix`;
    let metaDesc = document.querySelector("meta[name='description']");
    if (metaDesc) {
      metaDesc.setAttribute("content", `Watch and stream ${title} online for free in high quality on SnM Flix. Browse trending and top rated titles.`);
    }
  }, [title]);

  const getFetchFunction = (cat, p, s, y) => {
    if (genreMap[cat]) {
      return fetchMovies.fetchByGenre(genreMap[cat], p, s, y);
    }
    switch (cat) {
      case 'movies': return fetchMovies.fetchActionMovies(p, s, y);
      case 'tv': return fetchMovies.fetchNetflixOriginals(p);
      case 'anime': return fetchMovies.fetchAnime(p, s, y);
      case 'kdrama': return fetchMovies.fetchKdrama(p, s, y);
      case 'bangla': return fetchMovies.fetchBangla(p, s, y);
      case 'award_winning': return fetchMovies.fetchAwardWinning(p, s, y);
      case 'top_rated': return fetchMovies.fetchTopRated(p, y);
      case 'adult': return fetchMovies.fetchAdult(p, s, y);
      default: return fetchMovies.fetchTrending(p);
    }
  };

  const processResults = (rawResults) => {
    return rawResults;
  };

  // Fetch initial movies when category, sort, or year changes
  useEffect(() => {
    setLoading(true);
    setPage(1);
    setHasMore(true);

    const fetchFn = getFetchFunction(category, 1, sortBy, year);

    Promise.resolve(fetchFn)
      .then(res => {
        const results = processResults(res.data.results || []);
        setMovies(results);
        if (results.length === 0 || page >= (res.data.total_pages || 1)) {
          setHasMore(false);
        }
      })
      .catch(() => setMovies([]))
      .finally(() => setLoading(false));
  }, [category, sortBy, year]);

  // Infinite Scroll listener
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 600) {
        if (!loadingMore && hasMore && !loading) {
          loadMoreMovies();
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadingMore, hasMore, loading, page, category, sortBy, year]);

  const loadMoreMovies = () => {
    setLoadingMore(true);
    const nextPage = page + 1;

    const fetchFn = getFetchFunction(category, nextPage, sortBy, year);

    Promise.resolve(fetchFn)
      .then(res => {
        const newResults = processResults(res.data.results || []);
        if (newResults.length === 0 || nextPage >= (res.data.total_pages || 50)) {
          setHasMore(false);
        }
        setMovies(prev => [...prev, ...newResults]);
        setPage(nextPage);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  const handleSortChange = (newSort) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('sort', newSort);
    setSearchParams(newParams);
  };

  const handleYearChange = (newYear) => {
    const newParams = new URLSearchParams(searchParams);
    if (newYear) newParams.set('year', newYear);
    else newParams.delete('year');
    setSearchParams(newParams);
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 min-h-screen">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
          <span className="w-1.5 h-7 bg-brand-emerald rounded-full"></span>
          {title}
        </h1>

        {/* Clean Sort & Year Filtering Controls without unnecessary box/borders */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
          <div className="flex items-center gap-2">
            <span>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="bg-brand-surface text-white text-xs sm:text-sm rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="popularity.desc">Most Popular / Watched</option>
              <option value="popularity.asc">Least Popular</option>
              <option value="vote_average.desc">Highest Rated (Best)</option>
              <option value="vote_average.asc">Lowest Rated</option>
              <option value="primary_release_year.desc">Newest Release</option>
              <option value="primary_release_year.asc">Oldest Release</option>
              <option value="original_title.asc">Title (A - Z)</option>
              <option value="original_title.desc">Title (Z - A)</option>
              <option value="vote_count.desc">Most Voted</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span>Year:</span>
            <select
              value={year}
              onChange={(e) => handleYearChange(e.target.value)}
              className="bg-brand-surface text-white text-xs sm:text-sm rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="">All Years</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
              <option value="2022">2022</option>
              <option value="2021">2021</option>
              <option value="2020">2020</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-emerald"></div>
        </div>
      ) : movies.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <p className="text-lg">No titles found in this category.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {movies.filter(m => m.poster_path).map((movie, idx) => (
              <MovieCard key={`${movie.id}-${idx}`} movie={{
                id: String(movie.id),
                title: movie.title || movie.name,
                posterUrl: getImageUrl(movie.poster_path, 'w500'),
                backdropUrl: getImageUrl(movie.backdrop_path, 'original'),
                rating: movie.vote_average,
                releaseDate: movie.release_date || movie.first_air_date,
                mediaType: movie.media_type || (movie.name && !movie.title ? 'tv' : 'movie'),
              }} />
            ))}
          </div>

          {loadingMore && (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-emerald"></div>
            </div>
          )}

          {!hasMore && movies.length > 0 && (
            <div className="text-center py-10 text-gray-500 text-sm font-medium">
              You've reached the end of the collection.
            </div>
          )}
        </>
      )}
    </div>
  );
}
