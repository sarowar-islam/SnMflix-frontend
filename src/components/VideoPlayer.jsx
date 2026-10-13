import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

export default function VideoPlayer({ playUrl, posterUrl, title, isSandboxed }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const [iframeLoading, setIframeLoading] = useState(true);

  // Player states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Gesture HUD states
  const [hudMessage, setHudMessage] = useState(null);

  const controlsTimeoutRef = useRef(null);
  const touchStartRef = useRef({
    startX: 0,
    startY: 0,
    side: null,
    mode: null,
    initialTime: 0,
    initialBrightness: 100,
    initialVolume: 1
  });

  const isEmbed = playUrl && (
    playUrl.includes('vidsrc') ||
    playUrl.includes('embed.su') ||
    playUrl.includes('multiembed') ||
    playUrl.includes('2embed') ||
    playUrl.includes('autoembed') ||
    playUrl.includes('smashystream') ||
    playUrl.includes('vidzee.wtf') ||
    playUrl.includes('vidrock.to') ||
    playUrl.includes('vidstorm.to') ||
    playUrl.includes('melopee.app') ||
    playUrl.includes('iframe') ||
    (!playUrl.endsWith('.mp4') && !playUrl.endsWith('.m3u8'))
  );

  // Listen for VidZee postMessage events (MEDIA_DATA & PLAYER_EVENT)
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== 'https://player.vidzee.wtf') return;

      if (event.data?.type === 'MEDIA_DATA') {
        const mediaData = event.data.data;
        try {
          localStorage.setItem('vidZeeProgress', JSON.stringify(mediaData));
        } catch (err) {}
      } else if (event.data?.type === 'PLAYER_EVENT') {
        const { event: eventType, currentTime, duration, tmdbId, mediaType, season, episode } = event.data.data || {};
        // Player event received from VidZee embed
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (isEmbed) {
      setIframeLoading(true);
      return;
    }

    let hls;
    const video = videoRef.current;
    if (!video) return;

    if (!playUrl) {
      setError('No video URL provided.');
      return;
    }

    const isHlsUrl = playUrl.includes('.m3u8');

    if (isHlsUrl && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        maxBufferSize: 30 * 1000 * 1000,
      });
      hls.loadSource(playUrl);
      hls.attachMedia(video);
    } else {
      video.src = playUrl;
    }

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      if (video) {
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('durationchange', handleDurationChange);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
      }
      if (hls) hls.destroy();
    };
  }, [playUrl, isEmbed]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) video.pause();
    else video.play().catch(() => {});
  };

  const skipTime = (seconds) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
    showHud(seconds > 0 ? `+${seconds}s` : `${seconds}s`);
  };

  const showHud = (msg) => {
    setHudMessage(msg);
    setTimeout(() => setHudMessage(null), 1200);
  };

  // Touch / Gesture handlers for MX Player vibe:
  // - Horizontal swipe (left/right) for seeking (forward/backward)
  // - Vertical swipe on left side for brightness
  // - Vertical swipe on right side for volume
  const handleTouchStart = (e) => {
    if (isEmbed) return;
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const isLeft = x < rect.width / 2;

    touchStartRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      side: isLeft ? 'left' : 'right',
      mode: null,
      initialTime: videoRef.current ? videoRef.current.currentTime : 0,
      initialBrightness: brightness,
      initialVolume: volume
    };
  };

  const handleTouchMove = (e) => {
    if (isEmbed || !touchStartRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.startX;
    const dy = touch.clientY - touchStartRef.current.startY;

    // Detect gesture mode if not set yet
    if (!touchStartRef.current.mode) {
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 12) {
        touchStartRef.current.mode = 'seek';
      } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
        touchStartRef.current.mode = touchStartRef.current.side === 'left' ? 'brightness' : 'volume';
      }
      return;
    }

    const { mode, initialTime, initialBrightness, initialVolume } = touchStartRef.current;
    const video = videoRef.current;

    if (mode === 'seek' && video && video.duration) {
      const seekDelta = (dx / containerRef.current.clientWidth) * 90; // swipe full width = 90s seek
      const newTime = Math.max(0, Math.min(video.duration, initialTime + seekDelta));
      video.currentTime = newTime;
      setCurrentTime(newTime);
      const sign = seekDelta >= 0 ? '+' : '';
      showHud(`Seek: ${sign}${Math.round(seekDelta)}s (${formatTime(newTime)})`);
    } else if (mode === 'brightness') {
      const newBrightness = Math.max(20, Math.min(200, initialBrightness - dy * 0.5));
      setBrightness(newBrightness);
      showHud(`Brightness: ${Math.round(newBrightness)}%`);
    } else if (mode === 'volume') {
      const newVol = Math.max(0, Math.min(1, initialVolume - dy * 0.005));
      setVolume(newVol);
      if (video) video.volume = newVol;
      setIsMuted(newVol === 0);
      showHud(`Volume: ${Math.round(newVol * 100)}%`);
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current.mode = null;
  };

  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      setIsMuted(newVol === 0);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      if (videoRef.current) videoRef.current.volume = volume || 1;
      setIsMuted(false);
    } else {
      if (videoRef.current) videoRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 4000);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className="w-full aspect-video bg-black relative rounded-2xl overflow-hidden shadow-2xl border border-brand-hover group select-none"
    >
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white flex-col p-4 text-center">
          <p className="text-xl font-bold mb-2">Playback Error</p>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      ) : isEmbed ? (
        <div className="w-full h-full relative bg-black">
          {iframeLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-brand-surface z-10">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-emerald"></div>
            </div>
          )}
          <iframe
            src={playUrl}
            title={title || "Video Player"}
            className="w-full h-full border-0 absolute inset-0"
            {...(isSandboxed ? { sandbox: "allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock" } : {})}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullScreen"
            allowFullScreen
            onLoad={() => setIframeLoading(false)}
          />
        </div>
      ) : (
        <div
          className="w-full h-full relative flex items-center justify-center bg-black cursor-pointer"
          style={{ filter: `brightness(${brightness}%)` }}
          onClick={togglePlay}
          onDoubleClick={(e) => {
            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x < rect.width / 2) skipTime(-10);
            else skipTime(10);
          }}
        >
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            poster={posterUrl}
            playsInline
          />

          {/* HUD Feedback for Swipe Gestures (Brightness / Volume / Seek) */}
          {hudMessage && (
            <div className="absolute z-30 bg-black/80 text-white px-5 py-2.5 rounded-xl text-sm font-bold backdrop-blur-md shadow-2xl border border-white/20 animate-fade-in">
              {hudMessage}
            </div>
          )}

          {/* Center Overlay Controls */}
          <div className={`absolute inset-0 flex items-center justify-center gap-10 bg-black/40 transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <button
              onClick={(e) => { e.stopPropagation(); skipTime(-10); }}
              className="p-4 rounded-full bg-black/70 hover:bg-brand-emerald hover:text-black text-white transition-all transform hover:scale-110 flex flex-col items-center gap-1 shadow-xl"
              title="Rewind 10 seconds (-10s)"
            >
              <RotateCcw size={28} />
              <span className="text-[11px] font-bold">-10s</span>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              className="p-6 rounded-full bg-brand-emerald hover:bg-emerald-400 text-black transition-transform transform hover:scale-110 shadow-2xl"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={40} fill="currentColor" /> : <Play size={40} fill="currentColor" className="ml-1" />}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); skipTime(10); }}
              className="p-4 rounded-full bg-black/70 hover:bg-brand-emerald hover:text-black text-white transition-all transform hover:scale-110 flex flex-col items-center gap-1 shadow-xl"
              title="Fast Forward 10 seconds (+10s)"
            >
              <RotateCw size={28} />
              <span className="text-[11px] font-bold">+10s</span>
            </button>
          </div>

          {/* Bottom Control Bar */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-4 py-3.5 flex flex-col gap-3 transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            {/* Progress Bar */}
            <div className="w-full flex items-center gap-3">
              <span className="text-xs text-gray-300 font-mono w-12 text-right">{formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setCurrentTime(val);
                  if (videoRef.current) videoRef.current.currentTime = val;
                }}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-emerald"
              />
              <span className="text-xs text-gray-300 font-mono w-12">{formatTime(duration)}</span>
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-4">
                <button onClick={togglePlay} className="hover:text-brand-emerald transition-colors">
                  {isPlaying ? <Pause size={24} /> : <Play size={24} fill="currentColor" />}
                </button>

                <div className="flex items-center gap-2">
                  <button onClick={toggleMute} className="hover:text-brand-emerald transition-colors">
                    {isMuted || volume === 0 ? <VolumeX size={22} /> : <Volume2 size={22} />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-24 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-emerald"
                  />
                </div>
              </div>

              {/* MX Player Style -10s & +10s buttons right after duration */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => skipTime(-10)}
                  className="bg-white/10 hover:bg-brand-emerald hover:text-black text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
                  title="Rewind 10 seconds"
                >
                  <RotateCcw size={15} /> -10s
                </button>
                <button
                  onClick={() => skipTime(10)}
                  className="bg-white/10 hover:bg-brand-emerald hover:text-black text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
                  title="Forward 10 seconds"
                >
                  <RotateCw size={15} /> +10s
                </button>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-brand-emerald truncate max-w-[200px]">{title}</span>
                <button onClick={toggleFullscreen} className="hover:text-brand-emerald transition-colors">
                  {isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
