import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Film, Send, Users, Shield, Play, Pause, Search, ArrowLeft, Check, X, AlertCircle, Share2, Plus, Server, Star, RotateCcw, RotateCw } from 'lucide-react';
import api from '../utils/api';
import { fetchMovies, getImageUrl } from '../utils/tmdb';

const WatchTogetherRoom = () => {
  const { roomCode } = useParams();
  const [searchParams] = useSearchParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [myParticipant, setMyParticipant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pre-join state if guest hasn't requested yet
  const [guestNameInput, setGuestNameInput] = useState(user?.username || '');
  const [hasRequested, setHasRequested] = useState(false);

  // Movie search & recommendations inside room
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedServer, setSelectedServer] = useState(1);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [showBrowseView, setShowBrowseView] = useState(false);

  // Admin playback state tracking
  const [adminCurrentTime, setAdminCurrentTime] = useState(0);
  const [adminIsPlaying, setAdminIsPlaying] = useState(true);

  const chatBoxRef = useRef(null);

  const isOwner = user && room && room.ownerId === user.id;

  // Helper to add time parameter to embed URL for sync
  const getEmbedUrlWithTime = (url, time) => {
    if (!url) return '';
    const base = url.replace(/([?&])t=\d+/, '');
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}t=${Math.floor(time)}`;
  };

  // Initial load room info & recommendations
  useEffect(() => {
    let isMounted = true;
    const initRoom = async () => {
      try {
        const res = await api.get(`/rooms/${roomCode}`);
        if (!isMounted) return;
        setRoom(res.data);
        setParticipants(res.data.participants || []);
        setAdminCurrentTime(res.data.currentTime || 0);
        setAdminIsPlaying(res.data.isPlaying);

        // Fetch recommended/trending movies for the room browsing section
        try {
          const recRes = await fetchMovies.fetchTrending(1);
          if (isMounted) setRecommendations((recRes.data.results || []).filter(m => m.poster_path).slice(0, 16));
        } catch (e) {}

        // If user is owner, auto set participant
        if (user && res.data.ownerId === user.id) {
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
              if (isMounted) {
                setMyParticipant(joinRes.data);
                setHasRequested(true);
              }
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

  // Live search for owner in room
  useEffect(() => {
    if (!isOwner || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      fetchMovies.searchMulti(searchQuery)
        .then(res => {
          setSearchResults((res.data.results || []).filter(m => m.poster_path).slice(0, 12));
        })
        .catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, isOwner]);

  // Polling interval for room sync (playback, chat, participants, requests)
  useEffect(() => {
    if (!myParticipant || myParticipant.status !== 'APPROVED') return;

    const interval = setInterval(async () => {
      try {
        const syncRes = await api.get(`/rooms/${roomCode}/sync`);
        const serverRoom = syncRes.data.room;
        setParticipants(syncRes.data.participants || []);
        setMessages(syncRes.data.messages || []);

        if (serverRoom) {
          if (!isOwner) {
            // Participant: sync iframe URL with admin's time & movie URL
            const syncedUrl = getEmbedUrlWithTime(serverRoom.currentMovieUrl, serverRoom.currentTime);
            setRoom(prev => ({
              ...prev,
              currentMovieUrl: syncedUrl,
              isPlaying: serverRoom.isPlaying,
              currentTime: serverRoom.currentTime
            }));
          } else {
            setRoom(serverRoom);
          }
        }

        if (user && serverRoom.ownerId === user.id) {
          const reqRes = await api.get(`/rooms/${roomCode}/requests`);
          setPendingRequests(reqRes.data || []);
        }
      } catch (err) {}
    }, 1500);

    return () => clearInterval(interval);
  }, [roomCode, myParticipant, user, isOwner]);

  // Scroll only chat box container (never window/page)
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
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
    } catch (err) {
      alert(err.response?.data || 'Failed to send join request');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const text = inputMessage.trim();
    setInputMessage('');
    try {
      await api.post(`/rooms/${roomCode}/chat`, {
        senderName: myParticipant?.name || 'Guest',
        message: text
      });
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
    } catch (err) {
      alert('Failed to process request');
    }
  };

  const updateServerPlayback = async (isPlaying, currentTime, movieUrl) => {
    if (!isOwner) return;
    try {
      const finalUrl = getEmbedUrlWithTime(movieUrl || room?.currentMovieUrl, currentTime);
      await api.post(`/rooms/${roomCode}/playback`, {
        currentMovieUrl: finalUrl,
        isPlaying,
        currentTime,
        playbackSpeed: 1.0
      });
      setAdminCurrentTime(currentTime);
      setAdminIsPlaying(isPlaying);
      setRoom(prev => ({ ...prev, currentMovieUrl: finalUrl, isPlaying, currentTime }));
    } catch (err) {}
  };

  // Select movie right inside the room without navigating away
  const handleSelectMovie = async (item) => {
    const mType = item.media_type || (item.name && !item.title ? 'tv' : 'movie');
    const embedUrl = mType === 'tv'
      ? `https://player.melopee.app/embed/tv?tmdb=${item.id}&season=${selectedSeason}&episode=${selectedEpisode}&quality=auto`
      : `https://player.melopee.app/embed/movie?tmdb=${item.id}&quality=auto`;

    try {
      await updateServerPlayback(true, 0, embedUrl);
      setShowBrowseView(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (e) {
      alert('Failed to start movie in room');
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
          <button
            onClick={() => navigate('/watch-together')}
            className="px-6 py-2.5 rounded-xl bg-brand-emerald text-black font-bold text-xs hover:bg-emerald-400 transition-colors cursor-pointer"
          >
            Back to Watch Together Lobby
          </button>
        </div>
      </div>
    );
  }

  // Pre-join: Ask for name if not requested yet
  if (!hasRequested && !isOwner) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-white bg-brand-background">
        <div className="bg-brand-surface border border-brand-hover rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <div className="flex items-center justify-center gap-2 mb-4 text-brand-emerald">
            <Users size={32} />
            <span className="text-xl font-bold text-white">Join Room</span>
          </div>

          <h2 className="text-base font-bold text-center text-gray-200 mb-1">{room.title}</h2>
          <p className="text-xs text-gray-400 text-center mb-6">Hosted by <strong className="text-white">{room.ownerName}</strong></p>

          <form onSubmit={handleRequestJoin} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Your Display Name</label>
              <input
                type="text"
                value={guestNameInput}
                onChange={e => setGuestNameInput(e.target.value)}
                placeholder="Enter your name..."
                className="w-full p-3 bg-brand-background border border-brand-hover rounded-xl focus:outline-none focus:border-brand-emerald text-sm text-white"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl font-bold bg-brand-emerald text-black hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 text-sm shadow-lg shadow-brand-emerald/20 cursor-pointer"
            >
              Request to Join Room
            </button>
          </form>

          <button
            onClick={() => navigate('/watch-together')}
            className="mt-6 text-xs text-gray-400 hover:text-white w-full text-center transition-colors cursor-pointer"
          >
            Return to Lobby
          </button>
        </div>
      </div>
    );
  }

  // Pending approval screen
  if (myParticipant?.status === 'PENDING') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-white bg-brand-background">
        <div className="bg-brand-surface border border-brand-hover rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Users size={24} />
          </div>
          <h2 className="text-xl font-bold mb-2">Waiting for Room Owner Approval</h2>
          <p className="text-xs text-gray-400 mb-6">
            Your request to join <span className="text-white font-bold">{room.title}</span> has been sent. The room owner will let you in shortly.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-xl bg-brand-background border border-brand-hover text-white font-bold text-xs hover:bg-brand-hover transition-colors mb-2 cursor-pointer"
          >
            Check Approval Status
          </button>
          <button
            onClick={() => navigate('/watch-together')}
            className="text-xs text-gray-500 hover:text-white transition-colors cursor-pointer"
          >
            Cancel and Return to Lobby
          </button>
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
          <p className="text-xs text-gray-400 mb-6">The room owner declined your request to join this room.</p>
          <button
            onClick={() => navigate('/watch-together')}
            className="px-6 py-2.5 rounded-xl bg-brand-emerald text-black font-bold text-xs hover:bg-emerald-400 transition-colors cursor-pointer"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-background text-white flex flex-col">
      {/* Top Bar */}
      <header className="bg-brand-surface border-b border-brand-hover px-4 py-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/watch-together')}
            className="p-2 rounded-xl bg-brand-background hover:bg-brand-hover text-gray-300 transition-colors cursor-pointer"
            title="Back to Lobby"
          >
            <ArrowLeft size={18} />
          </button>
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
          {room.currentMovieUrl && isOwner && (
            <button
              onClick={() => setShowBrowseView(!showBrowseView)}
              className="px-3 py-1.5 rounded-xl bg-brand-emerald text-black hover:bg-emerald-400 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Search size={14} /> {showBrowseView ? 'Back to Player' : 'Change Movie / Search'}
            </button>
          )}
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.origin + '/watch-together/' + room.roomCode);
              alert('Room invitation link copied to clipboard!');
            }}
            className="px-3 py-1.5 rounded-xl bg-brand-background hover:bg-brand-hover border border-brand-hover text-xs font-semibold flex items-center gap-1.5 text-gray-300 transition-colors cursor-pointer"
          >
            <Share2 size={14} className="text-brand-emerald" /> Share Link
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 overflow-hidden">
        {/* Left Section: Watching Player or Owner Browsing View */}
        <div className="lg:col-span-3 flex flex-col bg-brand-background overflow-y-auto">
          {room.currentMovieUrl && !showBrowseView ? (
            /* Watching Player Experience */
            <div className="flex flex-col flex-1 bg-black">
              <div className="relative w-full aspect-video bg-gray-950 flex items-center justify-center shadow-2xl">
                <iframe
                  key={room.currentMovieUrl}
                  src={room.currentMovieUrl}
                  title="Watch Party Player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
                {/* Transparent blocking overlay for non-owners to prevent seeking/controlling */}
                {!isOwner && (
                  <div
                    className="absolute inset-0 z-10 bg-transparent cursor-not-allowed"
                    title="Only the room admin can control playback and seeking"
                    onClick={(e) => {
                      e.stopPropagation();
                      alert('Only the room admin can control playback, pause, seek, or change movie position.');
                    }}
                  />
                )}
              </div>

              {/* Player Controls & Server Selector & Time Sync (Owner Only) */}
              <div className="p-4 bg-brand-surface border-t border-brand-hover flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-emerald animate-ping"></span>
                  <span className="text-xs text-gray-300">
                    Playback is <strong>{isOwner ? "Controlled by You (Admin)" : "Synchronized with Room Admin"}</strong>
                  </span>
                </div>

                {isOwner && (
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Time control buttons for admin */}
                    <div className="flex items-center gap-1 bg-brand-background border border-brand-hover rounded-xl p-1">
                      <button
                        onClick={() => {
                          const newTime = Math.max(0, adminCurrentTime - 10);
                          updateServerPlayback(adminIsPlaying, newTime);
                        }}
                        className="px-2.5 py-1 text-xs hover:bg-brand-hover rounded-lg flex items-center gap-1 text-gray-300 transition-colors cursor-pointer"
                        title="Rewind 10s"
                      >
                        <RotateCcw size={12} /> -10s
                      </button>
                      <button
                        onClick={() => {
                          updateServerPlayback(!adminIsPlaying, adminCurrentTime);
                        }}
                        className="px-3 py-1 text-xs bg-brand-emerald text-black font-bold rounded-lg flex items-center gap-1 hover:bg-emerald-400 transition-colors cursor-pointer"
                      >
                        {adminIsPlaying ? <Pause size={12} /> : <Play size={12} />} {adminIsPlaying ? 'Pause' : 'Play'}
                      </button>
                      <button
                        onClick={() => {
                          const newTime = adminCurrentTime + 10;
                          updateServerPlayback(adminIsPlaying, newTime);
                        }}
                        className="px-2.5 py-1 text-xs hover:bg-brand-hover rounded-lg flex items-center gap-1 text-gray-300 transition-colors cursor-pointer"
                        title="Forward 10s"
                      >
                        +10s <RotateCw size={12} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Server size={14} className="text-brand-emerald" /> Server:
                      </span>
                      <select
                        value={selectedServer}
                        onChange={e => setSelectedServer(Number(e.target.value))}
                        className="bg-brand-background border border-brand-hover text-white text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-brand-emerald"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                          <option key={s} value={s}>Server {s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Room's Movie Browsing & Recommendation Section (Owner Only or initial state) */
            <div className="p-6 flex flex-col gap-6">
              {isOwner ? (
                <>
                  <div className="relative max-w-2xl mx-auto w-full">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search movies, TV shows, anime to watch together..."
                      className="w-full pl-11 pr-4 py-3 bg-brand-surface border border-brand-hover rounded-2xl text-sm text-white placeholder-gray-400 focus:outline-none focus:border-brand-emerald shadow-lg"
                    />

                    {/* Live Search Results Dropdown */}
                    {searchResults.length > 0 && (
                      <div className="absolute left-0 right-0 mt-2 bg-brand-surface border border-brand-hover rounded-2xl shadow-2xl z-30 max-h-96 overflow-y-auto p-2">
                        {searchResults.map(item => (
                          <div
                            key={item.id}
                            onClick={() => handleSelectMovie(item)}
                            className="flex items-center gap-3 p-2.5 hover:bg-brand-hover/70 rounded-xl cursor-pointer transition-colors"
                          >
                            <img
                              src={getImageUrl(item.poster_path, 'w92')}
                              alt={item.title || item.name}
                              className="w-12 h-16 object-cover rounded-lg flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white truncate">{item.title || item.name}</p>
                              <p className="text-xs text-gray-400 flex items-center gap-2 mt-1">
                                <span className="uppercase px-1.5 py-0.5 bg-brand-background rounded text-[10px] font-semibold text-brand-emerald">
                                  {item.media_type || 'movie'}
                                </span>
                                {(item.release_date || item.first_air_date) && (
                                  <span>{new Date(item.release_date || item.first_air_date).getFullYear()}</span>
                                )}
                                {item.vote_average > 0 && (
                                  <span className="flex items-center gap-0.5 text-yellow-400 font-semibold">
                                    <Star size={12} fill="currentColor" /> {parseFloat(item.vote_average).toFixed(1)}
                                  </span>
                                )}
                              </p>
                            </div>
                            <span className="text-xs font-bold text-black bg-brand-emerald px-4 py-2 rounded-xl hover:bg-emerald-400 transition-colors">
                              Play Now
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recommended / Trending Movies Grid */}
                  <div>
                    <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                      <span className="w-1 h-5 bg-brand-emerald rounded-full"></span>
                      Recommended Movies & Shows
                    </h2>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {recommendations.map(item => (
                        <div
                          key={item.id}
                          onClick={() => handleSelectMovie(item)}
                          className="bg-brand-surface border border-brand-hover rounded-xl p-2.5 hover:border-brand-emerald cursor-pointer transition-all hover:scale-105 flex flex-col group shadow-lg"
                        >
                          <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-2">
                            <img
                              src={getImageUrl(item.poster_path, 'w342')}
                              alt={item.title || item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {item.vote_average > 0 && (
                              <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded-md text-[10px] font-bold text-yellow-400 flex items-center gap-0.5">
                                <Star size={10} fill="currentColor" /> {parseFloat(item.vote_average).toFixed(1)}
                              </div>
                            )}
                          </div>
                          <p className="text-xs font-bold text-white truncate">{item.title || item.name}</p>
                          <p className="text-[11px] text-gray-400 capitalize mt-0.5">
                            {item.media_type || 'movie'} • {(item.release_date || item.first_air_date || '').substring(0, 4)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-16 bg-brand-surface border border-brand-hover rounded-2xl max-w-lg mx-auto w-full p-8 shadow-xl">
                  <Film size={48} className="mx-auto text-brand-emerald mb-4 animate-pulse" />
                  <h3 className="text-lg font-bold text-white mb-2">Waiting for Room Admin</h3>
                  <p className="text-xs text-gray-400">
                    The room admin (<strong className="text-white">{room.ownerName}</strong>) is currently selecting a movie to watch together. The player will start automatically once chosen.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Owner Pending Requests Panel */}
          {isOwner && pendingRequests.length > 0 && (
            <div className="p-4 bg-brand-surface border-t border-brand-hover mt-auto">
              <h3 className="text-xs font-bold text-brand-emerald uppercase tracking-wider mb-3 flex items-center gap-2">
                <Users size={14} /> Pending Join Requests ({pendingRequests.length})
              </h3>
              <div className="flex flex-col gap-2">
                {pendingRequests.map(req => (
                  <div key={req.id} className="flex items-center justify-between p-2.5 bg-brand-background border border-brand-hover rounded-xl text-xs">
                    <span className="font-semibold text-white">{req.name}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveRequest(req.id, true)}
                        className="px-3 py-1 bg-brand-emerald text-black font-bold rounded-lg hover:bg-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Check size={14} /> Approve
                      </button>
                      <button
                        onClick={() => handleApproveRequest(req.id, false)}
                        className="px-3 py-1 bg-red-950/60 border border-red-900 text-red-400 font-bold rounded-lg hover:bg-red-900/60 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <X size={14} /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chat & Participants Sidebar (1 Col on desktop) */}
        <div className="lg:col-span-1 bg-brand-surface border-l border-brand-hover flex flex-col h-[500px] lg:h-auto overflow-hidden">
          {/* Participants header */}
          <div className="p-3 border-b border-brand-hover bg-brand-background/50 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={14} className="text-brand-emerald" /> Participants ({participants.length})
            </span>
          </div>

          {/* Participants list */}
          <div className="max-h-36 overflow-y-auto p-2 border-b border-brand-hover space-y-1">
            {participants.map(p => (
              <div key={p.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs bg-brand-background">
                <span className="font-medium text-gray-200 truncate">{p.name}</span>
                {p.isAdmin && (
                  <span className="px-1.5 py-0.5 bg-brand-emerald/20 text-brand-emerald rounded text-[10px] font-bold flex items-center gap-0.5">
                    <Shield size={10} /> Owner
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Chat Messages Container with local ref scrolling */}
          <div ref={chatBoxRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 ? (
              <p className="text-center text-xs text-gray-500 my-6">No messages yet. Say hello to the room!</p>
            ) : (
              messages.map((m, idx) => (
                <div key={idx} className="flex flex-col">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-bold text-brand-emerald">{m.senderName}</span>
                    <span className="text-[9px] text-gray-500">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-200 bg-brand-background p-2 rounded-xl mt-1 break-words">{m.message}</p>
                </div>
              ))
            )}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-brand-hover bg-brand-background/50 flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              placeholder="Send a message..."
              className="flex-1 p-2 bg-brand-background border border-brand-hover rounded-xl text-xs text-white focus:outline-none focus:border-brand-emerald"
            />
            <button
              type="submit"
              className="p-2.5 rounded-xl bg-brand-emerald text-black hover:bg-emerald-400 transition-colors cursor-pointer flex items-center justify-center"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default WatchTogetherRoom;
