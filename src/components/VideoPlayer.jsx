import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export default function VideoPlayer({ playUrl, posterUrl }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let hls;
    const video = videoRef.current;

    if (!video) return;

    if (!playUrl) {
      setError('No video URL provided.');
      return;
    }

    // Check if the URL is an HLS stream (.m3u8)
    const isHlsUrl = playUrl.includes('.m3u8');

    if (isHlsUrl && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        maxBufferSize: 30 * 1000 * 1000,
      });

      hls.loadSource(playUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch(data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError('Network error preventing video load.');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('Media error, attempting to recover...');
              hls.recoverMediaError();
              break;
            default:
              setError('An unrecoverable error occurred during playback.');
              hls.destroy();
              break;
          }
        }
      });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = playUrl;
    } else {
      // For mp4 and other direct formats
      video.src = playUrl;
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [playUrl]);

  return (
    <div className="w-full aspect-video bg-black relative rounded-xl overflow-hidden shadow-2xl">
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white flex-col">
          <p className="text-xl font-bold mb-2">Playback Error</p>
          <p className="text-gray-400">{error}</p>
        </div>
      ) : (
        <video
          ref={videoRef}
          className="w-full h-full"
          controls
          autoPlay
          poster={posterUrl}
          playsInline
        />
      )}
    </div>
  );
}
