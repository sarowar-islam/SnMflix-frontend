import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Film, Users, Shield, Search, ArrowLeft, Check, X, AlertCircle, Share2, Star, Tv, Play, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../utils/api';
import { fetchMovies, getImageUrl } from '../utils/tmdb';

const buildMelopeeUrl = (id, type = 'movie', startAt = 0, season = 1, episode = 1) => {
  const base = type === 'tv'
    ? `https://player.melopee.app/embed/tv?tmdb=${id}&season=${season}&episode=${episode}&quality=auto`
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

// Extract TV season & episode from URL
const extractTvInfo = (url) => {
  if (!url) return { season: 1, episode: 1 };
  const sMatch = url.match(/[?&]season=(\d+)/);
  const eMatch = url.match(/[?&]episode=(\d+)/);
  return {
    season: sMatch ? parseInt(sMatch[1], 10) : 1,
    episode: eMatch ? parseInt(eMatch[1], 10) : 1
  };
};

// Unique key representing current media and episode
const getMediaKey = (roomData) => {
  if (!roomData) return '';
  const url = roomData.currentMovieUrl || '';
  const id = extractMovieId(roomData);
  const isTvType = roomData.mediaType === 'tv' || url.includes('/embed/tv');
  if (isTvType) {
    const { season, episode } = extractTvInfo(url);
    return `tv_${id}_s${season}_e${episode}`;
  }
  return `movie_${id}`;
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

  // TV Series Season & Episode state for active playing show
  const [currentTvDetails, setCurrentTvDetails] = useState(null);
  const [activeSeason, setActiveSeason] = useState(1);
  const [seasonEpisodes, setSeasonEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [showEpisodesDrawer, setShowEpisodesDrawer] = useState(true);

  // TV Series Episode Selection Modal (when clicking TV series in browse/search)
  const [selectedTvForModal, setSelectedTvForModal] = useState(null);
  const [modalTvDetails, setModalTvDetails] = useState(null);
  const [modalSeason, setModalSeason] = useState(1);
  const [modalEpisodes, setModalEpisodes] = useState([]);
  const [loadingModalEpisodes, setLoadingModalEpisodes] = useState(false);

  // Active iframe src
  const [iframeSrc, setIframeSrc] = useState('');

  // Player iframe reference for direct postMessage control
  const iframeRef = useRef(null);

  // Refs for tracking playback & room state without closure staleness
  const roomRef = useRef(null);
  const localProgressRef = useRef(0);
  const adminStateRef = useRef({ progress: 0, status: 'paused' });
  const lastEmittedStatusRef = useRef('playing');
  const participantStateRef = useRef({ isPlaying: null, movieId: null, mediaKey: null });
  const participantPlayerStatusRef = useRef('paused');
  const lastServerAdminTimeRef = useRef(null);
  const lastServerPlayingRef = useRef(null);
  const lastAdminSeekTimeRef = useRef(0);
  const lastParticipantSeekTimeRef = useRef(0);
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

  // Helper to reliably ensure player autoplays across delays/buffering
  const triggerAutoPlay = () => {
    sendPlayerCommand('play');
    setTimeout(() => sendPlayerCommand('play'), 200);
    setTimeout(() => sendPlayerCommand('play'), 500);
    setTimeout(() => sendPlayerCommand('play'), 1000);
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

      // ─── TEAM MEMBERS / PARTICIPANTS ───
      if (!isOwner) {
        if (player_status) {
          participantPlayerStatusRef.current = player_status;
        }

        const justSeeked = Date.now() - lastParticipantSeekTimeRef.current < 4000;

        // When participant player finishes seeking or pauses during seek, auto-resume playback if room is playing
        if (player_status === 'seeked' || (justSeeked && (player_status === 'paused' || player_status === 'pause'))) {
          if (roomRef.current?.isPlaying !== false) {
            triggerAutoPlay();
          }
        }
      }

      // ─── ROOM ADMIN (OWNER) ───
      if (typeof player_progress === 'number') {
        const prevProgress = localProgressRef.current;
        localProgressRef.current = player_progress;

        if (isOwner) {
          const isSeekJump = prevProgress > 0 && Math.abs(player_progress - prevProgress) > 3;
          const isSeekedEvent = player_status === 'seeked' || isSeekJump;

          if (isSeekedEvent) {
            lastAdminSeekTimeRef.current = Date.now();
            // Automatically resume & continue playing on admin's screen
            triggerAutoPlay();

            adminStateRef.current = { progress: player_progress, status: 'playing' };
            lastEmittedStatusRef.current = 'playing';

            const currentRoom = roomRef.current;
            const currentId = extractMovieId(currentRoom);
            if (currentId) {
              api.post(`/rooms/${roomCode}/playback`, {
                currentMovieUrl: currentRoom?.currentMovieUrl,
                movieId: currentId,
                mediaType: currentRoom?.mediaType || 'movie',
                isPlaying: true, // Crucial: ensure room state remains playing on seek!
                currentTime: player_progress,
                playbackSpeed: 1.0
              }).catch(() => {});
            }
            return;
          }

          // If admin seeked recently (< 3s), the iframe may emit a 'paused' event internally due to scrubbing.
          // Don't let it pause! Continue autoplaying!
          const justAdminSeeked = Date.now() - lastAdminSeekTimeRef.current < 3000;
          if (justAdminSeeked && (player_status === 'paused' || player_status === 'pause')) {
            triggerAutoPlay();
            adminStateRef.current = { progress: player_progress, status: 'playing' };
            return;
          }

          // Normal state updates (play / pause)
          adminStateRef.current = { progress: player_progress, status: player_status || 'playing' };

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
          const mKey = getMediaKey(roomData);
          participantStateRef.current.mediaKey = mKey;
          participantStateRef.current.movieId = activeId;
          participantStateRef.current.isPlaying = roomData.isPlaying;
          const initialTime = roomData.currentTime || 0;
          let url = roomData.currentMovieUrl;
          if (!url) {
            const { season, episode } = extractTvInfo(roomData.currentMovieUrl);
            url = buildMelopeeUrl(activeId, roomData.mediaType || 'movie', initialTime, season, episode);
          } else if (initialTime > 2 && !url.includes('startAt=')) {
            url = `${url}&startAt=${Math.floor(initialTime)}`;
          }
          setIframeSrc(url);
          localProgressRef.current = initialTime;
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
            const serverMediaKey = getMediaKey(serverRoom);

            if (serverMovieId) {
              // 1) Change movie/episode (or initial load)
              if (!iframeSrc || participantStateRef.current.mediaKey !== serverMediaKey) {
                participantStateRef.current.mediaKey = serverMediaKey;
                participantStateRef.current.movieId = serverMovieId;
                lastServerPlayingRef.current = serverRoom.isPlaying;
                lastServerAdminTimeRef.current = serverRoom.currentTime || 0;
                const initialTime = serverRoom.currentTime || 0;

                let targetUrl = serverRoom.currentMovieUrl;
                if (!targetUrl) {
                  const { season, episode } = extractTvInfo(serverRoom.currentMovieUrl);
                  targetUrl = buildMelopeeUrl(serverMovieId, serverMediaType, initialTime, season, episode);
                } else if (initialTime > 2 && !targetUrl.includes('startAt=')) {
                  targetUrl = `${targetUrl}&startAt=${Math.floor(initialTime)}`;
                }

                setIframeSrc(targetUrl);
                return;
              }

              // 2) Play / Pause synchronization
              if (lastServerPlayingRef.current !== serverRoom.isPlaying) {
                lastServerPlayingRef.current = serverRoom.isPlaying;
                if (serverRoom.isPlaying) {
                  triggerAutoPlay();
                } else {
                  sendPlayerCommand('pause');
                  sendPlayerCommand(`seek${Math.floor(serverRoom.currentTime || 0)}`);
                }
              }

              // 3) Admin jumped / seeked to a new timestamp (> 4s jump)
              const currentAdminTime = serverRoom.currentTime || 0;
              const prevAdminTime = lastServerAdminTimeRef.current !== null ? lastServerAdminTimeRef.current : currentAdminTime;
              const timeJump = Math.abs(currentAdminTime - prevAdminTime);

              if (timeJump > 4) {
                lastParticipantSeekTimeRef.current = Date.now();
                sendPlayerCommand(`seek${Math.floor(currentAdminTime)}`);
                if (serverRoom.isPlaying) {
                  triggerAutoPlay();
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

  // TV Info helpers for currently playing show
  const isCurrentTv = room?.mediaType === 'tv' || room?.currentMovieUrl?.includes('/embed/tv');
  const currentTvInfo = extractTvInfo(room?.currentMovieUrl);

  // Fetch show details (seasons, etc.) for the active show if it's TV
  useEffect(() => {
    const activeId = extractMovieId(room);
    if (activeId && isCurrentTv) {
      fetchMovies.fetchMovieDetails(activeId, 'tv')
        .then(res => {
          setCurrentTvDetails(res.data);
          const { season } = extractTvInfo(room.currentMovieUrl);
          setActiveSeason(season || 1);
        })
        .catch(() => setCurrentTvDetails(null));
    } else {
      setCurrentTvDetails(null);
    }
  }, [room?.movieId, room?.mediaType, room?.currentMovieUrl]);

  // Fetch episodes for the active season tab
  useEffect(() => {
    const activeId = extractMovieId(room);
    if (activeId && isCurrentTv && activeSeason) {
      setLoadingEpisodes(true);
      fetchMovies.fetchSeasonEpisodes(activeId, activeSeason)
        .then(res => setSeasonEpisodes(res.data.episodes || []))
        .catch(() => setSeasonEpisodes([]))
        .finally(() => setLoadingEpisodes(false));
    }
  }, [room?.movieId, isCurrentTv, activeSeason]);

  // When admin selects a TV show in browse/search modal
  useEffect(() => {
    if (selectedTvForModal) {
      setModalTvDetails(null);
      setModalEpisodes([]);
      setModalSeason(1);
      setLoadingModalEpisodes(true);

      fetchMovies.fetchMovieDetails(selectedTvForModal.id, 'tv')
        .then(res => {
          setModalTvDetails(res.data);
          const firstSeason = res.data.seasons?.find(s => s.season_number > 0) || res.data.seasons?.[0];
          const sNum = firstSeason?.season_number || 1;
          setModalSeason(sNum);
          return fetchMovies.fetchSeasonEpisodes(selectedTvForModal.id, sNum);
        })
        .then(res => {
          if (res) setModalEpisodes(res.data.episodes || []);
        })
        .catch(() => {})
        .finally(() => setLoadingModalEpisodes(false));
    }
  }, [selectedTvForModal]);

  // When admin switches season in modal
  const handleModalSeasonChange = (seasonNum) => {
    setModalSeason(seasonNum);
    if (!selectedTvForModal) return;
    setLoadingModalEpisodes(true);
    fetchMovies.fetchSeasonEpisodes(selectedTvForModal.id, seasonNum)
      .then(res => setModalEpisodes(res.data.episodes || []))
      .catch(() => setModalEpisodes([]))
      .finally(() => setLoadingModalEpisodes(false));
  };

  // ─── ADMIN: Select episode to play for TV show ───
  const handleSelectEpisode = async (seasonNum, episodeNum, customShow = null) => {
    if (!isOwner) return;
    const targetId = customShow?.id ? String(customShow.id) : extractMovieId(roomRef.current);
    if (!targetId) return;

    const embedUrl = buildMelopeeUrl(targetId, 'tv', 0, seasonNum, episodeNum);
    const mediaKey = `tv_${targetId}_s${seasonNum}_e${episodeNum}`;

    const updatedRoom = {
      ...(roomRef.current || {}),
      currentMovieUrl: embedUrl,
      movieId: targetId,
      mediaType: 'tv',
      isPlaying: true,
      currentTime: 0
    };
    updateRoomState(updatedRoom);

    participantStateRef.current.mediaKey = mediaKey;
    participantStateRef.current.movieId = targetId;
    participantStateRef.current.isPlaying = true;
    setIframeSrc(embedUrl);
    localProgressRef.current = 0;
    adminStateRef.current = { progress: 0, status: 'playing' };
    lastEmittedStatusRef.current = 'playing';

    setShowBrowseView(false);
    setSelectedTvForModal(null);
    setSearchQuery('');
    setSearchResults([]);

    try {
      await api.post(`/rooms/${roomCode}/playback`, {
        currentMovieUrl: embedUrl,
        movieId: targetId,
        mediaType: 'tv',
        isPlaying: true,
        currentTime: 0,
        playbackSpeed: 1.0
      });
    } catch (e) {
      alert('Failed to start episode in room');
    }
  };

  // ─── ADMIN: Select movie or TV show from search / recommendations ───
  const handleSelectMovie = async (item) => {
    const mType = item.media_type || (item.name && !item.title ? 'tv' : 'movie');
    const tmdbId = String(item.id);

    if (mType === 'tv') {
      setSelectedTvForModal(item);
      return;
    }

    const embedUrl = buildMelopeeUrl(tmdbId, 'movie', 0);

    const updatedRoom = {
      ...(roomRef.current || {}),
      currentMovieUrl: embedUrl,
      movieId: tmdbId,
      mediaType: 'movie',
      isPlaying: true,
      currentTime: 0
    };
    updateRoomState(updatedRoom);

    participantStateRef.current.mediaKey = `movie_${tmdbId}`;
    participantStateRef.current.movieId = tmdbId;
    participantStateRef.current.isPlaying = true;
    setIframeSrc(embedUrl);
    localProgressRef.current = 0;
    adminStateRef.current = { progress: 0, status: 'playing' };
    lastEmittedStatusRef.current = 'playing';
    setShowBrowseView(false);
    setSelectedTvForModal(null);
    setSearchQuery('');
    setSearchResults([]);

    try {
      await api.post(`/rooms/${roomCode}/playback`, {
        currentMovieUrl: embedUrl,
        movieId: tmdbId,
        mediaType: 'movie',
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
                    if (roomRef.current?.isPlaying !== false) {
                      triggerAutoPlay();
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
                {isCurrentTv && (
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-brand-background border border-brand-hover text-[11px] font-bold text-brand-emerald flex items-center gap-1.5">
                      <Tv size={12} /> S{currentTvInfo.season} • E{currentTvInfo.episode}
                    </span>
                  </div>
                )}
              </div>

              {/* TV Series Season & Episode Selection Bar */}
              {isCurrentTv && (
                <div className="bg-brand-surface border-t border-brand-hover p-4 flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/20">
                        <Tv size={16} />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white flex items-center gap-2">
                          <span>{currentTvDetails?.name || room.title}</span>
                          <span className="px-2 py-0.5 rounded-full bg-brand-emerald/20 text-brand-emerald text-[11px] font-bold">
                            Season {currentTvInfo.season} • Episode {currentTvInfo.episode}
                          </span>
                        </h3>
                        <p className="text-[10px] text-gray-400">
                          {isOwner
                            ? 'Admin Control: Select any episode to sync & autoplay for all participants'
                            : `Episode selection is controlled by ${room.ownerName}`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowEpisodesDrawer(!showEpisodesDrawer)}
                      className="px-2.5 py-1 rounded-lg bg-brand-background hover:bg-brand-hover border border-brand-hover text-xs font-semibold flex items-center gap-1 text-gray-300 transition-colors cursor-pointer"
                    >
                      {showEpisodesDrawer ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {showEpisodesDrawer ? 'Hide Episodes' : 'Show Episodes'}
                    </button>
                  </div>

                  {showEpisodesDrawer && (
                    <div className="flex flex-col gap-3 pt-2 border-t border-brand-hover/50">
                      {/* Season Tabs */}
                      {currentTvDetails?.seasons && currentTvDetails.seasons.length > 0 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                          {currentTvDetails.seasons
                            .filter(s => s.season_number > 0)
                            .map(s => {
                              const isSeasonActive = activeSeason === s.season_number;
                              return (
                                <button
                                  key={s.id}
                                  onClick={() => setActiveSeason(s.season_number)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                                    isSeasonActive
                                      ? 'bg-brand-emerald text-black shadow-md'
                                      : 'bg-brand-background text-gray-300 hover:bg-brand-hover border border-brand-hover/80'
                                  }`}
                                >
                                  {s.name || `Season ${s.season_number}`}
                                </button>
                              );
                            })}
                        </div>
                      )}

                      {/* Episodes Grid */}
                      {loadingEpisodes ? (
                        <div className="flex justify-center py-6">
                          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-brand-emerald"></div>
                        </div>
                      ) : seasonEpisodes.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-1">
                          {seasonEpisodes.map(ep => {
                            const isPlayingThisEp = currentTvInfo.season === activeSeason && currentTvInfo.episode === ep.episode_number;
                            return (
                              <button
                                key={ep.id}
                                disabled={!isOwner}
                                onClick={() => handleSelectEpisode(activeSeason, ep.episode_number)}
                                className={`text-left p-2 rounded-xl border transition-all flex flex-col justify-between gap-1 text-xs ${
                                  isPlayingThisEp
                                    ? 'bg-brand-emerald/15 border-brand-emerald text-white ring-1 ring-brand-emerald shadow-lg'
                                    : 'bg-brand-background border-brand-hover hover:border-brand-hover/80 text-gray-300'
                                } ${isOwner ? 'cursor-pointer hover:border-brand-emerald/70' : 'cursor-default opacity-80'}`}
                                title={!isOwner ? 'Only room admin can change episodes' : `Play Episode ${ep.episode_number}: ${ep.name}`}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    isPlayingThisEp ? 'bg-brand-emerald text-black' : 'bg-brand-surface text-brand-emerald'
                                  }`}>
                                    Ep {ep.episode_number}
                                  </span>
                                  {isPlayingThisEp ? (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-brand-emerald">
                                      <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald animate-ping"></span> Playing
                                    </span>
                                  ) : isOwner ? (
                                    <Play size={10} className="text-gray-400 group-hover:text-brand-emerald" />
                                  ) : null}
                                </div>
                                <p className="text-[11px] font-semibold truncate w-full" title={ep.name}>
                                  {ep.name || `Episode ${ep.episode_number}`}
                                </p>
                                {ep.runtime && (
                                  <span className="text-[9px] text-gray-500">{ep.runtime}m</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 text-center py-4">No episodes found for this season.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
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
                            <span className="text-xs font-bold text-black bg-brand-emerald px-4 py-2 rounded-xl">
                              {(item.media_type === 'tv' || (!item.title && item.name)) ? 'Select Episode' : 'Play Now'}
                            </span>
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
                <div className="text-center py-16 bg-brand-surface border-brand-hover rounded-2xl max-w-lg mx-auto w-full p-8 shadow-xl">
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

      {/* Modal for selecting TV series season and episode when picking from browse/search */}
      {selectedTvForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-brand-surface border border-brand-hover rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-brand-hover flex items-center justify-between bg-brand-background/60">
              <div className="flex items-center gap-3">
                <img
                  src={getImageUrl(selectedTvForModal.poster_path, 'w92')}
                  alt={selectedTvForModal.name || selectedTvForModal.title}
                  className="w-10 h-14 object-cover rounded-lg border border-brand-hover flex-shrink-0"
                />
                <div>
                  <h2 className="text-base font-bold text-white truncate max-w-sm sm:max-w-md">
                    {selectedTvForModal.name || selectedTvForModal.title}
                  </h2>
                  <p className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                    <span className="px-1.5 py-0.5 bg-brand-emerald/20 text-brand-emerald rounded text-[10px] font-bold uppercase">TV Series</span>
                    {(selectedTvForModal.first_air_date || selectedTvForModal.release_date) && (
                      <span>{new Date(selectedTvForModal.first_air_date || selectedTvForModal.release_date).getFullYear()}</span>
                    )}
                    {modalTvDetails?.number_of_seasons && (
                      <span>• {modalTvDetails.number_of_seasons} Season{modalTvDetails.number_of_seasons > 1 ? 's' : ''}</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTvForModal(null)}
                className="p-2 rounded-xl hover:bg-brand-hover text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-4">
              {/* Quick Action: Play Season 1 Episode 1 */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-brand-background border border-brand-hover">
                <div>
                  <p className="text-xs font-bold text-white">Start from the beginning</p>
                  <p className="text-[11px] text-gray-400">Play Season 1, Episode 1 immediately</p>
                </div>
                <button
                  onClick={() => handleSelectEpisode(1, 1, selectedTvForModal)}
                  className="px-4 py-2 rounded-xl bg-brand-emerald text-black font-bold text-xs hover:bg-emerald-400 transition-colors flex items-center gap-1.5 shadow-md shadow-brand-emerald/20 cursor-pointer"
                >
                  <Play size={13} fill="currentColor" /> Quick Play S1:E1
                </button>
              </div>

              {/* Season Selection Tabs */}
              {modalTvDetails?.seasons && modalTvDetails.seasons.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                    Select Season
                  </label>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                    {modalTvDetails.seasons
                      .filter(s => s.season_number > 0)
                      .map(s => (
                        <button
                          key={s.id}
                          onClick={() => handleModalSeasonChange(s.season_number)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                            modalSeason === s.season_number
                              ? 'bg-brand-emerald text-black shadow-md'
                              : 'bg-brand-background text-gray-300 hover:bg-brand-hover border border-brand-hover'
                          }`}
                        >
                          {s.name || `Season ${s.season_number}`}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Episode Selection List */}
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                  Select Episode ({modalEpisodes.length})
                </label>

                {loadingModalEpisodes ? (
                  <div className="flex justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-emerald"></div>
                  </div>
                ) : modalEpisodes.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                    {modalEpisodes.map(ep => (
                      <div
                        key={ep.id}
                        onClick={() => handleSelectEpisode(modalSeason, ep.episode_number, selectedTvForModal)}
                        className="p-2.5 rounded-xl bg-brand-background border border-brand-hover hover:border-brand-emerald transition-all cursor-pointer flex flex-col justify-between gap-1 group shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded bg-brand-surface text-brand-emerald text-xs font-bold">
                            Ep {ep.episode_number}
                          </span>
                          <span className="text-[11px] font-bold text-brand-emerald opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <Play size={10} fill="currentColor" /> Play
                          </span>
                        </div>
                        <p className="text-xs font-bold text-white truncate group-hover:text-brand-emerald transition-colors">
                          {ep.name || `Episode ${ep.episode_number}`}
                        </p>
                        {ep.overview && (
                          <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                            {ep.overview}
                          </p>
                        )}
                        {ep.runtime && (
                          <span className="text-[10px] text-gray-500 mt-1">{ep.runtime} min</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 text-center py-6">No episodes found for this season.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WatchTogetherRoom;
