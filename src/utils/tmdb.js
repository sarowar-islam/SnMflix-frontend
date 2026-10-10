import axios from 'axios';

// The API key is exposed here deliberately because client-side direct calls to TMDB require it.
// In a highly secure production app, it can be proxy via the backend, but for this step we want instant, robust data fetching on the frontend.
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
  fetchTrending: () => tmdbApi.get(`/trending/all/week`),
  fetchNetflixOriginals: () => tmdbApi.get(`/discover/tv?with_networks=213`),
  fetchTopRated: () => tmdbApi.get(`/movie/top_rated`),
  fetchActionMovies: () => tmdbApi.get(`/discover/movie?with_genres=28`),
  fetchComedyMovies: () => tmdbApi.get(`/discover/movie?with_genres=35`),
  fetchHorrorMovies: () => tmdbApi.get(`/discover/movie?with_genres=27`),
  fetchRomanceMovies: () => tmdbApi.get(`/discover/movie?with_genres=10749`),
  fetchDocumentaries: () => tmdbApi.get(`/discover/movie?with_genres=99`),
  fetchBollywood: () => tmdbApi.get(`/discover/movie?with_original_language=hi`),
  fetchAnime: () => tmdbApi.get(`/discover/tv?with_genres=16&with_original_language=ja`),
  fetchMovieDetails: (id, type = 'movie') => tmdbApi.get(`/${type}/${id}?append_to_response=videos,credits,similar`),
  searchMulti: (query) => tmdbApi.get(`/search/multi?query=${query}`),
};

export default tmdbApi;
