import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Tv, Check, Download, Star, Calendar, Clock } from 'lucide-react';
import { fetchMovies, getImageUrl } from '../utils/tmdb';
import { useAuth } from '../context/AuthContext';
import VideoPlayer from '../components/VideoPlayer';
import MovieCard from '../components/MovieCard';
import Navbar from '../components/Navbar';

export default function WatchPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addHistory } = useAuth();

  const mediaType = searchParams.get('type') || 'movie';

  // Server selection locked to Server 1 (vidsrc.me)
  const selectedServer = 1;
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [episodes, setEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  const serversList = [
    {
      id: 1,
      name: 'Server 1 (vidsrc.me - Recommended)',
      urlFn: (id, s, e, type) => type === 'tv' ? `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}` : `https://vidsrc.me/embed/movie?tmdb=${id}`
    },
  ];

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);

    fetchMovies.fetchMovieDetails(id, mediaType)
      .then(res => {
        setMovie(res.data);
        const m = res.data;
        addHistory({
          id: String(m.id),
          title: m.title || m.name,
          posterUrl: getImageUrl(m.poster_path, 'w500'),
          backdropUrl: getImageUrl(m.backdrop_path, 'original'),
          rating: m.vote_average,
          mediaType,
        });
        if (mediaType === 'tv' && m.seasons && m.seasons.length > 0) {
          const firstSeason = m.seasons.find(s => s.season_number > 0) || m.seasons[0];
          setSelectedSeason(firstSeason.season_number || 1);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, mediaType]);

  // Fetch episodes when season changes for TV shows
  useEffect(() => {
    if (mediaType === 'tv' && id) {
      setLoadingEpisodes(true);
      fetchMovies.fetchSeasonEpisodes(id, selectedSeason)
        .then(res => {
          setEpisodes(res.data.episodes || []);
          if (res.data.episodes && res.data.episodes.length > 0) {
            setSelectedEpisode(res.data.episodes[0].episode_number || 1);
          }
        })
        .catch(() => setEpisodes([]))
        .finally(() => setLoadingEpisodes(false));
    }
  }, [id, mediaType, selectedSeason]);

  const getPlayUrl = () => {
    const srv = serversList[0];
    return srv.urlFn(id, selectedSeason, selectedEpisode, mediaType);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-brand-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-emerald"></div>
      </div>
    );
  }

  const seasons = movie?.seasons?.filter(s => s.season_number >= 0) || [];

  return (
    <div className="min-h-screen bg-brand-background text-white flex flex-col">
      {/* Top Navbar */}
      <Navbar />

      <div className="flex-1 flex flex-col p-4 sm:p-8 max-w-6xl mx-auto w-full">
        {/* Top Navigation Bar inside Watch View */}
        <div className="w-full flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-surface hover:bg-brand-hover border border-brand-hover text-white transition-colors text-sm font-semibold cursor-pointer"
          >
            <ArrowLeft size={18} /> Back to Details
          </button>
          <div className="text-right">
            <h1 className="text-base sm:text-xl font-bold truncate max-w-md text-brand-emerald">
              {movie?.title || movie?.name}
            </h1>
            {mediaType === 'tv' && (
              <p className="text-xs text-gray-400">
                Season {selectedSeason} : Episode {selectedEpisode}
              </p>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="w-full flex flex-col gap-6">
          {/* Video Player */}
          <VideoPlayer
            playUrl={getPlayUrl()}
            posterUrl={movie ? getImageUrl(movie.backdrop_path || movie.poster_path, 'original') : ''}
            title={movie?.title || movie?.name}
          />

          {/* TV Series Episode Playlist Selector */}
          {mediaType === 'tv' && (
            <div className="bg-brand-surface border border-brand-hover p-5 sm:p-6 rounded-2xl flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Tv size={20} className="text-brand-emerald" />
                  <h2 className="text-lg font-bold">Episodes Playlist</h2>
                </div>

                {/* Seasons Selector */}
                {seasons.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-2">
                    <span className="text-xs text-gray-400 font-semibold uppercase">Season:</span>
                    <div className="flex gap-1.5">
                      {seasons.map(season => (
                        <button
                          key={season.id}
                          onClick={() => setSelectedSeason(season.season_number)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            selectedSeason === season.season_number
                              ? 'bg-brand-emerald text-black'
                              : 'bg-brand-background text-gray-300 hover:bg-brand-hover border border-brand-hover'
                          }`}
                        >
                          {season.name || `Season ${season.season_number}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Episodes List / Grid */}
              {loadingEpisodes ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-emerald"></div>
                </div>
              ) : episodes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                  {episodes.map(ep => {
                    const isSelected = selectedEpisode === ep.episode_number;
                    return (
                      <button
                        key={ep.id}
                        onClick={() => setSelectedEpisode(ep.episode_number)}
                        className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-brand-emerald/10 border-brand-emerald text-white'
                            : 'bg-brand-background/60 border-brand-hover hover:border-brand-hover/80 text-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-brand-surface text-brand-emerald">
                            Ep {ep.episode_number}
                          </span>
                          {isSelected && <Check size={16} className="text-brand-emerald" />}
                        </div>
                        <p className="text-xs font-semibold line-clamp-1">
                          {ep.name || `Episode ${ep.episode_number}`}
                        </p>
                        {ep.runtime && (
                          <span className="text-[10px] text-gray-500">{ep.runtime} min</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">No episodes found for this season.</p>
              )}
            </div>
          )}

          {/* Movie Details & Info Section */}
          <div className="bg-brand-surface border border-brand-hover p-6 rounded-2xl flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
               
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                  {movie.title || movie.name}
                </h1>
              </div>

            </div>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-gray-300 border-t border-brand-hover pt-4">
              {movie.vote_average > 0 && (
                <span className="flex items-center gap-1 text-yellow-400 font-semibold">
                  <Star size={16} fill="currentColor" />
                  {parseFloat(movie.vote_average).toFixed(1)} / 10
                </span>
              )}
              {(movie.release_date || movie.first_air_date) && (
                <span className="flex items-center gap-1.5">
                  <Calendar size={15} />
                  {new Date(movie.release_date || movie.first_air_date).getFullYear()}
                </span>
              )}
              {movie.runtime > 0 && (
                <span className="flex items-center gap-1.5">
                  <Clock size={15} />
                  {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
                </span>
              )}
            </div>

            {movie.overview && (
              <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                {movie.overview}
              </p>
            )}
          </div>

          {/* Similar / You May Also Like Section */}
          {movie.similar?.results?.length > 0 && (
            <div className="mt-6 mb-12">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-brand-emerald rounded-full"></span>
                You May Also Like
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {movie.similar.results.filter(m => m.poster_path).slice(0, 10).map(m => (
                  <MovieCard key={m.id} movie={{
                    id: String(m.id),
                    title: m.title || m.name,
                    posterUrl: getImageUrl(m.poster_path, 'w500'),
                    backdropUrl: getImageUrl(m.backdrop_path, 'original'),
                    rating: m.vote_average,
                    mediaType: m.media_type || (m.name ? 'tv' : 'movie'),
                  }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(16, 185, 129, 0.3); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(16, 185, 129, 0.6); }
      `}} />
    </div>
  );
}
