import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Film, Users, Search, ArrowLeft, Check, X, AlertCircle, Share2, Copy, MessageSquare } from 'lucide-react';
import api from '../utils/api';
import { fetchMovies, getImageUrl } from '../utils/tmdb';
import useRoomWebSocket from '../hooks/useRoomWebSocket';

const buildMelopeeUrl = (id, type = 'movie', startAt = 0, season = 1, episode = 1) => {
  const timePos = Math.floor(startAt || 0);
  const base = type === 'tv'
    ? `https://player.melopee.app/embed/tv?tmdb=${id}&season=${season}&episode=${episode}&quality=auto&muted=false&autoplay=1&t=${timePos}`
    : `https://player.melopee.app/embed/movie?tmdb=${id}&quality=auto&muted=false&autoplay=1&t=${timePos}`;
  return base;
};

const extractMovieId = (roomData) => {
  if (!roomData) return null;
  if (roomData.currentMovieUrl) {
    const match = roomData.currentMovieUrl.match(/[?&]tmdb=(\d+)/);
    if (match) return match[1];
  }
  return roomData.movieId ? String(roomData.movieId) : null;
};

const extractTvInfo = (url) => {
  if (!url) return { season: 1, episode: 1 };
  const sMatch = url.match(/[?&]season=(\d+)/);
  const eMatch = url.match(/[?&]episode=(\d+)/);
  return {
    season: sMatch ? parseInt(sMatch[1], 10) : 1,
    episode: eMatch ? parseInt(eMatch[1], 10) : 1
  };
};

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

