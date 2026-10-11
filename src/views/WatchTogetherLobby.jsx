import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Users, PlusCircle, LogIn, Sparkles, Shield, ArrowLeft } from 'lucide-react';
import api from '../utils/api';

const WatchTogetherLobby = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState(null); // null, 'create', or 'join'
  const [roomTitle, setRoomTitle] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [guestName, setGuestName] = useState(user?.username || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('You must be signed in to create a Watch Together room.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/rooms', {
        title: roomTitle.trim() || `${user?.username || 'User'}'s Room`,
        movieId: null,
        mediaType: null
      });
      navigate(`/watch-together/${res.data.roomCode}`);
    } catch (err) {
      setError(err.response?.data || 'Failed to create room.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    setError('');

    const code = roomCodeInput.trim().toUpperCase();
    if (!code) {
      setError('Please enter a valid room code or invitation link.');
      return;
    }

    let cleanCode = code;
    if (code.includes('/watch-together/')) {
      const parts = code.split('/watch-together/');
      cleanCode = parts[parts.length - 1].split('/')[0];
    }

    if (!guestName.trim()) {
      setError('Please enter your name to join the room.');
      return;
    }

    setLoading(true);
    try {
      await api.get(`/rooms/${cleanCode}`);
      await api.post(`/rooms/${cleanCode}/join`, { name: guestName.trim() });
      navigate(`/watch-together/${cleanCode}?name=${encodeURIComponent(guestName.trim())}`);
    } catch (err) {
      setError(err.response?.data || 'Room not found or failed to join.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-4 text-white">
      <div className="max-w-md w-full bg-brand-surface border border-brand-hover rounded-2xl p-8 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-center gap-3 mb-4 text-brand-emerald">
          <Users size={36} />
          <span className="text-2xl font-bold text-white">Watch Together</span>
        </div>

        <p className="text-xs text-gray-400 text-center mb-8">
          Watch movies and shows with friends in real time with synchronized playback and live chat.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-900/50 text-red-400 text-xs">
            {error}
          </div>
        )}

        {!mode ? (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => { setMode('create'); setError(''); }}
              className="w-full p-4 rounded-xl font-bold bg-brand-emerald text-black hover:bg-emerald-400 transition-colors flex items-center justify-between text-sm shadow-lg shadow-brand-emerald/20 cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <PlusCircle size={22} />
                <div className="text-left">
                  <p className="font-bold text-sm">Create a Room</p>
                  <p className="text-[11px] opacity-80 font-normal">Start a new watch party as admin</p>
                </div>
              </div>
              <span className="text-lg font-bold group-hover:translate-x-1 transition-transform">→</span>
            </button>

            <button
              onClick={() => { setMode('join'); setError(''); }}
              className="w-full p-4 rounded-xl font-bold bg-brand-background border border-brand-hover text-white hover:bg-brand-hover transition-colors flex items-center justify-between text-sm cursor-pointer group"
            >
              <div className="flex items-center gap-3 text-brand-emerald">
                <LogIn size={22} />
                <div className="text-left text-white">
                  <p className="font-bold text-sm">Join a Room</p>
                  <p className="text-[11px] text-gray-400 font-normal">Enter with a room code or link</p>
                </div>
              </div>
              <span className="text-lg font-bold text-gray-400 group-hover:translate-x-1 transition-transform">→</span>
            </button>
          </div>
        ) : mode === 'create' ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => { setMode(null); setError(''); }}
                className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <span className="text-xs font-bold text-brand-emerald uppercase tracking-wider">Create Room</span>
            </div>

            <form onSubmit={handleCreateRoom} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Room Name</label>
                <input
                  type="text"
                  value={roomTitle}
                  onChange={e => setRoomTitle(e.target.value)}
                  placeholder={user ? `${user.username}'s Movie Night` : "Movie Night"}
                  className="w-full p-3 bg-brand-background border border-brand-hover rounded-xl focus:outline-none focus:border-brand-emerald text-sm text-white"
                />
              </div>

              {!token && (
                <div className="p-3 bg-yellow-950/40 border border-yellow-900/50 rounded-xl text-yellow-400 text-xs">
                  Note: You must be signed in to create a room. <button type="button" onClick={() => navigate('/login')} className="underline font-bold cursor-pointer">Sign In</button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !token}
                className="w-full py-3 rounded-xl font-bold bg-brand-emerald text-black hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 text-sm shadow-lg shadow-brand-emerald/20 cursor-pointer disabled:opacity-50 mt-2"
              >
                <Sparkles size={18} />
                {loading ? "Creating Room..." : "Create Room"}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => { setMode(null); setError(''); }}
                className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <span className="text-xs font-bold text-brand-emerald uppercase tracking-wider">Join Room</span>
            </div>

            <form onSubmit={handleJoinRoom} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Your Display Name</label>
                <input
                  type="text"
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  placeholder="e.g. Alex"
                  className="w-full p-3 bg-brand-background border border-brand-hover rounded-xl focus:outline-none focus:border-brand-emerald text-sm text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Room Code or Invitation Link</label>
                <input
                  type="text"
                  value={roomCodeInput}
                  onChange={e => setRoomCodeInput(e.target.value)}
                  placeholder="e.g. A4F8B2 or paste link"
                  className="w-full p-3 bg-brand-background border border-brand-hover rounded-xl focus:outline-none focus:border-brand-emerald text-sm text-white uppercase tracking-wider"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-bold bg-brand-emerald text-black hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 text-sm shadow-lg shadow-brand-emerald/20 cursor-pointer disabled:opacity-50 mt-2"
              >
                <LogIn size={18} />
                {loading ? "Joining Room..." : "Join Room Request"}
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="mt-8 max-w-md text-center text-xs text-gray-400 space-y-2">
        <p className="flex items-center justify-center gap-1.5 font-semibold text-gray-300">
          <Shield size={14} className="text-brand-emerald" /> Room owner controls playback & approves join requests.
        </p>
        <p>All rooms and features are completely free with no creation limits.</p>
      </div>
    </div>
  );
};

export default WatchTogetherLobby;
