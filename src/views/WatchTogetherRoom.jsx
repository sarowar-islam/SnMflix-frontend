import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Film, Users, Shield, Search, ArrowLeft, Check, X, AlertCircle, Share2, Star } from 'lucide-react';
import api from '../utils/api';
import { fetchMovies, getImageUrl } from '../utils/tmdb';

const buildMelopeeUrl = (id, type = 'movie', startAt = 0) => {
  const base = type === 'tv'
    ? `https://player.melopee.app/embed/tv?tmdb=${id}&season=1&episode=1&quality=auto`
    : `https://player.melopee.app/embed/movie?tmdb=${id}&quality=auto`;
  return startAt > 2 ? `${base}&startAt=${Math.floor(startAt)}` : base;
};

// Robust extractor for TMDb ID from room data or player URL
const extractMovieId = (roomData) => {
  if (!roomData) return null;
  if (roomData.currentMovieUrl) {
    const match = roomData.currentMovieUrl.match(/[?&]tmdb=(\d+)/);
    if (match) return match[1];
  }
  return roomData.movieId ? String(roomData.movieId) : null;
};

const WatchTogetherRoom = () => {
  const { roomCode } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [myParticipant, setMyParticipant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [guestNameInput, setGuestNameInput] = useState(user?.username || '');
  const [hasRequested, setHasRequested] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [showBrowseView, setShowBrowseView] = useState(false);

  // Active iframe src
  const [iframeSrc, setIframeSrc] = useState('');

  // Player iframe reference for direct postMessage control
  const iframeRef = useRef(null);

  // Refs for tracking playback & room state without closure staleness
  const roomRef = useRef(null);
  const localProgressRef = useRef(0);
  const adminStateRef = useRef({ progress: 0, status: 'paused' });
  const lastEmittedStatusRef = useRef('playing');
  const participantStateRef = useRef({ isPlaying: null, movieId: null });
  const participantPlayerStatusRef = useRef('paused');
  const lastServerAdminTimeRef = useRef(null);
  const lastServerPlayingRef = useRef(null);
  const chatBoxRef = useRef(null);
  const isOwner = user && room && room.ownerId === user.id;

  // Sync roomRef whenever room updates
  const updateRoomState = (newRoom) => {
    roomRef.current = newRoom;
    setRoom(newRoom);
  };

  // ─── Dispatch player commands directly to Melopee/VidSrc embed player ───
  const sendPlayerCommand = (action) => {
    if (!iframeRef.current?.contentWindow) return;
    try {
      const msg = { player: true, action };
      const strMsg = JSON.stringify(msg);
      iframeRef.current.contentWindow.postMessage(msg, '*');
      iframeRef.current.contentWindow.postMessage(strMsg, '*');

      // Also forward to nested frames if accessible
      try {
        const frames = iframeRef.current.contentWindow.frames;
        if (frames && frames.length) {
          for (let i = 0; i < frames.length; i++) {
            try {
              frames[i].postMessage(msg, '*');
              frames[i].postMessage(strMsg, '*');
            } catch (innerErr) {}
          }
        }
      } catch (fErr) {}
    } catch (e) {}
  };

  // ─── Listen for postMessage PLAYER_EVENT from the player iframe ───
  useEffect(() => {
    const handleMessage = (event) => {
      let payload = event.data;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch (e) { return; }
      }
      if (payload?.type !== 'PLAYER_EVENT') return;

      const { player_status, player_progress } = payload.data || {};

      if (player_status && !isOwner) {
        participantPlayerStatusRef.current = player_status;

        // When participant player finishes seeking, automatically resume playback if admin is playing
        if (roomRef.current?.isPlaying && player_status === 'seeked') {
          sendPlayerCommand('play');
        }
      }

      if (typeof player_progress === 'number') {
        localProgressRef.current = player_progress;

        if (isOwner) {
          adminStateRef.current = { progress: player_progress, status: player_status || 'playing' };

          // When admin state changes (playing, paused, seeked), stream immediately to backend
          if (player_status && player_status !== lastEmittedStatusRef.current) {
            lastEmittedStatusRef.current = player_status;
            const isPlaying = player_status === 'playing';
            const currentRoom = roomRef.current;
            const currentId = extractMovieId(currentRoom);

            if (currentId) {
              api.post(`/rooms/${roomCode}/playback`, {
                currentMovieUrl: currentRoom?.currentMovieUrl,
                movieId: currentId,
                mediaType: currentRoom?.mediaType || 'movie',
                isPlaying,
                currentTime: player_progress,
                playbackSpeed: 1.0
              }).catch(() => {});
            }
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [isOwner, roomCode]);

  // ─── ADMIN: Stream playback state periodically to backend while playing ───
  useEffect(() => {
    if (!isOwner) return;

    const interval = setInterval(async () => {
      const currentRoom = roomRef.current;
      const currentId = extractMovieId(currentRoom);
      if (!currentId) return;

      const { progress, status } = adminStateRef.current;
      const isPlaying = status === 'playing';

      try {
        await api.post(`/rooms/${roomCode}/playback`, {
          currentMovieUrl: currentRoom.currentMovieUrl,
          movieId: currentId,
          mediaType: currentRoom.mediaType || 'movie',
          isPlaying,
          currentTime: progress,
          playbackSpeed: 1.0
        });
      } catch (e) {}
    }, 1500);

    return () => clearInterval(interval);
  }, [isOwner, roomCode]);

  // ─── Initial Room Setup & Recommendations ───
  useEffect(() => {
    let isMounted = true;
    const initRoom = async () => {
      try {
        const res = await api.get(`/rooms/${roomCode}`);
        if (!isMounted) return;
        const roomData = res.data;
        updateRoomState(roomData);
        setParticipants(roomData.participants || []);

        const activeId = extractMovieId(roomData);
        if (activeId) {
          participantStateRef.current.movieId = activeId;
          participantStateRef.current.isPlaying = roomData.isPlaying;
          const url = buildMelopeeUrl(activeId, roomData.mediaType || 'movie', roomData.currentTime || 0);
          setIframeSrc(url);
          localProgressRef.current = roomData.currentTime || 0;
        }

        try {
          const recRes = await fetchMovies.fetchTrending(1);
          if (isMounted) setRecommendations((recRes.data.results || []).filter(m => m.poster_path).slice(0, 16));
        } catch (e) {}

        if (user && roomData.ownerId === user.id) {
          setMyParticipant({ name: user.username, status: 'APPROVED', isAdmin: true });
          setHasRequested(true);
          const reqRes = await api.get(`/rooms/${roomCode}/requests`);
          if (isMounted) setPendingRequests(reqRes.data || []);
        } else {
          const savedName = searchParams.get('name') || localStorage.getItem(`room_joined_${roomCode}`);
          if (savedName) {
            setGuestNameInput(savedName);
            try {
              const joinRes = await api.post(`/rooms/${roomCode}/join`, { name: savedName });
              if (isMounted) { setMyParticipant(joinRes.data); setHasRequested(true); }
            } catch (e) {}
          }
        }
      } catch (err) {
        if (isMounted) setError(err.response?.data || 'Room not found.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initRoom();
    return () => { isMounted = false; };
  }, [roomCode, user]);

  // ─── PARTICIPANTS: Poll sync every 1s & apply smooth play/pause/seek/movie-sync ───
  useEffect(() => {
    if (!myParticipant || myParticipant.status !== 'APPROVED') return;

    const interval = setInterval(async () => {
      try {
        const syncRes = await api.get(`/rooms/${roomCode}/sync`);
        const serverRoom = syncRes.data.room;
        setParticipants(syncRes.data.participants || []);
        setMessages(syncRes.data.messages || []);

        if (serverRoom) {
          updateRoomState(serverRoom);

          if (!isOwner) {
            const serverMovieId = extractMovieId(serverRoom);
            const serverMediaType = serverRoom.mediaType || 'movie';

            if (serverMovieId) {
              // 1) Change movie (or initial load)
              if (!iframeSrc || participantStateRef.current.movieId !== serverMovieId) {
                participantStateRef.current.movieId = serverMovieId;
                lastServerPlayingRef.current = serverRoom.isPlaying;
                lastServerAdminTimeRef.current = serverRoom.currentTime || 0;
                const initialTime = serverRoom.currentTime || 0;
                const targetUrl = buildMelopeeUrl(serverMovieId, serverMediaType, initialTime);
                setIframeSrc(targetUrl);
                return;
              }

              // 2) Play / Pause synchronization
              if (lastServerPlayingRef.current !== serverRoom.isPlaying) {
                lastServerPlayingRef.current = serverRoom.isPlaying;
                if (serverRoom.isPlaying) {
                  sendPlayerCommand('play');
                } else {
                  sendPlayerCommand('pause');
                  sendPlayerCommand(`seek${Math.floor(serverRoom.currentTime || 0)}`);
                }
              }

              // 3) Admin jumped / seeked to a new timestamp (> 8s jump)
              const currentAdminTime = serverRoom.currentTime || 0;
              const prevAdminTime = lastServerAdminTimeRef.current !== null ? lastServerAdminTimeRef.current : currentAdminTime;
              const timeJump = Math.abs(currentAdminTime - prevAdminTime);

              if (timeJump > 8) {
                sendPlayerCommand(`seek${Math.floor(currentAdminTime)}`);
                if (serverRoom.isPlaying) {
                  sendPlayerCommand('play');
                } else {
                  sendPlayerCommand('pause');
                }
              }

              lastServerAdminTimeRef.current = currentAdminTime;
            }
          }
        }

        if (user && serverRoom?.ownerId === user.id) {
          const reqRes = await api.get(`/rooms/${roomCode}/requests`);
          setPendingRequests(reqRes.data || []);
        }
      } catch (err) {}
    }, 1000);

    return () => clearInterval(interval);
  }, [roomCode, myParticipant, user, isOwner, iframeSrc]);

  // ─── ADMIN: Select movie from search / recommendations ───
  const handleSelectMovie = async (item) => {
    const mType = item.media_type || (item.name && !item.title ? 'tv' : 'movie');
    const tmdbId = String(item.id);
    const embedUrl = buildMelopeeUrl(tmdbId, mType, 0);

    const updatedRoom = {
      ...(roomRef.current || {}),
      currentMovieUrl: embedUrl,
      movieId: tmdbId,
      mediaType: mType,
      isPlaying: true,
      currentTime: 0
    };
    updateRoomState(updatedRoom);

    participantStateRef.current.movieId = tmdbId;
    participantStateRef.current.isPlaying = true;
    setIframeSrc(embedUrl);
    localProgressRef.current = 0;
    adminStateRef.current = { progress: 0, status: 'playing' };
    lastEmittedStatusRef.current = 'playing';
    setShowBrowseView(false);
    setSearchQuery('');
    setSearchResults([]);

    try {
      await api.post(`/rooms/${roomCode}/playback`, {
        currentMovieUrl: embedUrl,
        movieId: tmdbId,
        mediaType: mType,
        isPlaying: true,
        currentTime: 0,
        playbackSpeed: 1.0
      });
    } catch (e) {
      alert('Failed to start movie in room');
    }
  };

  // Live search for owner
  useEffect(() => {
    if (!isOwner || !searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      fetchMovies.searchMulti(searchQuery)
        .then(res => setSearchResults((res.data.results || []).filter(m => m.poster_path).slice(0, 12)))
        .catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, isOwner]);

  // Scroll chat
  useEffect(() => {
    if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
  }, [messages]);

  const handleRequestJoin = async (e) => {
    e.preventDefault();
    if (!guestNameInput.trim()) return;
    try {
      const name = guestNameInput.trim();
      localStorage.setItem(`room_joined_${roomCode}`, name);
      const joinRes = await api.post(`/rooms/${roomCode}/join`, { name });
      setMyParticipant(joinRes.data);
      setHasRequested(true);
    } catch (err) { alert(err.response?.data || 'Failed to send join request'); }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    const text = inputMessage.trim();
    setInputMessage('');
    try {
      await api.post(`/rooms/${roomCode}/chat`, { senderName: myParticipant?.name || 'Guest', message: text });
      const syncRes = await api.get(`/rooms/${roomCode}/sync`);
      setMessages(syncRes.data.messages || []);
    } catch (err) {}
  };

  const handleApproveRequest = async (participantId, approve) => {
    try {
      await api.post(`/rooms/${roomCode}/approve`, { participantId, approve });
      const reqRes = await api.get(`/rooms/${roomCode}/requests`);
      setPendingRequests(reqRes.data || []);
      const syncRes = await api.get(`/rooms/${roomCode}/sync`);
      setParticipants(syncRes.data.participants || []);
    } catch (err) { alert('Failed to process request'); }
  };

  // ─── Screens ───
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-brand-emerald bg-brand-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-emerald"></div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-white bg-brand-background">
        <div className="bg-brand-surface border border-brand-hover rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">Room Not Found</h2>
          <p className="text-xs text-gray-400 mb-6">{error || 'This room does not exist or has expired.'}</p>
          <button onClick={() => navigate('/watch-together')} className="px-6 py-2.5 rounded-xl bg-brand-emerald text-black font-bold text-xs hover:bg-emerald-400 transition-colors cursor-pointer">
            Back to Watch Together Lobby
          </button>
        </div>
      </div>
    );
  }

  if (!hasRequested && !isOwner) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-white bg-brand-background">
        <div className="bg-brand-surface border border-brand-hover rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <div className="flex items-center justify-center gap-2 mb-4"><Users size={32} className="text-brand-emerald" /><span className="text-xl font-bold text-white">Join Room</span></div>
          <h2 className="text-base font-bold text-center text-gray-200 mb-1">{room.title}</h2>
          <p className="text-xs text-gray-400 text-center mb-6">Hosted by <strong className="text-white">{room.ownerName}</strong></p>
          <form onSubmit={handleRequestJoin} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Your Display Name</label>
              <input type="text" value={guestNameInput} onChange={e => setGuestNameInput(e.target.value)} placeholder="Enter your name..." className="w-full p-3 bg-brand-background border border-brand-hover rounded-xl focus:outline-none focus:border-brand-emerald text-sm text-white" required />
            </div>
            <button type="submit" className="w-full py-3 rounded-xl font-bold bg-brand-emerald text-black hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 text-sm shadow-lg shadow-brand-emerald/20 cursor-pointer">Request to Join Room</button>
          </form>
          <button onClick={() => navigate('/watch-together')} className="mt-6 text-xs text-gray-400 hover:text-white w-full text-center transition-colors cursor-pointer">Return to Lobby</button>
        </div>
      </div>
    );
  }

  if (myParticipant?.status === 'PENDING') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-white bg-brand-background">
        <div className="bg-brand-surface border border-brand-hover rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 flex items-center justify-center mx-auto mb-4 animate-pulse"><Users size={24} /></div>
          <h2 className="text-xl font-bold mb-2">Waiting for Room Owner Approval</h2>
          <p className="text-xs text-gray-400 mb-6">Your request to join <span className="text-white font-bold">{room.title}</span> has been sent.</p>
          <button onClick={() => window.location.reload()} className="w-full py-3 rounded-xl bg-brand-background border border-brand-hover text-white font-bold text-xs hover:bg-brand-hover transition-colors mb-2 cursor-pointer">Check Approval Status</button>
          <button onClick={() => navigate('/watch-together')} className="text-xs text-gray-500 hover:text-white transition-colors cursor-pointer">Cancel and Return to Lobby</button>
        </div>
      </div>
    );
  }

  if (myParticipant?.status === 'REJECTED') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-white bg-brand-background">
        <div className="bg-brand-surface border border-red-900/50 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <X size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">Join Request Declined</h2>
          <p className="text-xs text-gray-400 mb-6">The room owner declined your request.</p>
          <button onClick={() => navigate('/watch-together')} className="px-6 py-2.5 rounded-xl bg-brand-emerald text-black font-bold text-xs hover:bg-emerald-400 transition-colors cursor-pointer">Back to Lobby</button>
        </div>
      </div>
    );
  }

  // ─── Main Room UI ───
  return (
    <div className="min-h-screen bg-brand-background text-white flex flex-col">
      {/* Top Bar */}
      <header className="bg-brand-surface border-b border-brand-hover px-4 py-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/watch-together')} className="p-2 rounded-xl bg-brand-background hover:bg-brand-hover text-gray-300 transition-colors cursor-pointer"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-sm font-bold truncate max-w-xs sm:max-w-md">{room.title}</h1>
            <p className="text-[11px] text-gray-400 flex items-center gap-2">
              <span>Code: <strong className="text-brand-emerald font-mono">{room.roomCode}</strong></span>
              <span>•</span>
              <span>Owner: {room.ownerName}</span>
              {isOwner && <span className="px-1.5 py-0.5 bg-brand-emerald/20 text-brand-emerald rounded text-[10px] font-bold">Admin</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {iframeSrc && isOwner && (
            <button onClick={() => setShowBrowseView(!showBrowseView)} className="px-3 py-1.5 rounded-xl bg-brand-emerald text-black hover:bg-emerald-400 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5">
              <Search size={14} /> {showBrowseView ? 'Back to Player' : 'Change Movie'}
            </button>
          )}
          <button onClick={() => { navigator.clipboard.writeText(window.location.origin + '/watch-together/' + room.roomCode); alert('Invitation link copied!'); }}
            className="px-3 py-1.5 rounded-xl bg-brand-background hover:bg-brand-hover border border-brand-hover text-xs font-semibold flex items-center gap-1.5 text-gray-300 transition-colors cursor-pointer">
            <Share2 size={14} className="text-brand-emerald" /> Share Link
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 overflow-hidden">
        {/* Left: Player or Browse */}
        <div className="lg:col-span-3 flex flex-col overflow-y-auto bg-brand-background">
          {iframeSrc && !showBrowseView ? (
            <div className="flex flex-col flex-1 bg-black">
              {/* Responsive Video Frame */}
              <div className="relative w-full aspect-video bg-gray-950">
                <iframe
                  ref={iframeRef}
                  src={iframeSrc}
                  title="Watch Party Player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullScreen"
                  allowFullScreen
                  className="w-full h-full border-0"
                  onLoad={() => {
                    if (roomRef.current?.isPlaying) {
                      sendPlayerCommand('play');
                    }
                  }}
                />

                {/* Controller screen blocking for non-admin participants (blocks bottom timeline/seekbar only) */}
                {!isOwner && (
                  <div
                    className="absolute inset-x-0 bottom-0 h-16 z-10 cursor-not-allowed select-none bg-transparent"
                    title="Timeline controls are reserved for the room admin"
                    onClick={(e) => { e.stopPropagation(); }}
                  />
                )}
              </div>

              {/* Status Bar */}
              <div className="p-3 bg-brand-surface border-t border-brand-hover flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-emerald animate-ping"></span>
                  <span className="text-xs text-gray-300">
                    {isOwner
                      ? <><strong className="text-brand-emerald">Admin Control:</strong> Your playback state &amp; movie selection sync across all participants</>
                      : <>Playback is <strong className="text-brand-emerald">Synchronized</strong> with {room.ownerName}</>
                    }
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Movie Browsing Section */
            <div className="p-6 flex flex-col gap-6">
              {isOwner ? (
                <>
                  {/* Search Bar */}
                  <div className="relative max-w-2xl mx-auto w-full">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search movies or TV shows to watch together..."
                      className="w-full pl-11 pr-4 py-3 bg-brand-surface border border-brand-hover rounded-2xl text-sm text-white placeholder-gray-400 focus:outline-none focus:border-brand-emerald shadow-lg"
                    />
                    {searchResults.length > 0 && (
                      <div className="absolute left-0 right-0 mt-2 bg-brand-surface border border-brand-hover rounded-2xl shadow-2xl z-30 max-h-96 overflow-y-auto p-2">
                        {searchResults.map(item => (
                          <div key={item.id} onClick={() => handleSelectMovie(item)} className="flex items-center gap-3 p-2.5 hover:bg-brand-hover/70 rounded-xl cursor-pointer transition-colors">
                            <img src={getImageUrl(item.poster_path, 'w92')} alt={item.title || item.name} className="w-12 h-16 object-cover rounded-lg flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white truncate">{item.title || item.name}</p>
                              <p className="text-xs text-gray-400 flex items-center gap-2 mt-1">
                                <span className="uppercase px-1.5 py-0.5 bg-brand-background rounded text-[10px] font-semibold text-brand-emerald">{item.media_type || 'movie'}</span>
                                {(item.release_date || item.first_air_date) && <span>{new Date(item.release_date || item.first_air_date).getFullYear()}</span>}
                                {item.vote_average > 0 && <span className="flex items-center gap-0.5 text-yellow-400 font-semibold"><Star size={12} fill="currentColor" /> {parseFloat(item.vote_average).toFixed(1)}</span>}
                              </p>
                            </div>
                            <span className="text-xs font-bold text-black bg-brand-emerald px-4 py-2 rounded-xl">Play Now</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recommendations */}
                  <div>
                    <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                      <span className="w-1 h-5 bg-brand-emerald rounded-full"></span>
                      Recommended Movies & Shows
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {recommendations.map(item => (
                        <div key={item.id} onClick={() => handleSelectMovie(item)} className="bg-brand-surface border border-brand-hover rounded-xl p-2.5 hover:border-brand-emerald cursor-pointer transition-all hover:scale-105 flex flex-col group shadow-lg">
                          <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-2">
                            <img src={getImageUrl(item.poster_path, 'w342')} alt={item.title || item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            {item.vote_average > 0 && (
                              <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded-md text-[10px] font-bold text-yellow-400 flex items-center gap-0.5">
                                <Star size={10} fill="currentColor" /> {parseFloat(item.vote_average).toFixed(1)}
                              </div>
                            )}
                          </div>
                          <p className="text-xs font-bold text-white truncate">{item.title || item.name}</p>
                          <p className="text-[11px] text-gray-400 capitalize mt-0.5">{item.media_type || 'movie'} • {(item.release_date || item.first_air_date || '').substring(0, 4)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-16 bg-brand-surface border border-brand-hover rounded-2xl max-w-lg mx-auto w-full p-8 shadow-xl">
                  <Film size={48} className="mx-auto text-brand-emerald mb-4 animate-pulse" />
                  <h3 className="text-lg font-bold text-white mb-2">Waiting for Room Admin</h3>
                  <p className="text-xs text-gray-400">The room admin (<strong className="text-white">{room.ownerName}</strong>) is selecting a movie. Player starts automatically once chosen.</p>
                </div>
              )}
            </div>
          )}

          {/* Pending Requests (admin only) */}
          {isOwner && pendingRequests.length > 0 && (
            <div className="p-4 bg-brand-surface border-t border-brand-hover">
              <h3 className="text-xs font-bold text-brand-emerald uppercase tracking-wider mb-3 flex items-center gap-2"><Users size={14} /> Pending Join Requests ({pendingRequests.length})</h3>
              <div className="flex flex-col gap-2">
                {pendingRequests.map(req => (
                  <div key={req.id} className="flex items-center justify-between p-2.5 bg-brand-background border border-brand-hover rounded-xl text-xs">
                    <span className="font-semibold text-white">{req.name}</span>
                    <div className="flex gap-2">
                      <button onClick={() => handleApproveRequest(req.id, true)} className="px-3 py-1 bg-brand-emerald text-black font-bold rounded-lg hover:bg-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"><Check size={14} /> Approve</button>
                      <button onClick={() => handleApproveRequest(req.id, false)} className="px-3 py-1 bg-red-950/60 border border-red-900 text-red-400 font-bold rounded-lg hover:bg-red-900/60 flex items-center gap-1 cursor-pointer"><X size={14} /> Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Chat & Participants */}
        <div className="lg:col-span-1 bg-brand-surface border-l border-brand-hover flex flex-col h-[500px] lg:h-auto overflow-hidden">
          <div className="p-3 border-b border-brand-hover bg-brand-background/50">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5"><Users size={14} className="text-brand-emerald" /> Participants ({participants.length})</span>
          </div>
          <div className="max-h-36 overflow-y-auto p-2 border-b border-brand-hover space-y-1">
            {participants.map(p => (
              <div key={p.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs bg-brand-background">
                <span className="font-medium text-gray-200 truncate">{p.name}</span>
                {p.isAdmin && <span className="px-1.5 py-0.5 bg-brand-emerald/20 text-brand-emerald rounded text-[10px] font-bold flex items-center gap-0.5"><Shield size={10} /> Owner</span>}
              </div>
            ))}
          </div>
          <div ref={chatBoxRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0
              ? <p className="text-center text-xs text-gray-500 my-6">No messages yet. Say hello!</p>
              : messages.map((m, idx) => (
                <div key={idx} className="flex flex-col">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-bold text-brand-emerald">{m.senderName}</span>
                    <span className="text-[9px] text-gray-500">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-xs text-gray-200 bg-brand-background p-2 rounded-xl mt-1 break-words">{m.message}</p>
                </div>
              ))
            }
          </div>
          <form onSubmit={handleSendMessage} className="p-3 border-t border-brand-hover bg-brand-background/50 flex gap-2">
            <input type="text" value={inputMessage} onChange={e => setInputMessage(e.target.value)} placeholder="Send a message..." className="flex-1 p-2 bg-brand-background border border-brand-hover rounded-xl text-xs text-white focus:outline-none focus:border-brand-emerald" />
            <button type="submit" className="p-2.5 rounded-xl bg-brand-emerald text-black hover:bg-emerald-400 transition-colors cursor-pointer flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default WatchTogetherRoom;
