import axios from 'axios';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || 'dd09381517f08b551e2162a3826b2695';
const BASE_URL = 'https://api.themoviedb.org/3';

const tmdbApi = axios.create({
  baseURL: BASE_URL,
  params: {
    api_key: TMDB_API_KEY,
  },
});

export const getImageUrl = (path, size = 'original') => {
  if (!path) return 'https://via.placeholder.com/500x750?text=No+Image';
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

export const fetchMovies = {
  fetchTrending: (page = 1) => tmdbApi.get(`/trending/all/week?page=${page}`),
  fetchNetflixOriginals: (page = 1) => tmdbApi.get(`/discover/tv?with_networks=213&page=${page}`),
  fetchTopRated: (page = 1, year = '') => {
    let url = `/movie/top_rated?page=${page}`;
    if (year) url += `&primary_release_year=${year}`;
    return tmdbApi.get(url);
  },
  fetchActionMovies: (page = 1, sort = 'popularity.desc', year = '') => {
    let url = `/discover/movie?with_genres=28&sort_by=${sort}&page=${page}`;
    if (year) url += `&primary_release_year=${year}`;
    return tmdbApi.get(url);
  },
  fetchComedyMovies: (page = 1, sort = 'popularity.desc', year = '') => {
    let url = `/discover/movie?with_genres=35&sort_by=${sort}&page=${page}`;
    if (year) url += `&primary_release_year=${year}`;
    return tmdbApi.get(url);
  },
  fetchHorrorMovies: (page = 1, sort = 'popularity.desc', year = '') => {
    let url = `/discover/movie?with_genres=27&sort_by=${sort}&page=${page}`;
    if (year) url += `&primary_release_year=${year}`;
    return tmdbApi.get(url);
  },
  fetchRomanceMovies: (page = 1, sort = 'popularity.desc', year = '') => {
    let url = `/discover/movie?with_genres=10749&sort_by=${sort}&page=${page}`;
    if (year) url += `&primary_release_year=${year}`;
    return tmdbApi.get(url);
  },
  fetchDocumentaries: (page = 1, sort = 'popularity.desc', year = '') => {
    let url = `/discover/movie?with_genres=99&sort_by=${sort}&page=${page}`;
    if (year) url += `&primary_release_year=${year}`;
    return tmdbApi.get(url);
  },
  fetchBollywood: (page = 1, sort = 'popularity.desc', year = '') => {
    let url = `/discover/movie?with_original_language=hi&sort_by=${sort}&page=${page}`;
    if (year) url += `&primary_release_year=${year}`;
    return tmdbApi.get(url);
  },
  fetchBangla: async (page = 1, sort = 'popularity.desc', year = '') => {
    try {
      const [resBn, resBengali, resBangla] = await Promise.all([
        tmdbApi.get(`/discover/movie?with_original_language=bn&sort_by=${sort}&page=${page}${year ? `&primary_release_year=${year}` : ''}`).catch(() => ({ data: { results: [] } })),
        tmdbApi.get(`/search/movie?query=Bengali&page=${page}`).catch(() => ({ data: { results: [] } })),
        tmdbApi.get(`/search/movie?query=Bangla&page=${page}`).catch(() => ({ data: { results: [] } })),
      ]);

      const combined = [
        ...(resBn.data.results || []),
        ...(resBengali.data.results || []),
        ...(resBangla.data.results || [])
      ];

      const uniqueMap = new Map();
      combined.forEach(m => {
        if (m.id && m.poster_path && !uniqueMap.has(m.id)) {
          uniqueMap.set(m.id, m);
        }
      });

      const results = Array.from(uniqueMap.values());
      return { data: { results, total_pages: Math.max(resBn.data.total_pages || 1, 1) } };
    } catch (e) {
      return tmdbApi.get(`/discover/movie?with_original_language=bn&page=${page}`);
    }
  },
  fetchBanglaTv: async (page = 1) => {
    try {
      const [resBn, resSearch] = await Promise.all([
        tmdbApi.get(`/discover/tv?with_original_language=bn&sort_by=popularity.desc&page=${page}`).catch(() => ({ data: { results: [] } })),
        tmdbApi.get(`/search/tv?query=Bangla&page=${page}`).catch(() => ({ data: { results: [] } })),
      ]);

      const combined = [
        ...(resBn.data.results || []),
        ...(resSearch.data.results || [])
      ];

      const uniqueMap = new Map();
      combined.forEach(m => {
        if (m.id && m.poster_path && !uniqueMap.has(m.id)) {
          uniqueMap.set(m.id, m);
        }
      });

      const results = Array.from(uniqueMap.values());
      return { data: { results, total_pages: Math.max(resBn.data.total_pages || 1, 1) } };
    } catch (e) {
      return tmdbApi.get(`/discover/tv?with_original_language=bn&page=${page}`);
    }
  },
  fetchAdult: async (page = 1, sort = 'popularity.desc', year = '') => {
    try {
      const movieUrl = `/discover/movie?include_adult=true&with_genres=10749,53&sort_by=${sort}&page=${page}${year ? `&primary_release_year=${year}` : ''}`;
      const tvUrl = `/discover/tv?include_adult=true&with_genres=10749,18&sort_by=${sort}&page=${page}${year ? `&first_air_date_year=${year}` : ''}`;
      const [resMovie, resTv] = await Promise.all([
        tmdbApi.get(movieUrl).catch(() => ({ data: { results: [] } })),
        tmdbApi.get(tvUrl).catch(() => ({ data: { results: [] } })),
      ]);
      const movies = (resMovie.data.results || []).map(m => ({ ...m, media_type: 'movie' }));
      const tvShows = (resTv.data.results || []).map(t => ({ ...t, media_type: 'tv' }));
      const combined = [];
      const maxLen = Math.max(movies.length, tvShows.length);
      for (let i = 0; i < maxLen; i++) {
        if (movies[i]) combined.push(movies[i]);
        if (tvShows[i]) combined.push(tvShows[i]);
      }
      return { data: { results: combined, total_pages: Math.max(resMovie.data.total_pages || 1, resTv.data.total_pages || 1) } };
    } catch(e) {
      return tmdbApi.get(`/discover/movie?include_adult=true&with_genres=10749,53&page=${page}`);
    }
  },
  fetchAnime: (page = 1, sort = 'popularity.desc', year = '') => {
    let url = `/discover/tv?with_genres=16&with_original_language=ja&sort_by=${sort}&page=${page}`;
    if (year) url += `&first_air_date_year=${year}`;
    return tmdbApi.get(url);
  },
  fetchKdrama: (page = 1, sort = 'popularity.desc', year = '') => {
    let url = `/discover/tv?with_original_language=ko&with_genres=18&sort_by=${sort}&page=${page}`;
    if (year) url += `&first_air_date_year=${year}`;
    return tmdbApi.get(url);
  },
  fetchThriller: async (page = 1, sort = 'popularity.desc', year = '') => {
    try {
      const movieUrl = `/discover/movie?with_genres=53&sort_by=${sort}&page=${page}${year ? `&primary_release_year=${year}` : ''}`;
      const tvUrl = `/discover/tv?with_genres=9648,80&sort_by=${sort}&page=${page}${year ? `&first_air_date_year=${year}` : ''}`;
      const [resMovie, resTv] = await Promise.all([
        tmdbApi.get(movieUrl).catch(() => ({ data: { results: [] } })),
        tmdbApi.get(tvUrl).catch(() => ({ data: { results: [] } })),
      ]);
      const movies = (resMovie.data.results || []).map(m => ({ ...m, media_type: 'movie' }));
      const tvShows = (resTv.data.results || []).map(t => ({ ...t, media_type: 'tv' }));
      const combined = [];
      const maxLen = Math.max(movies.length, tvShows.length);
      for (let i = 0; i < maxLen; i++) {
        if (movies[i]) combined.push(movies[i]);
        if (tvShows[i]) combined.push(tvShows[i]);
      }
      return { data: { results: combined, total_pages: Math.max(resMovie.data.total_pages || 1, resTv.data.total_pages || 1) } };
    } catch(e) {
      return tmdbApi.get(`/discover/movie?with_genres=53&page=${page}`);
    }
  },
  fetchHorror: (page = 1, sort = 'popularity.desc', year = '') => {
    let url = `/discover/movie?with_genres=27&sort_by=${sort}&page=${page}`;
    if (year) url += `&primary_release_year=${year}`;
    return tmdbApi.get(url);
  },
  fetchRomance: (page = 1, sort = 'popularity.desc', year = '') => {
    let url = `/discover/movie?with_genres=10749&sort_by=${sort}&page=${page}`;
    if (year) url += `&primary_release_year=${year}`;
    return tmdbApi.get(url);
  },
  fetchRomcom: (page = 1, sort = 'popularity.desc', year = '') => {
    let url = `/discover/movie?with_genres=35,10749&sort_by=${sort}&page=${page}`;
    if (year) url += `&primary_release_year=${year}`;
    return tmdbApi.get(url);
  },
  fetchByGenre: async (genreId, page = 1, sort = 'popularity.desc', year = '') => {
    try {
      let movieUrl = `/discover/movie?with_genres=${genreId}&sort_by=${sort}&page=${page}`;
      let tvUrl = `/discover/tv?with_genres=${genreId}&sort_by=${sort}&page=${page}`;

      if (genreId === 12) {
        movieUrl += `&without_genres=28,27`;
        tvUrl += `&without_genres=10759,10765`;
      } else if (genreId === 35) {
        movieUrl += `&without_genres=27,53`;
        tvUrl += `&without_genres=10765`;
      } else if (genreId === 27) {
        movieUrl += `&without_genres=35,16`;
      } else if (genreId === 10749) {
        movieUrl += `&without_genres=27,28`;
      } else if (genreId === 53) {
        movieUrl += `&without_genres=35,16`;
      }

      if (year) {
        movieUrl += `&primary_release_year=${year}`;
        tvUrl += `&first_air_date_year=${year}`;
      }

      const [resMovie, resTv] = await Promise.all([
        tmdbApi.get(movieUrl).catch(() => ({ data: { results: [] } })),
        tmdbApi.get(tvUrl).catch(() => ({ data: { results: [] } })),
      ]);

      const movies = (resMovie.data.results || []).map(m => ({ ...m, media_type: 'movie' }));
      const tvShows = (resTv.data.results || []).map(t => ({ ...t, media_type: 'tv' }));

      const combined = [];
      const maxLen = Math.max(movies.length, tvShows.length);
      for (let i = 0; i < maxLen; i++) {
        if (movies[i]) combined.push(movies[i]);
        if (tvShows[i]) combined.push(tvShows[i]);
      }

      const totalPages = Math.max(resMovie.data.total_pages || 1, resTv.data.total_pages || 1);

      return {
        data: {
          results: combined,
          total_pages: totalPages
        }
      };
    } catch (e) {
      return tmdbApi.get(`/discover/movie?with_genres=${genreId}&page=${page}`);
    }
  },
  fetchDiscover: (params) => tmdbApi.get(`/discover/movie`, { params }),
  fetchMovieDetails: (id, type = 'movie') => tmdbApi.get(`/${type}/${id}?append_to_response=videos,credits,similar,reviews`),
  fetchReviews: (id, type = 'movie') => tmdbApi.get(`/${type}/${id}/reviews`),
  fetchSimilar: (id, type = 'movie', page = 1) => tmdbApi.get(`/${type}/${id}/similar?page=${page}`),
  fetchRecommendations: (id, type = 'movie', page = 1) => tmdbApi.get(`/${type}/${id}/recommendations?page=${page}`),
  fetchSeasonEpisodes: (id, seasonNumber) => tmdbApi.get(`/tv/${id}/season/${seasonNumber}`),
  searchMulti: async (query) => {
    try {
      const cleanQuery = query ? query.trim() : '';
      if (!cleanQuery) return { data: { results: [] } };

      const res = await tmdbApi.get(`/search/multi`, { params: { query: cleanQuery, include_adult: true } });
      return res;
    } catch (e) {
      return { data: { results: [] } };
    }
  },
};

export default tmdbApi;
