import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Users, PlusCircle, LogIn, Film, Link as LinkIcon, Sparkles, Copy, Check, Shield } from 'lucide-react';
import api from '../utils/api';

const WatchTogetherLobby = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'join'
  const [roomTitle, setRoomTitle] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [guestName, setGuestName] = useState(user?.username || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdRoom, setCreatedRoom] = useState(null);
  const [copied, setCopied] = useState(false);

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
        movieId: '299534', // Default Avengers Endgame or similar
        mediaType: 'movie'
      });
      setCreatedRoom(res.data);
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

    // Extract room code if full URL was pasted
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
      // First verify room exists
      await api.get(`/rooms/${cleanCode}`);
      // Join room
      await api.post(`/rooms/${cleanCode}/join`, { name: guestName.trim() });
      navigate(`/watch-together/${cleanCode}?name=${encodeURIComponent(guestName.trim())}`);
    } catch (err) {
      setError(err.response?.data || 'Room not found or failed to join.');
    } finally {
      setLoading(false);
    }
  };

  const copyShareableLink = () => {
    if (!createdRoom) return;
    const link = window.location.origin + createdRoom.shareableLink;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-4 text-white">
      <div className="max-w-md w-full bg-brand-surface border border-brand-hover rounded-2xl p-8 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-center gap-3 mb-6 text-brand-emerald">
          <Users size={36} />
          <span className="text-2xl font-bold text-white">Watch Together</span>
        </div>

        <p className="text-xs text-gray-400 text-center mb-6">
          Watch movies and shows with friends in real time with synchronized playback and live chat.
        </p>

        {/* Tabs */}
        <div className="flex rounded-xl bg-brand-background p-1 mb-6 border border-brand-hover">
          <button
            onClick={() => { setActiveTab('create'); setError(''); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'create' ? 'bg-brand-emerald text-black shadow-lg' : 'text-gray-300 hover:text-white'
            }`}
          >
            <PlusCircle size={16} /> Create a Room
          </button>
          <button
            onClick={() => { setActiveTab('join'); setError(''); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'join' ? 'bg-brand-emerald text-black shadow-lg' : 'text-gray-300 hover:text-white'
            }`}
          >
            <LogIn size={16} /> Join a Room
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-900/50 text-red-400 text-xs">
            {error}
          </div>
        )}

        {activeTab === 'create' ? (
          <div>
            {!createdRoom ? (
              <form onSubmit={handleCreateRoom} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Room Title</label>
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
                  className="w-full py-3 rounded-xl font-bold bg-brand-emerald text-black hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 text-sm shadow-lg shadow-brand-emerald/20 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles size={18} />
                  {loading ? "Creating..." : "Create Room & Get Code"}
                </button>
              </form>
            ) : (
              <div className="flex flex-col gap-4 text-center">
                <div className="p-4 bg-brand-background border border-brand-hover rounded-xl">
                  <p className="text-xs text-gray-400 mb-1">Room Code</p>
                  <p className="text-3xl font-extrabold text-brand-emerald tracking-widest">{createdRoom.roomCode}</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Shareable Invitation Link</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={window.location.origin + createdRoom.shareableLink}
                      className="w-full p-2.5 bg-brand-background border border-brand-hover rounded-xl text-xs text-gray-300"
                    />
                    <button
                      onClick={copyShareableLink}
                      className="px-4 bg-brand-emerald text-black font-bold rounded-xl text-xs flex items-center gap-1.5 hover:bg-emerald-400 transition-colors cursor-pointer"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/watch-together/${createdRoom.roomCode}`)}
                  className="w-full py-3 rounded-xl font-bold bg-brand-emerald text-black hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 text-sm shadow-lg shadow-brand-emerald/20 cursor-pointer mt-2"
                >
                  <Film size={18} /> Enter Room Now
                </button>
              </div>
            )}
          </div>
        ) : (
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
              className="w-full py-3 rounded-xl font-bold bg-brand-emerald text-black hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 text-sm shadow-lg shadow-brand-emerald/20 cursor-pointer disabled:opacity-50"
            >
              <LogIn size={18} />
              {loading ? "Joining Room..." : "Join Room Request"}
            </button>
          </form>
        )}
      </div>

      <div className="mt-8 max-w-md text-center text-xs text-gray-400 space-y-2">
        <p className="flex items-center justify-center gap-1.5 font-semibold text-gray-300">
          <Shield size={14} className="text-brand-emerald" /> Room owner controls playback & approves join requests.
        </p>
        <p>All rooms and features are completely free for now with no creation limits.</p>
      </div>
    </div>
  );
};

export default WatchTogetherLobby;
