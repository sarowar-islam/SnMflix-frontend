import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../utils/api';
import { fetchMovies, getImageUrl } from '../utils/tmdb';
import VideoPlayer from '../components/VideoPlayer';

export default function WatchPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [playUrl, setPlayUrl] = useState('');
  const [loading, setLoading] = useState(true);

  const mediaType = searchParams.get('type') || 'movie';

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);

    // Fetch movie details for title/poster
    fetchMovies.fetchMovieDetails(id, mediaType)
      .then(res => setMovie(res.data))
      .catch(() => {});

    // Fetch playback URL from our backend
    api.get(`/movies/${id}/play`)
      .then(res => {
        setPlayUrl(res.data.videoUrl || 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
      })
      .catch(() => {
        // Fallback sample video
        setPlayUrl('http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
      })
      .finally(() => setLoading(false));
  }, [id, mediaType]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-brand-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-emerald"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-background text-white flex flex-col p-4 sm:p-8">
      {/* Top Navigation Bar */}
      <div className="max-w-5xl mx-auto w-full flex items-center justify-between mb-6">
        <button 
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-surface hover:bg-brand-hover border border-brand-hover text-white transition-colors text-sm font-semibold"
        >
          <ArrowLeft size={18} /> Back to Details
        </button>
        <h1 className="text-lg sm:text-xl font-bold truncate max-w-md text-brand-emerald">
          {movie?.title || movie?.name || 'Now Playing'}
        </h1>
      </div>

      {/* Video Player Container */}
      <div className="max-w-5xl mx-auto w-full flex-1 flex items-center justify-center">
        <div className="w-full shadow-2xl rounded-2xl overflow-hidden border border-brand-hover bg-black">
          <VideoPlayer 
            playUrl={playUrl} 
            posterUrl={movie ? getImageUrl(movie.backdrop_path || movie.poster_path, 'original') : ''} 
          />
        </div>
      </div>
    </div>
  );
}
