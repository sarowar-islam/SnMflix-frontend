import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Film, Users, Search, ArrowLeft, Check, X, AlertCircle, Share2, Copy, MessageSquare, Clock, Trash2, AlertTriangle } from 'lucide-react';
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

  // Participants modal for admin
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);

  // Movie/Show details for display
  const [currentMediaDetails, setCurrentMediaDetails] = useState(null);
  const [showFullDescription, setShowFullDescription] = useState(false);

  // TV Series season/episode selection
  const [tvSeasons, setTvSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [seasonEpisodes, setSeasonEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  const [browseQuery, setBrowseQuery] = useState('');
  const [browseGenre, setBrowseGenre] = useState('');
  const [browseSort, setBrowseSort] = useState('popularity.desc');
  const [browseYear, setBrowseYear] = useState('');
  const [browsePage, setBrowsePage] = useState(1);
  const [browseTotalPages, setBrowseTotalPages] = useState(1);
  const [browseMovies, setBrowseMovies] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);

  // Room expiration countdown
  const [remainingTime, setRemainingTime] = useState('');

  // Close room confirmation modal
  const [showCloseRoomModal, setShowCloseRoomModal] = useState(false);

  // Update remaining time every second
  useEffect(() => {
    if (!room?.expiresAt) return;

    const updateCountdown = () => {
      const now = new Date();
      const expires = new Date(room.expiresAt);
      const diff = expires - now;

      if (diff <= 0) {
        setRemainingTime('Expired');
        // Redirect to lobby when expired
        setTimeout(() => {
          navigate('/watch-together');
        }, 2000);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setRemainingTime(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setRemainingTime(`${minutes}m ${seconds}s`);
      } else {
        setRemainingTime(`${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [room?.expiresAt, navigate]);

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

          console.log('[Initial Sync] Server time:', serverTime, 'Initial time:', initialTime, 'Drift:', drift, 'Playing:', serverRoom.isPlaying);

          // Wait for iframe to fully load before sending commands
          setTimeout(() => {
            // Always seek to admin's current position
            if (serverTime > 2) {
              console.log('[Initial Sync] Seeking to:', serverTime);
              sendPlayerCommand(`seek${Math.floor(serverTime)}`);
            }

            // Apply play/pause state after seeking
            // If admin is paused, send pause multiple times to override autoplay
            setTimeout(() => {
              if (serverRoom.isPlaying) {
                console.log('[Initial Sync] Admin is playing - starting playback');
                triggerAutoPlay();
              } else {
                console.log('[Initial Sync] Admin is paused - pausing playback');
                // Send pause command multiple times to override autoplay
                sendPlayerCommand('pause');
                setTimeout(() => sendPlayerCommand('pause'), 200);
                setTimeout(() => sendPlayerCommand('pause'), 500);
                setTimeout(() => sendPlayerCommand('pause'), 1000);
                setTimeout(() => sendPlayerCommand('pause'), 1500);
              }

              // Always ensure video is unmuted (for both playing and paused states)
              setTimeout(() => {
                console.log('[Initial Sync] Setting unmuted');
                sendPlayerCommand('unmute');
                setTimeout(() => sendPlayerCommand('unmute'), 300);
                setTimeout(() => sendPlayerCommand('unmute'), 600);
              }, 1000); // Send unmute commands after play/pause has settled
            }, 800); // Wait 800ms after seek to apply play/pause
          }, 3000); // Wait 3 seconds for iframe to fully load and autoplay to kick in

          lastServerAdminTimeRef.current = serverTime;
          lastServerPlayingRef.current = serverRoom.isPlaying;
        }
      } catch (err) {
        console.error('[Initial Sync] Failed:', err);
      }
    }, 1000); // Wait 1 second after component mounts

    return () => clearTimeout(timer);
  }, [myParticipant?.status, isAdmin, iframeSrc, roomCode]);

  // Removed unused recommendations fetch - browse view uses browseMovies instead

  // Fetch movie/show details when media changes
  useEffect(() => {
    const movieId = extractMovieId(room);
    const mediaType = room?.mediaType || 'movie';

    if (movieId && room?.currentMovieUrl) {
      // Fetch media details
      fetchMovies.fetchMovieDetails(movieId, mediaType)
        .then(res => {
          setCurrentMediaDetails(res.data);

          // If it's a TV show, fetch seasons
          if (mediaType === 'tv' && res.data.seasons) {
            setTvSeasons(res.data.seasons.filter(s => s.season_number > 0));

            // Determine current season from URL
            const { season } = extractTvInfo(room.currentMovieUrl);
            setSelectedSeason(season || 1);
          }
        })
        .catch(() => {
          setCurrentMediaDetails(null);
        });
    }
  }, [room?.movieId, room?.mediaType, room?.currentMovieUrl]);

  // Fetch episodes when season changes
  useEffect(() => {
    const movieId = extractMovieId(room);
    const mediaType = room?.mediaType || 'movie';

    if (movieId && mediaType === 'tv' && selectedSeason) {
      setLoadingEpisodes(true);
      fetchMovies.fetchSeasonEpisodes(movieId, selectedSeason)
        .then(res => {
          setSeasonEpisodes(res.data.episodes || []);
        })
        .catch(() => {
          setSeasonEpisodes([]);
        })
        .finally(() => {
          setLoadingEpisodes(false);
        });
    }
  }, [room?.movieId, room?.mediaType, selectedSeason]);

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

  // Handle episode selection for TV shows
  const selectEpisode = async (episode) => {
    if (!isAdmin || !currentMediaDetails) return;

    const movieId = String(currentMediaDetails.id);
    const url = buildMelopeeUrl(movieId, 'tv', 0, selectedSeason, episode.episode_number);

    try {
      // Update backend state
      const response = await api.post(`/rooms/${roomCode}/playback`, {
        currentMovieUrl: url,
        movieId,
        mediaType: 'tv',
        isPlaying: true,
        currentTime: 0,
        playbackSpeed: 1.0
      });

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
        mediaType: 'tv',
        currentMovieUrl: url,
        isPlaying: true,
        currentTime: 0,
        playbackSpeed: 1.0
      });

      setIframeSrc(url);
      showToast(`Now playing: S${selectedSeason} E${episode.episode_number} - ${episode.name}`);
    } catch (e) {
      alert('Failed to load episode');
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

  const handleCloseRoom = async () => {
    setShowCloseRoomModal(false);

    try {
      await api.delete(`/rooms/${roomCode}`);
      showToast('Room closed successfully');
      setTimeout(() => {
        navigate('/watch-together');
      }, 1000);
    } catch (err) {
      console.error('Failed to close room:', err);
      showToast('Failed to close room');
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
        <button
          onClick={() => isAdmin && setShowParticipantsModal(true)}
          className={`text-[10px] text-gray-400 flex items-center gap-1 ${isAdmin ? 'hover:text-brand-emerald cursor-pointer transition-colors' : 'cursor-default'}`}
        >
          <Users size={12} />
          <span>{participants.filter(p => p.status === 'APPROVED').length} participants</span>
        </button>
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
      {/* Close Room Confirmation Modal */}
      {showCloseRoomModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-brand-surface border border-brand-hover rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={24} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Close Room?</h3>
                <p className="text-xs text-gray-400">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-sm text-gray-300 mb-6">
              Are you sure you want to close "<strong className="text-white">{room?.title}</strong>"?
              This will end the session for all participants and delete all messages.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCloseRoomModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-brand-background border border-brand-hover text-white hover:bg-brand-hover transition-colors font-bold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseRoom}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-colors font-bold text-sm"
              >
                Close Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-brand-emerald text-black font-bold text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <Check size={16} /> {toastMessage}
        </div>
      )}

      {/* Top Bar */}
      <header className="bg-brand-surface border-b border-brand-hover px-3 md:px-4 py-2 md:py-3 flex items-center justify-between z-20 flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <button onClick={() => navigate('/watch-together')} className="p-1.5 md:p-2 rounded-xl bg-brand-background hover:bg-brand-hover text-gray-300 transition-colors cursor-pointer flex-shrink-0"><ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" /></button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xs md:text-sm font-bold truncate">{room.title}</h1>
            <p className="text-[10px] md:text-[11px] text-gray-400 flex items-center gap-1 md:gap-2 flex-wrap">
              <span className="truncate">Code: <strong className="text-brand-emerald font-mono">{room.roomCode}</strong></span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline truncate">Owner: {room.ownerName}</span>
              {remainingTime && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span className="text-yellow-400 font-mono font-bold flex items-center gap-1">
                    <Clock size={12} />
                    {remainingTime}
                  </span>
                </>
              )}
              {isAdmin && <span className="px-1 md:px-1.5 py-0.5 bg-brand-emerald/20 text-brand-emerald rounded text-[9px] md:text-[10px] font-bold flex-shrink-0">Admin</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
          {room.currentMovieUrl && isAdmin && (
            <button
              onClick={() => setShowBrowseView(true)}
              className="px-2 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl bg-brand-background hover:bg-brand-hover border border-brand-hover text-gray-300 hover:text-white font-bold text-xs md:text-sm transition-colors cursor-pointer flex items-center gap-1 md:gap-2 shadow-lg"
            >
              <Film size={14} className="md:w-4 md:h-4" />
              <span className="inline lg:hidden">Change</span>
              <span className="hidden lg:inline">Change Movie</span>
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => setShowCloseRoomModal(true)}
              className="px-2 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs md:text-sm transition-colors cursor-pointer flex items-center gap-1 md:gap-2 shadow-lg"
              title="Close room permanently"
            >
              <Trash2 size={14} className="md:w-4 md:h-4" />
              <span className="hidden sm:inline">Close</span>
            </button>
          )}
          <button
            onClick={handleNativeShare}
            className="px-2 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl bg-brand-emerald hover:bg-emerald-400 text-black font-bold text-xs md:text-sm transition-colors cursor-pointer flex items-center gap-1 md:gap-2 shadow-lg"
          >
            <Share2 size={14} className="md:w-4 md:h-4" />
            <span className="hidden sm:inline">{copiedLink ? "Copied!" : "Share"}</span>
          </button>
        </div>
      </header>

      {/* Admin Pending Requests Banner */}
      {isAdmin && pendingRequests.length > 0 && (
        <div className="bg-yellow-950/90 border-b border-yellow-900/60 px-4 py-2 md:py-3 z-30 shadow-xl flex-shrink-0">
          <div className="flex flex-col gap-2">
            {pendingRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between gap-3 bg-brand-background px-3 md:px-4 py-2 md:py-2.5 rounded-xl border border-yellow-800/40 shadow-md">
                <span className="text-xs md:text-sm font-bold text-white flex-1 truncate">{req.name} wants to join</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleApproveRequest(req.id, false)}
                    className="px-3 md:px-4 py-1.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-500 text-xs transition-colors cursor-pointer"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => handleApproveRequest(req.id, true)}
                    className="px-3 md:px-4 py-1.5 bg-brand-emerald text-black font-bold rounded-lg hover:bg-emerald-400 text-xs transition-colors cursor-pointer"
                  >
                    Approve
                  </button>
                </div>
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

            {/* Movie/Show Details Section */}
            <div className="p-4 md:p-6 bg-brand-surface border-t border-brand-hover flex-shrink-0 space-y-3 md:space-y-4">
              {currentMediaDetails && (
                <>
                  {/* Title and Metadata */}
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                      {currentMediaDetails.title || currentMediaDetails.name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-400 mb-2 md:mb-3">
                      {currentMediaDetails.vote_average && (
                        <span className="flex items-center gap-1">
                          ⭐ {currentMediaDetails.vote_average.toFixed(1)}/10
                        </span>
                      )}
                      {(currentMediaDetails.release_date || currentMediaDetails.first_air_date) && (
                        <span>📅 {(currentMediaDetails.release_date || currentMediaDetails.first_air_date).split('-')[0]}</span>
                      )}
                      {currentMediaDetails.runtime && (
                        <span>⏱️ {Math.floor(currentMediaDetails.runtime / 60)}h {currentMediaDetails.runtime % 60}m</span>
                      )}
                      {currentMediaDetails.number_of_seasons && (
                        <span>📺 {currentMediaDetails.number_of_seasons} Seasons</span>
                      )}
                    </div>

                    {/* Description */}
                    {currentMediaDetails.overview && (
                      <div className="text-xs md:text-sm text-gray-300">
                        <p className={`${showFullDescription ? '' : 'line-clamp-2'} cursor-pointer`} onClick={() => setShowFullDescription(!showFullDescription)}>
                          {currentMediaDetails.overview}
                        </p>
                        {!showFullDescription && currentMediaDetails.overview.length > 150 && (
                          <button
                            onClick={() => setShowFullDescription(true)}
                            className="text-brand-emerald text-xs mt-1 hover:underline"
                          >
                            Show more
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* TV Series: Season & Episode Selection */}
                  {room?.mediaType === 'tv' && tvSeasons.length > 0 && (
                    <div className="space-y-3">
                      {/* Season Selector */}
                      {isAdmin && (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                          <label className="text-xs md:text-sm font-semibold text-gray-400">Season:</label>
                          <div className="flex gap-2 flex-wrap">
                            {tvSeasons.map((season) => (
                              <button
                                key={season.season_number}
                                onClick={() => setSelectedSeason(season.season_number)}
                                className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                  selectedSeason === season.season_number
                                    ? 'bg-brand-emerald text-black'
                                    : 'bg-brand-background text-gray-300 hover:bg-brand-hover'
                                }`}
                              >
                                Season {season.season_number}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Episodes Grid */}
                      {isAdmin && (
                        <div>
                          <h3 className="text-xs md:text-sm font-semibold text-gray-400 mb-2">Episodes:</h3>
                          {loadingEpisodes ? (
                            <div className="text-center py-4 text-gray-500 text-xs md:text-sm">Loading episodes...</div>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3 max-h-48 md:max-h-60 overflow-y-auto custom-scrollbar">
                              {seasonEpisodes.map((episode) => {
                                const { episode: currentEp } = extractTvInfo(room?.currentMovieUrl || '');
                                const isCurrentEpisode = currentEp === episode.episode_number;

                                return (
                                  <button
                                    key={episode.id}
                                    onClick={() => selectEpisode(episode)}
                                    className={`p-2 md:p-3 rounded-lg text-left transition-all ${
                                      isCurrentEpisode
                                        ? 'bg-brand-emerald text-black ring-2 ring-brand-emerald'
                                        : 'bg-brand-background hover:bg-brand-hover text-white'
                                    }`}
                                  >
                                    <div className="text-xs font-bold mb-1">
                                      Episode {episode.episode_number}
                                    </div>
                                    <div className={`text-xs truncate ${isCurrentEpisode ? 'text-black' : 'text-gray-400'}`}>
                                      {episode.name}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Non-admin: Show current episode info only */}
                      {!isAdmin && (
                        <div className="p-3 bg-brand-background rounded-lg border border-brand-hover">
                          <p className="text-xs text-gray-400">
                            Currently watching: <strong className="text-white">Season {selectedSeason}</strong>
                            {room?.currentMovieUrl && (() => {
                              const { episode: currentEp } = extractTvInfo(room.currentMovieUrl);
                              const currentEpisode = seasonEpisodes.find(ep => ep.episode_number === currentEp);
                              return currentEpisode ? (
                                <> • <strong className="text-white">Episode {currentEp}: {currentEpisode.name}</strong></>
                              ) : null;
                            })()}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Sync Status Info (moved from top) */}
              <div className="pt-3 border-t border-brand-hover flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                  <p className="text-xs font-bold text-white flex flex-wrap items-center gap-2">
                    <span>Synchronized Playback Active</span>
                    {isAdmin ? (
                      <span className="px-2 py-0.5 bg-brand-emerald/20 text-brand-emerald rounded text-[10px] font-bold">You are Admin (Controls Synced)</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] font-bold">Spectating Room Admin</span>
                    )}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">Admin play, pause, and seek actions are synchronized across all members in real-time.</p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => setShowBrowseView(true)}
                    className="px-3 md:px-4 py-2 bg-brand-emerald text-black font-bold text-xs md:text-sm rounded-xl hover:bg-emerald-400 transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-lg w-full sm:w-auto"
                  >
                    <Film size={16} />
                    Change Movie
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Chat Panel - Desktop only (lg+) */}
          <div className="hidden lg:flex lg:col-span-1 h-full min-h-0 flex-col">
            {renderChatSection()}
          </div>
        </div>
      )}

      {/* Floating Chat Button - Mobile & Tablet (below lg) */}
      {room?.currentMovieUrl && (
        <button
          onClick={() => {
            setChatDrawerOpen(true);
            setUnreadCount(0);
            prevMessagesLengthRef.current = messages.length;
          }}
          className="lg:hidden fixed bottom-6 right-5 z-40 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center cursor-pointer hover:bg-indigo-500 transition-colors"
          title="Open Chat"
        >
          <MessageSquare size={24} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat Drawer Overlay - Mobile & Tablet (below lg) */}
      {chatDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-row">
          {/* Backdrop - 20% on small screens, 50% on medium screens */}
          <div
            className="bg-black/40 backdrop-blur-[2px] w-[20%] md:w-1/2"
            onClick={() => {
              setChatDrawerOpen(false);
              setUnreadCount(0);
              prevMessagesLengthRef.current = messages.length;
            }}
          />
          {/* Chat panel - 80% on small screens, 50% on medium screens */}
          <div className="w-[80%] md:w-1/2 flex flex-col min-h-0 shadow-2xl">
            {renderChatSection()}
          </div>
        </div>
      )}

      {/* Participants Management Modal */}
      {showParticipantsModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-brand-surface border border-brand-hover rounded-2xl w-full max-w-md shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-brand-hover flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users size={18} className="text-brand-emerald" />
                Manage Participants ({participants.filter(p => p.status === 'APPROVED').length})
              </h3>
              <button
                onClick={() => setShowParticipantsModal(false)}
                className="p-1.5 rounded-lg hover:bg-brand-hover text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Participants List */}
            <div className="p-4 max-h-96 overflow-y-auto custom-scrollbar space-y-2">
              {participants.filter(p => p.status === 'APPROVED').length === 0 ? (
                <p className="text-center text-xs text-gray-500 py-8">No participants in the room yet.</p>
              ) : (
                participants
                  .filter(p => p.status === 'APPROVED')
                  .map(participant => (
                    <div
                      key={participant.id}
                      className="bg-brand-background border border-brand-hover rounded-xl p-3 flex items-center justify-between hover:border-brand-emerald/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-brand-emerald/20 text-brand-emerald flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {participant.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white truncate">{participant.name}</p>
                          <p className="text-[10px] text-gray-400">
                            {participant.isAdmin ? 'Admin' : 'Member'}
                            {participant.userId === room.ownerId && ' • Owner'}
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons (only show if not owner) */}
                      {participant.userId !== room.ownerId && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => handleToggleAdmin(participant.id, participant.isAdmin)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                              participant.isAdmin
                                ? 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 border border-yellow-600/40'
                                : 'bg-brand-emerald/20 text-brand-emerald hover:bg-brand-emerald/30 border border-brand-emerald/40'
                            }`}
                            title={participant.isAdmin ? 'Revoke admin' : 'Make admin'}
                          >
                            {participant.isAdmin ? 'Revoke' : 'Make Admin'}
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Remove ${participant.name} from the room?`)) {
                                handleRemoveMember(participant.id);
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/40 text-[10px] font-bold transition-colors cursor-pointer"
                            title="Remove from room"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-brand-hover">
              <button
                onClick={() => setShowParticipantsModal(false)}
                className="w-full py-2.5 rounded-xl bg-brand-hover hover:bg-brand-background text-white font-medium text-sm transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
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