// Web Audio API "tung" sound generator for new join requests
const playTungSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(260, audioCtx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch (e) {}
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
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const chatDrawerOpenRef = useRef(false);
  useEffect(() => { chatDrawerOpenRef.current = chatDrawerOpen; }, [chatDrawerOpen]);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevMessagesLengthRef = useRef(0);
  const isInitialMessageLoadRef = useRef(true);

  const [showBrowseView, setShowBrowseView] = useState(false);

  const [browseQuery, setBrowseQuery] = useState('');
  const [browseGenre, setBrowseGenre] = useState('');
  const [browseSort, setBrowseSort] = useState('popularity.desc');
  const [browseYear, setBrowseYear] = useState('');
  const [browsePage, setBrowsePage] = useState(1);
  const [browseTotalPages, setBrowseTotalPages] = useState(1);
  const [browseMovies, setBrowseMovies] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);

  // Fetch movies when filters change or modal opens
  useEffect(() => {
    if (!showBrowseView) return;
    setBrowsePage(1);
    fetchBrowseResults(1, true);
  }, [showBrowseView, browseQuery, browseGenre, browseSort, browseYear]);

  const fetchBrowseResults = async (pageNum, reset = false) => {
    setBrowseLoading(true);
    try {
      let res;
      if (browseQuery.trim()) {
        res = await fetchMovies.searchMulti(browseQuery);
        const results = (res.data.results || []).filter(m => m.poster_path && m.media_type !== 'person');
        setBrowseMovies(reset ? results : (prev => [...prev, ...results]));
        setBrowseTotalPages(res.data.total_pages || 1);
      } else {
        const params = {
          page: pageNum,
          sort_by: browseSort,
          include_adult: true,
        };
        if (browseGenre) params.with_genres = browseGenre;
        if (browseYear) params.primary_release_year = browseYear;

        res = await fetchMovies.fetchDiscover(params);
        const results = res.data.results || [];
        setBrowseMovies(reset ? results : (prev => [...prev, ...results]));
        setBrowseTotalPages(res.data.total_pages || 1);
      }
    } catch (e) {
      if (reset) setBrowseMovies([]);
    } finally {
      setBrowseLoading(false);
    }
  };

  const handleBrowseScroll = (e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 300 && !browseLoading && browsePage < browseTotalPages) {
      const next = browsePage + 1;
      setBrowsePage(next);
      fetchBrowseResults(next, false);
    }
  };

  const [toastMessage, setToastMessage] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const iframeRef = useRef(null);
  const roomRef = useRef(null);
  const chatBoxRef = useRef(null);
  const prevRequestsCountRef = useRef(0);

  // Refs for tracking playback state
  const localProgressRef = useRef(0);
  const adminStateRef = useRef({ progress: 0, status: 'paused' });
  const lastEmittedStatusRef = useRef('playing');
  const lastServerAdminTimeRef = useRef(null);
  const lastServerPlayingRef = useRef(null);
  const lastAdminSeekTimeRef = useRef(0);
  const lastParticipantSeekTimeRef = useRef(0);

  const [iframeSrc, setIframeSrc] = useState('');

  const isOwner = user && room && room.ownerId === user.id;
  const isAdmin = isOwner || (myParticipant && myParticipant.isAdmin);

  const updateRoomState = (newRoom) => {
    roomRef.current = newRoom;
    setRoom(newRoom);
  };

  // Send player commands via postMessage to control iframe player
  const sendPlayerCommand = (action) => {
    if (!iframeRef.current?.contentWindow) return;
    try {
      const msg = { player: true, action };
      const strMsg = JSON.stringify(msg);
      iframeRef.current.contentWindow.postMessage(msg, '*');
      iframeRef.current.contentWindow.postMessage(strMsg, '*');

      // Forward to nested frames if accessible
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

  // Trigger autoplay with retries
  const triggerAutoPlay = () => {
    sendPlayerCommand('play');
    setTimeout(() => sendPlayerCommand('play'), 200);
    setTimeout(() => sendPlayerCommand('play'), 500);
    setTimeout(() => sendPlayerCommand('play'), 1000);
  };

  // Listen for postMessage PLAYER_EVENT from the player iframe
  useEffect(() => {
    const handleMessage = (event) => {
      let payload = event.data;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch (e) { return; }
      }
      if (payload?.type !== 'PLAYER_EVENT') return;

      const { player_status, player_progress } = payload.data || {};

      // Update local progress
      if (typeof player_progress === 'number') {
        const prevProgress = localProgressRef.current;
        localProgressRef.current = player_progress;

        // ADMIN: Track and broadcast state
        if (isAdmin) {
          const isSeekJump = prevProgress > 0 && Math.abs(player_progress - prevProgress) > 3;
          const isSeekedEvent = player_status === 'seeked' || isSeekJump;

          if (isSeekedEvent) {
            lastAdminSeekTimeRef.current = Date.now();
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
                isPlaying: true,
                currentTime: player_progress,
                playbackSpeed: 1.0
              }).catch(() => {});
            }
            return;
          }

          // Don't pause if admin just seeked
          const justAdminSeeked = Date.now() - lastAdminSeekTimeRef.current < 3000;
          if (justAdminSeeked && (player_status === 'paused' || player_status === 'pause')) {
            triggerAutoPlay();
            adminStateRef.current = { progress: player_progress, status: 'playing' };
            return;
          }

          // Normal state updates
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
        } else {
          // MEMBER: Handle seek events
          const justSeeked = Date.now() - lastParticipantSeekTimeRef.current < 4000;
          if (player_status === 'seeked' || (justSeeked && (player_status === 'paused' || player_status === 'pause'))) {
            if (roomRef.current?.isPlaying !== false) {
              triggerAutoPlay();
            }
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isAdmin, roomCode]);

  // ADMIN: Stream playback state periodically
  useEffect(() => {
    if (!isAdmin) return;

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
  }, [isAdmin, roomCode]);
  useEffect(() => {
    if (!myParticipant || myParticipant.status !== 'PENDING') return;

    const interval = setInterval(async () => {
      try {
        const syncRes = await api.get(`/rooms/${roomCode}/sync`);
        const pList = syncRes.data.participants || [];
        const me = pList.find(p => p.id === myParticipant.id || p.name === myParticipant.name);
        if (me && me.status === 'APPROVED') {
          setMyParticipant(me);
          showToast(`Your join request was approved! Entering room...`);
        }
      } catch (e) {}
    }, 2000);

    return () => clearInterval(interval);
  }, [roomCode, myParticipant]);

  // Initial Room Setup
  useEffect(() => {
    let isMounted = true;
    const initRoom = async () => {
      try {
        const res = await api.get(`/rooms/${roomCode}`);
        if (!isMounted) return;
        const roomData = res.data;
        updateRoomState(roomData);
        setParticipants(roomData.participants || []);

        // Load initial movie if one is already playing
        if (roomData.currentMovieUrl) {
          const movieId = extractMovieId(roomData);
          const mediaType = roomData.mediaType || 'movie';
          const currentTime = roomData.currentTime || 0;
          const { season, episode } = extractTvInfo(roomData.currentMovieUrl);
          const initialUrl = buildMelopeeUrl(movieId, mediaType, currentTime, season, episode);
          setIframeSrc(initialUrl);

          // Initialize last known admin time for new members
          lastServerAdminTimeRef.current = currentTime;
          lastServerPlayingRef.current = roomData.isPlaying;
        }

        if (user && (roomData.ownerId === user.id || roomData.participants?.some(p => p.userId === user.id && p.isAdmin))) {
          const me = roomData.participants.find(p => p.userId === user.id) || { name: user.username, status: 'APPROVED', isAdmin: roomData.ownerId === user.id };
          setMyParticipant(me);
          setHasRequested(true);
          if (me.isAdmin || roomData.ownerId === user.id) {
            const reqRes = await api.get(`/rooms/${roomCode}/requests`);
            if (isMounted) setPendingRequests(reqRes.data || []);
          }
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

  // Sync participants, messages, pending requests, and playback state
  useEffect(() => {
    if (!myParticipant || myParticipant.status !== 'APPROVED') return;

    const interval = setInterval(async () => {
      try {
        const syncRes = await api.get(`/rooms/${roomCode}/sync`);
        const serverRoom = syncRes.data.room;
        const newParticipants = syncRes.data.participants || [];

        if (newParticipants.length > participants.length) {
          const joined = newParticipants[newParticipants.length - 1];
          if (joined && joined.name !== myParticipant.name) {
            showToast(`${joined.name} joined the room`);
          }
        }

        setParticipants(newParticipants);

        // Check if I was removed from the room
        if (myParticipant) {
          const amIStillInRoom = newParticipants.some(p => p.id === myParticipant.id || p.name === myParticipant.name);
          if (!amIStillInRoom) {
            alert('You have been removed from the room.');
            navigate('/watch-together');
            return;
          }
        }

        const newMsgs = syncRes.data.messages || [];
        setMessages(newMsgs);

        if (isInitialMessageLoadRef.current) {
          prevMessagesLengthRef.current = newMsgs.length;
          isInitialMessageLoadRef.current = false;
        } else if (!chatDrawerOpenRef.current) {
          if (newMsgs.length > prevMessagesLengthRef.current) {
            const added = newMsgs.length - prevMessagesLengthRef.current;
            setUnreadCount(c => c + added);
            prevMessagesLengthRef.current = newMsgs.length;
          }
        } else {
          prevMessagesLengthRef.current = newMsgs.length;
        }

        if (serverRoom) {
          updateRoomState(serverRoom);

          // MEMBER: Sync playback via postMessage commands
          if (!isAdmin) {
            const serverMovieId = extractMovieId(serverRoom);
            const serverMediaType = serverRoom.mediaType || 'movie';

            if (serverMovieId && serverRoom.currentMovieUrl) {
              // Check if movie/episode changed - reload iframe
              const currentMovieId = extractMovieId(room);
              const { season: currentSeason, episode: currentEpisode } = extractTvInfo(room?.currentMovieUrl || '');
              const { season: serverSeason, episode: serverEpisode } = extractTvInfo(serverRoom.currentMovieUrl);

              const movieChanged = currentMovieId !== serverMovieId;
              const episodeChanged = serverMediaType === 'tv' && (currentSeason !== serverSeason || currentEpisode !== serverEpisode);

              if (movieChanged || episodeChanged || !iframeSrc) {
                // Movie/episode changed - reload iframe with new URL
                const serverTime = serverRoom.currentTime || 0;
                const targetUrl = buildMelopeeUrl(serverMovieId, serverMediaType, serverTime, serverSeason, serverEpisode);
                console.log('[Member Sync] Loading new movie/episode:', targetUrl);
                setIframeSrc(targetUrl);
                lastServerAdminTimeRef.current = serverTime;
                lastServerPlayingRef.current = serverRoom.isPlaying;
                return;
              }

              // Same movie/episode - sync play/pause/seek via postMessage

              // 1) Play/Pause sync
              if (lastServerPlayingRef.current !== serverRoom.isPlaying) {
                lastServerPlayingRef.current = serverRoom.isPlaying;
                if (serverRoom.isPlaying) {
                  console.log('[Member Sync] Admin playing - triggering play');
                  triggerAutoPlay();
                } else {
                  console.log('[Member Sync] Admin paused - sending pause');
                  sendPlayerCommand('pause');
                }
              }

              // 2) Seek sync (admin jumped to new time)
              // Only sync if there's a REAL jump, not natural playback drift
              const currentAdminTime = serverRoom.currentTime || 0;
              const prevAdminTime = lastServerAdminTimeRef.current !== null ? lastServerAdminTimeRef.current : currentAdminTime;

              // Calculate expected drift (2 seconds since last poll + admin's 1.5s broadcast interval)
              const expectedDrift = 2; // 2 second polling interval
              const actualDrift = currentAdminTime - prevAdminTime;

              // Only seek if drift is significantly different from expected
              // This means admin actually jumped, not just natural playback
              const unexpectedJump = Math.abs(actualDrift - expectedDrift);

              // Only seek if jump is > 6 seconds to avoid micro-corrections
              if (unexpectedJump > 6) {
                console.log('[Member Sync] Admin seeked to:', currentAdminTime, 'seconds (unexpected jump:', unexpectedJump, 's)');
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

        if (isAdmin) {
          const reqRes = await api.get(`/rooms/${roomCode}/requests`);
          const reqs = reqRes.data || [];
          if (reqs.length > prevRequestsCountRef.current) {
            playTungSound();
            showToast('New join request received!');
          }
          prevRequestsCountRef.current = reqs.length;
          setPendingRequests(reqs);
        }
      } catch (err) {}
    }, 2000); // Poll every 2 seconds to reduce sync frequency

    return () => clearInterval(interval);
  }, [roomCode, myParticipant, isAdmin, participants.length, navigate, iframeSrc, room]);

  // Immediate sync for new members joining mid-playback
  useEffect(() => {
    if (!myParticipant || myParticipant.status !== 'APPROVED' || isAdmin || !iframeSrc) return;

    // Wait for iframe to load, then do an immediate sync check
    const timer = setTimeout(async () => {
      try {
        const syncRes = await api.get(`/rooms/${roomCode}/sync`);
        const serverRoom = syncRes.data.room;

        if (serverRoom && serverRoom.currentMovieUrl) {
          const serverTime = serverRoom.currentTime || 0;
          const initialTime = lastServerAdminTimeRef.current || 0;
          const drift = Math.abs(serverTime - initialTime);

          // If there's significant drift, immediately seek to catch up
          if (drift > 3) {
            console.log('[Initial Sync] Catching up to admin position:', serverTime, 'seconds (drift:', drift, 's)');
            setTimeout(() => {
              sendPlayerCommand(`seek${Math.floor(serverTime)}`);
              if (serverRoom.isPlaying) {
                triggerAutoPlay();
              }
            }, 2000); // Wait 2 seconds for iframe to fully load
          }

          lastServerAdminTimeRef.current = serverTime;
          lastServerPlayingRef.current = serverRoom.isPlaying;
        }
      } catch (err) {
        console.error('[Initial Sync] Failed:', err);
      }
    }, 1000); // Wait 1 second after component mounts

    return () => clearTimeout(timer);
  }, [myParticipant?.status, isAdmin, iframeSrc, roomCode]);

  // Fetch trending movies for admin selection
  useEffect(() => {
    if (showBrowseView && isOwner) {
      fetchMovies.fetchTrending(1)
        .then(res => setRecommendations(res.data.results || []))
        .catch(() => setRecommendations([]));
    }
  }, [showBrowseView, isOwner]);

  // Chat auto-scroll to bottom and mark read if drawer open
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
    if (chatDrawerOpen) {
      setUnreadCount(0);
      prevMessagesLengthRef.current = messages.length;
    }
  }, [messages, chatDrawerOpen]);

  const handleRequestJoin = async (e) => {
    e.preventDefault();
    if (!guestNameInput.trim()) return;
    try {
      const name = guestNameInput.trim();
      localStorage.setItem(`room_joined_${roomCode}`, name);
      const joinRes = await api.post(`/rooms/${roomCode}/join`, { name });
      setMyParticipant(joinRes.data);
      setHasRequested(true);
      showToast('Join request sent successfully!');
    } catch (err) { alert(err.response?.data || 'Failed to send join request'); }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    const text = inputMessage.trim();
    setInputMessage('');
    try {
      await api.post(`/rooms/${roomCode}/chat`, { senderName: myParticipant?.name || user?.username || 'Guest', message: text });
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
      showToast(approve ? 'Participant approved!' : 'Participant rejected.');
    } catch (err) { alert('Failed to process request'); }
  };

  const handleRemoveMember = async (participantId) => {
    try {
      await api.post(`/rooms/${roomCode}/remove-participant`, { participantId });
      const syncRes = await api.get(`/rooms/${roomCode}/sync`);
      setParticipants(syncRes.data.participants || []);
      showToast('Participant removed');
    } catch (e) {
      alert(e.response?.data || 'Failed to remove participant');
    }
  };

  const handleToggleAdmin = async (participantId, currentIsAdmin) => {
    try {
      await api.post(`/rooms/${roomCode}/set-admin`, { participantId, isAdmin: !currentIsAdmin });
      const syncRes = await api.get(`/rooms/${roomCode}/sync`);
      setParticipants(syncRes.data.participants || []);
      showToast(currentIsAdmin ? 'Admin rights revoked' : 'Granted admin rights');
    } catch (e) {
      alert(e.response?.data || 'Failed to update admin status');
    }
  };

  // WebSocket playback event handler
  const handlePlaybackEvent = useCallback((event) => {
    console.log('[Room] Received playback event:', event);

    if (!event) return;

    const { eventType, movieId, mediaType, currentMovieUrl, currentTime } = event;

    // For non-admin members, sync to admin's exact position
    if (!isAdmin && movieId && mediaType) {
      const { season, episode } = extractTvInfo(currentMovieUrl);
      const newUrl = buildMelopeeUrl(movieId, mediaType, currentTime || 0, season, episode);
      console.log('[Room] Member syncing to:', newUrl);
      setIframeSrc(newUrl);

      if (eventType === 'MOVIE_CHANGE') {
        showToast(`Now playing: ${movieId}`);
      }
    }
  }, [isAdmin]);

  // Initialize WebSocket connection
  const { sendPlaybackEvent } = useRoomWebSocket(
    roomCode,
    user?.id,
    handlePlaybackEvent
  );

  const selectMovie = async (movie, mediaType, season = 1, episode = 1) => {
    const movieId = String(movie.id);
    const url = buildMelopeeUrl(movieId, mediaType, 0, season, episode);

    try {
      // Update backend state
      const response = await api.post(`/rooms/${roomCode}/playback`, {
        currentMovieUrl: url,
        movieId,
        mediaType,
        isPlaying: true,
        currentTime: 0,
        playbackSpeed: 1.0
      });

      // Update local room state so UI switches to player screen
      if (response.data) {
        updateRoomState(response.data);
      }

      // Reset state tracking
      localProgressRef.current = 0;
      adminStateRef.current = { progress: 0, status: 'playing' };
      lastServerAdminTimeRef.current = 0;
      lastServerPlayingRef.current = true;

      // Broadcast via WebSocket
      sendPlaybackEvent('MOVIE_CHANGE', {
        movieId,
        mediaType,
        currentMovieUrl: url,
        isPlaying: true,
        currentTime: 0,
        playbackSpeed: 1.0
      });

      setIframeSrc(url);
      setShowBrowseView(false);
      showToast(`Now playing: ${movie.title || movie.name}`);
    } catch (e) {
      alert('Failed to start movie');
    }
  };

  const shareableLink = window.location.origin + '/watch-together/' + roomCode;

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: room?.title || 'Watch Party',
          text: `Join my Watch Party on SnMflix!`,
          url: shareableLink,
        });
        showToast('Shared successfully!');
      } catch (err) {}
    } else {
      navigator.clipboard.writeText(shareableLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      showToast('Link copied to clipboard!');
    }
  };

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
            Back to Watch Together
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
          <p className="text-xs text-gray-400 mb-6">Your request to join <span className="text-white font-bold">{room.title}</span> has been sent. You will enter automatically upon approval.</p>
          <button onClick={() => navigate('/watch-together')} className="text-xs text-gray-500 hover:text-white transition-colors cursor-pointer">Cancel and Return</button>
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

  // Messenger Chat Component
  const renderChatSection = () => (
    <div className="flex flex-col h-full bg-brand-surface border-l border-brand-hover min-h-0">
      <div className="p-3.5 border-b border-brand-hover flex items-center justify-between bg-brand-surface/90 backdrop-blur-md flex-shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-wider text-brand-emerald flex items-center gap-1.5">
          <MessageSquare size={14} /> Room Chat
        </h3>
        <span className="text-[10px] text-gray-400">{messages.length} messages</span>
      </div>

      <div ref={chatBoxRef} className="flex-1 min-h-0 p-4 overflow-y-auto space-y-3 custom-scrollbar flex flex-col">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-gray-500 my-auto">No messages yet. Say hello to your friends! 👋</p>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderName === (myParticipant?.name || user?.username);
            return (
              <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-full`}>
                <span className="text-[10px] text-gray-400 mb-0.5 px-1">{msg.senderName}</span>
                <div className={`p-3 rounded-2xl text-xs max-w-[85%] break-words shadow-sm ${
                  isMe
                    ? 'bg-brand-emerald text-black rounded-tr-sm font-medium'
                    : 'bg-brand-background text-white border border-brand-hover rounded-tl-sm'
                }`}>
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSendMessage} className="p-3 border-t border-brand-hover flex gap-2 bg-brand-surface flex-shrink-0">
        <input
          type="text"
          value={inputMessage}
          onChange={e => setInputMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 p-2.5 bg-brand-background border border-brand-hover rounded-xl text-xs text-white focus:outline-none focus:border-brand-emerald"
        />
        <button
          type="submit"
          className="px-4 py-2.5 bg-brand-emerald text-black font-bold text-xs rounded-xl hover:bg-emerald-400 transition-colors cursor-pointer shadow-md"
        >
          Send
        </button>
      </form>
    </div>
  );

  return (
    <div className="h-screen bg-brand-background text-white flex flex-col overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-brand-emerald text-black font-bold text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <Check size={16} /> {toastMessage}
        </div>
      )}

      {/* Top Bar */}
      <header className="bg-brand-surface border-b border-brand-hover px-4 py-3 flex items-center justify-between z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/watch-together')} className="p-2 rounded-xl bg-brand-background hover:bg-brand-hover text-gray-300 transition-colors cursor-pointer"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-sm font-bold truncate max-w-xs sm:max-w-md">{room.title}</h1>
            <p className="text-[11px] text-gray-400 flex items-center gap-2">
              <span>Code: <strong className="text-brand-emerald font-mono">{room.roomCode}</strong></span>
              <span>•</span>
              <span>Owner: {room.ownerName}</span>
              {isAdmin && <span className="px-1.5 py-0.5 bg-brand-emerald/20 text-brand-emerald rounded text-[10px] font-bold">Admin</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {room.currentMovieUrl && isAdmin && (
            <button
              onClick={() => setShowBrowseView(!showBrowseView)}
              className="px-3 py-1.5 rounded-xl bg-brand-emerald text-black hover:bg-emerald-400 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-md"
            >
              {showBrowseView ? <><Film size={14} /> Back to Player</> : <><Search size={14} /> Change Movie</>}
            </button>
          )}
          <button
            onClick={handleNativeShare}
            className="px-3 py-1.5 rounded-xl bg-brand-background hover:bg-brand-hover border border-brand-hover text-xs font-semibold flex items-center gap-1.5 text-gray-300 transition-colors cursor-pointer"
          >
            {copiedLink ? <Check size={14} className="text-brand-emerald" /> : <Share2 size={14} className="text-brand-emerald" />}
            {copiedLink ? "Link Copied" : "Share Link"}
          </button>
        </div>
      </header>

      {/* Admin Pending Requests Banner */}
      {isAdmin && pendingRequests.length > 0 && (
        <div className="bg-yellow-950/90 border-b border-yellow-900/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3 z-30 shadow-xl flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-yellow-400 animate-pulse" />
            <span className="text-xs font-bold text-yellow-300">
              Pending Join Requests ({pendingRequests.length}):
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingRequests.map(req => (
              <div key={req.id} className="flex items-center gap-2 bg-brand-background px-3 py-1.5 rounded-xl border border-yellow-800/40 text-xs shadow-md">
                <span className="font-bold text-white">{req.name}</span>
                <button
                  onClick={() => handleApproveRequest(req.id, true)}
                  className="px-2.5 py-1 bg-brand-emerald text-black font-bold rounded-lg hover:bg-emerald-400 text-[10px] cursor-pointer"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleApproveRequest(req.id, false)}
                  className="px-2.5 py-1 bg-red-600 text-white font-bold rounded-lg hover:bg-red-500 text-[10px] cursor-pointer"
                >
                  Reject
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main View: Waiting Lobby OR Active Room Player/Browse */}
      {!room.currentMovieUrl ? (
        /* WAITING LOBBY SCREEN - Responsive: stacked on mobile, side-by-side on lg+ */
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden relative">
          {/* Left: Lobby Content */}
          <div className="flex-1 min-h-0 min-w-0 overflow-y-auto bg-brand-background px-5 py-5 custom-scrollbar">
            <div className="w-full h-full flex flex-col gap-4">

              {/* Room Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-emerald/10 border border-brand-emerald/20 text-brand-emerald flex items-center justify-center flex-shrink-0">
                  <Users size={20} />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-white leading-tight">{room.title}</h2>
                  <p className="text-[11px] text-gray-500">Waiting Lobby · Hosted by <span className="text-gray-300 font-semibold">{room.ownerName}</span></p>
                </div>
              </div>

              {/* Room Members - fills available space */}
              <div className="flex-1 min-h-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Members in Room</p>
                <div className="flex flex-wrap gap-4">
                  {participants.map((p, idx) => {
                    const isMe = p.name === (myParticipant?.name || user?.username);
                    const isParticipantAdmin = p.isAdmin || p.admin || (room && p.userId === room.ownerId);
                    return (
                      <div key={idx} className="relative group/member">
                        <div className={`flex flex-col items-center gap-1.5 p-2 w-20 rounded-xl transition-colors ${isAdmin && !isMe ? 'cursor-pointer hover:bg-brand-surface' : ''}`}>
                          <div className={`w-14 h-14 rounded-full flex items-center justify-center font-extrabold text-xl shadow-md ${isParticipantAdmin ? 'bg-brand-emerald/20 text-brand-emerald ring-2 ring-brand-emerald/40' : 'bg-brand-surface text-gray-300'}`}>
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                          <p className="text-xs font-semibold text-white truncate w-full text-center">{p.name}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none ${isParticipantAdmin ? 'bg-brand-emerald/15 text-brand-emerald' : 'text-gray-500'}`}>
                            {isParticipantAdmin ? 'Admin' : 'Member'}
                          </span>
                        </div>
                        {isAdmin && !isMe && (
                          <div className="absolute top-1 right-1 opacity-0 group-hover/member:opacity-100 transition-opacity bg-brand-surface border border-brand-hover rounded-xl shadow-2xl p-1.5 z-10 flex flex-col gap-1 text-[10px] min-w-[100px]">
                            <button onClick={() => handleToggleAdmin(p.id, isParticipantAdmin)} className="px-2.5 py-1.5 text-left text-brand-emerald hover:bg-brand-hover rounded-lg transition-colors">
                              {isParticipantAdmin ? 'Revoke Admin' : 'Make Admin'}
                            </button>
                            <button onClick={() => handleRemoveMember(p.id)} className="px-2.5 py-1.5 text-left text-red-400 hover:bg-red-950/40 rounded-lg transition-colors">
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom section: code + members + link + CTA */}
              <div className="flex flex-col gap-3">
                {/* Room Code + Member Count */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between px-4 py-3 bg-brand-surface border border-brand-hover rounded-xl">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Room Code</p>
                      <span className="text-2xl font-mono font-extrabold text-brand-emerald tracking-widest">{room.roomCode}</span>
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(room.roomCode); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); showToast('Room code copied!'); }}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-brand-hover rounded-lg transition-colors cursor-pointer flex-shrink-0"
                    >
                      {copiedCode ? <Check size={14} className="text-brand-emerald" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <div className="flex flex-col justify-center px-4 py-3 bg-brand-surface border border-brand-hover rounded-xl">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Members</p>
                    <p className="text-2xl font-extrabold text-white">{participants.length} <span className="text-sm font-normal text-gray-400">joined</span></p>
                  </div>
                </div>

                {/* Invite Link */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareableLink}
                    onClick={() => { navigator.clipboard.writeText(shareableLink); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); showToast('Link copied!'); }}
                    className="flex-1 min-w-0 px-3 py-2.5 bg-brand-surface border border-brand-hover rounded-xl text-xs text-gray-400 cursor-pointer hover:border-brand-emerald/50 transition-colors font-mono"
                    title="Click to copy"
                  />
                  <button
                    onClick={handleNativeShare}
                    className="px-4 py-2.5 bg-brand-emerald text-black font-bold text-xs rounded-xl hover:bg-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer shadow-md flex-shrink-0"
                  >
                    <Share2 size={13} /> Share
                  </button>
                </div>
                {copiedLink && <p className="text-[10px] text-brand-emerald -mt-1">✓ Copied!</p>}

                {/* Choose Movie or Show to Start CTA */}
                {isAdmin ? (
                  <button
                    onClick={() => setShowBrowseView(true)}
                    className="w-full py-3.5 rounded-xl font-bold bg-brand-emerald text-black hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 text-sm shadow-lg shadow-brand-emerald/20 cursor-pointer"
                  >
                    <Film size={16} /> Choose Movie or Show to Start
                  </button>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-surface border border-brand-hover/50 text-xs text-gray-400">
                    <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />
                    Waiting for <strong className="text-white mx-1">{room.ownerName}</strong> to choose a movie or show to start...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Divider line - only on lg+ */}
          <div className="hidden lg:block w-px bg-brand-hover flex-shrink-0" />

          {/* Right: Chat Panel - only visible on lg+ as sidebar */}
          <div className="hidden lg:flex lg:w-80 xl:w-96 flex-shrink-0 flex-col min-h-0">
            {renderChatSection()}
          </div>

          {/* Mobile: Floating Chat Button (bottom-right) */}
          <button
            onClick={() => {
              setChatDrawerOpen(true);
              setUnreadCount(0);
              prevMessagesLengthRef.current = messages.length;
            }}
            className="lg:hidden fixed bottom-6 right-5 z-40 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center cursor-pointer animate-bounce hover:bg-indigo-500 transition-colors"
            style={{ animationDuration: '2s' }}
            title="Open Chat"
          >
            <MessageSquare size={24} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Mobile: Chat Drawer Overlay */}
          {chatDrawerOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex">
              {/* 20% transparent backdrop - click to close */}
              <div
                className="w-[20%] flex-shrink-0 bg-black/40 backdrop-blur-[2px]"
                onClick={() => {
                  setChatDrawerOpen(false);
                  setUnreadCount(0);
                  prevMessagesLengthRef.current = messages.length;
                }}
              />
              {/* 80% chat panel */}
              <div className="flex-1 flex flex-col min-h-0 shadow-2xl">
                {renderChatSection()}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ACTIVE ROOM PLAYER SCREEN */
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 overflow-hidden">
          <div className="lg:col-span-2 flex flex-col bg-black overflow-y-auto min-h-0">
            <div className="relative w-full aspect-video bg-gray-950 flex-shrink-0">
              <iframe
                ref={iframeRef}
                src={iframeSrc}
                title="Watch Party Player"
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullScreen"
                allowFullScreen
              />
              {!isAdmin && (
                <div
                  className="absolute inset-0 z-20 bg-transparent cursor-not-allowed"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    showToast("Only room admins can control playback!");
                  }}
                />
              )}
            </div>
            <div className="p-4 bg-brand-surface border-t border-brand-hover flex flex-wrap items-center justify-between gap-4 flex-shrink-0">
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Synchronized Playback Active</span>
                  {isAdmin ? (
                    <span className="px-2 py-0.5 bg-brand-emerald/20 text-brand-emerald rounded text-[10px] font-bold">You are Admin (Controls Synced)</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] font-bold">Spectating Room Admin</span>
                  )}
                </p>
                <p className="text-[11px] text-gray-400">Admin play, pause, and seek actions are synchronized across all members in real-time.</p>
              </div>

              {isAdmin && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setShowBrowseView(true)}
                    className="px-3 py-1.5 bg-brand-emerald text-black font-bold text-xs rounded-xl hover:bg-emerald-400 transition-colors cursor-pointer"
                  >
                    Change Movie
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1 h-full min-h-0 flex flex-col">
            {renderChatSection()}
          </div>
        </div>
      )}

      {/* Movie Selection Modal */}
      {showBrowseView && isAdmin && (
        <div
          onScroll={handleBrowseScroll}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col p-4 sm:p-8 overflow-y-auto custom-scrollbar"
        >
          <div className="max-w-6xl mx-auto w-full flex justify-between items-center mb-6 flex-shrink-0">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Select Movie or Show to Watch</h2>
              <p className="text-xs text-gray-400">Search, filter genres, sort, and browse titles to start watching together</p>
            </div>
            <button onClick={() => setShowBrowseView(false)} className="p-2.5 bg-brand-surface rounded-xl hover:bg-brand-hover text-gray-300 hover:text-white cursor-pointer transition-colors"><X size={20} /></button>
          </div>

          <div className="max-w-6xl mx-auto w-full flex flex-col gap-6 flex-shrink-0 mb-6">
            {/* Search Bar */}
            <div>
              <input
                type="text"
                value={browseQuery}
                onChange={e => setBrowseQuery(e.target.value)}
                placeholder="Search movies or shows..."
                className="w-full bg-transparent border-b border-brand-hover pb-3 text-base sm:text-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-emerald transition-colors"
              />
            </div>

            {/* Filters (Borderless / Text links) */}
            <div className="space-y-3 text-xs">
              {/* Genres */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px] w-14">Genre:</span>
                {[
                  { label: 'All', id: '' },
                  { label: 'Action', id: '28' },
                  { label: 'Comedy', id: '35' },
                  { label: 'Horror', id: '27' },
                  { label: 'Romance', id: '10749' },
                  { label: 'Sci-Fi', id: '878' },
                  { label: 'Drama', id: '18' },
                  { label: 'Animation', id: '16' },
                  { label: 'Thriller', id: '53' },
                ].map(g => (
                  <button
                    key={g.id}
                    onClick={() => setBrowseGenre(g.id)}
                    className={`cursor-pointer transition-colors ${browseGenre === g.id ? 'text-brand-emerald font-bold' : 'text-gray-400 hover:text-white'}`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              {/* Sort By */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px] w-14">Sort:</span>
                {[
                  { label: 'Popular', id: 'popularity.desc' },
                  { label: 'Top Rated', id: 'vote_average.desc' },
                  { label: 'Newest', id: 'primary_release_date.desc' },
                ].map(s => (
                  <button
                    key={s.id}
                    onClick={() => setBrowseSort(s.id)}
                    className={`cursor-pointer transition-colors ${browseSort === s.id ? 'text-brand-emerald font-bold' : 'text-gray-400 hover:text-white'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Year */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px] w-14">Year:</span>
                {['', '2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019'].map(y => (
                  <button
                    key={y}
                    onClick={() => setBrowseYear(y)}
                    className={`cursor-pointer transition-colors ${browseYear === y ? 'text-brand-emerald font-bold' : 'text-gray-400 hover:text-white'}`}
                  >
                    {y === '' ? 'All' : y}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Movie Results Grid */}
          <div className="max-w-6xl mx-auto w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pb-12 flex-1">
            {browseMovies.map((m, idx) => (
              <div
                key={`${m.id}-${idx}`}
                onClick={() => selectMovie(m, m.media_type || (m.title ? 'movie' : 'tv'))}
                className="bg-brand-surface rounded-xl overflow-hidden cursor-pointer hover:ring-2 ring-brand-emerald transition-all group flex flex-col"
              >
                <div className="aspect-[2/3] relative bg-brand-background">
                  <img
                    src={getImageUrl(m.poster_path, 'w500')}
                    alt={m.title || m.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 text-center">
                    <span className="px-3 py-2 bg-brand-emerald text-black font-bold text-xs rounded-xl shadow-lg">Start Watching</span>
                  </div>
                </div>
                <div className="p-2.5 flex flex-col justify-between flex-1 bg-brand-surface">
                  <p className="text-xs font-bold text-white truncate">{m.title || m.name}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{m.release_date ? m.release_date.split('-')[0] : (m.first_air_date ? m.first_air_date.split('-')[0] : '')}</p>
                </div>
              </div>
            ))}
          </div>

          {browseLoading && (
            <div className="py-6 text-center text-xs text-brand-emerald font-semibold animate-pulse">
              Loading more movies & shows...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WatchTogetherRoom;
