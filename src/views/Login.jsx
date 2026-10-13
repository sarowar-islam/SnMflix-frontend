import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, UserPlus, Mail, Lock, User, AlertCircle, CheckCircle, Eye, EyeOff, Users, Play, ArrowLeft } from 'lucide-react';
import api from '../utils/api';

const Login = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isRegister, setIsRegister] = useState(searchParams.get('mode') === 'signup');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [emailStatus, setEmailStatus] = useState(null);
  const [usernameStatus, setUsernameStatus] = useState(null);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const { user, login } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect to home immediately
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // Sync mode with URL search params
  useEffect(() => {
    setIsRegister(searchParams.get('mode') === 'signup');
  }, [searchParams]);

  // Debounced email availability check
  useEffect(() => {
    if (!isRegister || !email.trim() || !email.includes('@')) {
      setEmailStatus(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/auth/check-email?email=${encodeURIComponent(email.trim())}`);
        if (res.data?.exists) {
          setEmailStatus({ available: false, msg: 'Email is already registered. Sign in instead?' });
        } else {
          setEmailStatus({ available: true, msg: 'Email is available' });
        }
      } catch (e) {
        setEmailStatus({ available: true, msg: 'Email format looks good' });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [email, isRegister]);

  // Debounced username availability check
  useEffect(() => {
    if (!isRegister || !username.trim() || username.length < 3) {
      setUsernameStatus(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/auth/check-username?username=${encodeURIComponent(username.trim())}`);
        if (res.data?.exists) {
          setUsernameStatus({ available: false, msg: 'Username is already taken. Sign in instead?' });
        } else {
          setUsernameStatus({ available: true, msg: 'Username is available' });
        }
      } catch (e) {
        setUsernameStatus({ available: true, msg: 'Username looks good' });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [username, isRegister]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!email && !username) {
      setError('Please enter your email or username');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    if (isRegister) {
      if (!username.trim()) {
        setError('Username is required for sign up');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if ((emailStatus && !emailStatus.available) || (usernameStatus && !usernameStatus.available)) {
        setError('An account with this email or username already exists. Please sign in instead.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isRegister) {
        await api.post('/auth/register', {
          email: email.trim(),
          username: username.trim(),
          password,
          confirmPassword
        });
        setSuccessMsg('Account created successfully! Signing you in...');

        const loginRes = await api.post('/auth/login', {
          login: email.trim() || username.trim(),
          password
        });

        const { token, ...userData } = loginRes.data;
        login(userData, token);
        setTimeout(() => navigate('/', { replace: true }), 1000);
      } else {
        const loginRes = await api.post('/auth/login', {
          login: email.trim(),
          password
        });

        const { token, ...userData } = loginRes.data;
        login(userData, token);
        navigate('/', { replace: true });
      }
    } catch (err) {
      const msg = err.response?.data || err.message || 'Authentication failed. Please check your credentials.';
      setError(typeof msg === 'string' ? msg : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    alert("Continue with Google integration point is prepared. Please configure your Google OAuth credentials in backend/frontend environment variables to activate.");
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex items-center justify-center p-3 sm:p-6 lg:p-8 text-white bg-brand-background">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center">

        {/* Left Column: Branding & Value Proposition (Hidden on mobile/tablet, visible on lg screens) */}
        <div className="hidden lg:flex lg:col-span-6 flex-col justify-center space-y-4 text-left">
          {/* Back to Home Button on Desktop */}
          <div>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-surface border border-brand-hover text-gray-300 hover:text-white hover:border-brand-emerald text-xs font-semibold transition-all cursor-pointer shadow mb-2"
            >
              <ArrowLeft size={14} className="text-brand-emerald" />
              <span>Back to Home</span>
            </button>
          </div>

          <div className="flex items-center justify-start">
            <img src="/images/logo.png" alt="SnM Flix" className="h-12 w-auto object-contain" />
          </div>
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Stream Unlimited <span className="text-brand-emerald">Movies & TV Series</span>
          </h1>
          <p className="text-sm text-gray-300 leading-relaxed max-w-md">
            Join SnM Flix to unlock live Watch Together rooms with friends, synchronize your personal watchlist across devices, and enjoy crystal-clear streaming.
          </p>
          <div className="flex flex-row items-center gap-3 pt-2 text-xs text-gray-400 font-semibold">
            <div className="flex items-center gap-2 bg-brand-surface border border-brand-hover px-3 py-2 rounded-xl">
              <Play size={14} className="text-brand-emerald" /> 100% Free Streaming
            </div>
            <div className="flex items-center gap-2 bg-brand-surface border border-brand-hover px-3 py-2 rounded-xl">
              <Users size={14} className="text-brand-emerald" /> Watch Together Rooms
            </div>
          </div>
        </div>

        {/* Right Column / Full width on mobile: Auth Form Card */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center w-full">
          <div className="bg-brand-surface border border-brand-hover rounded-2xl p-4 sm:p-6 max-w-md w-full shadow-2xl backdrop-blur-md relative">

            {/* Back to Home Button on Mobile/Tablet inside card */}
            <div className="flex lg:hidden items-center justify-between mb-3">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-background border border-brand-hover text-gray-300 hover:text-white text-[11px] font-semibold cursor-pointer"
              >
                <ArrowLeft size={12} className="text-brand-emerald" />
                <span>Home</span>
              </button>
              <img src="/images/logo.png" alt="SnM Flix" className="h-7 w-auto object-contain" />
            </div>

            <h2 className="text-lg sm:text-xl font-bold mb-1 text-center text-gray-100">
              {isRegister ? "Create Your Account" : "Sign In to Your Account"}
            </h2>
            <p className="text-[11px] text-gray-400 text-center mb-3">
              {isRegister ? "Join SnM Flix to access Watch Together and sync watchlist" : "Welcome back! Enter your details to continue"}
            </p>

            {error && (
              <div className="mb-3 p-2 rounded-xl bg-red-950/60 border border-red-900/60 text-red-300 text-xs flex flex-col gap-2 shadow-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className="flex-shrink-0 text-red-400" />
                  <span className="font-semibold">{error}</span>
                </div>
                {(error.includes('already') || error.includes('registered') || error.includes('taken')) && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(false);
                      setSearchParams({ mode: 'signin' });
                      setError('');
                    }}
                    className="self-start px-2.5 py-1 rounded-lg bg-brand-emerald text-black font-bold text-[11px] hover:bg-emerald-400 transition-colors shadow cursor-pointer"
                  >
                    Already have an account? Sign In
                  </button>
                )}
              </div>
            )}

            {successMsg && (
              <div className="mb-3 p-2 rounded-xl bg-emerald-950/50 border border-emerald-900/50 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle size={14} className="flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
              <div>
                <label className="text-[11px] font-medium text-gray-400 mb-0.5 flex items-center justify-between w-full">
                  <span>{isRegister ? "Email Address" : "Email or Username"}</span>
                  {emailStatus && isRegister && (
                    <span className={`text-[10px] font-semibold ${emailStatus.available ? 'text-emerald-400' : 'text-red-400'}`}>
                      {emailStatus.msg}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Mail size={14} />
                  </span>
                  <input
                    type={isRegister ? "email" : "text"}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={isRegister ? "alex@example.com" : "alex@example.com or username"}
                    className="w-full pl-9 pr-3 py-2 bg-brand-background border border-brand-hover rounded-xl focus:outline-none focus:border-brand-emerald text-xs text-white"
                    required
                  />
                </div>
              </div>

              {isRegister && (
                <div>
                  <label className="text-[11px] font-medium text-gray-400 mb-0.5 flex items-center justify-between w-full">
                    <span>Username</span>
                    {usernameStatus && (
                      <span className={`text-[10px] font-semibold ${usernameStatus.available ? 'text-emerald-400' : 'text-red-400'}`}>
                        {usernameStatus.msg}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <User size={14} />
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="alex_movies"
                      className="w-full pl-9 pr-3 py-2 bg-brand-background border border-brand-hover rounded-xl focus:outline-none focus:border-brand-emerald text-xs text-white"
                      required={isRegister}
                    />
                  </div>
                </div>
              )}

              {/* Password Field with Eye Toggle */}
              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-0.5">Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Lock size={14} />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-9 py-2 bg-brand-background border border-brand-hover rounded-xl focus:outline-none focus:border-brand-emerald text-xs text-white"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {isRegister && (
                <div>
                  <label className="block text-[11px] font-medium text-gray-400 mb-0.5">Confirm Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Lock size={14} />
                    </span>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-9 py-2 bg-brand-background border border-brand-hover rounded-xl focus:outline-none focus:border-brand-emerald text-xs text-white"
                      required={isRegister}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(prev => !prev)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 w-full py-2.5 rounded-xl font-bold bg-brand-emerald text-black hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 shadow-md shadow-brand-emerald/20 text-xs cursor-pointer disabled:opacity-50"
              >
                {isRegister ? <UserPlus size={16} /> : <LogIn size={16} />}
                {loading ? "Processing..." : (isRegister ? "Sign Up Now" : "Sign In")}
              </button>
            </form>

            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-brand-hover"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-brand-surface px-2 text-gray-400">Or continue with</span>
              </div>
            </div>

            {/* Continue with Google Button */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              className="w-full py-2 px-4 rounded-xl border border-brand-hover bg-brand-background hover:bg-brand-hover text-white font-medium text-xs flex items-center justify-center gap-3 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.18v3.15C3.15 21.32 7.21 24 12 24z"/>
                <path fill="#FBBC05" d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.18C.43 8.12 0 9.81 0 12s.43 3.88 1.18 5.39l4.09-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.21 0 3.15 2.68 1.18 6.61l4.09 3.15c.95-2.85 3.6-4.96 6.73-4.96z"/>
              </svg>
              Continue with Google
            </button>

            {/* Highlighted Switcher Card */}
            <div className="mt-3 p-2.5 bg-brand-background border border-brand-hover rounded-xl flex items-center justify-between text-xs shadow-inner">
              <span className="text-gray-400 font-medium">
                {isRegister ? "Already have an account?" : "New to SnM Flix?"}
              </span>
              <button
                onClick={() => {
                  const newMode = !isRegister;
                  setIsRegister(newMode);
                  setSearchParams(newMode ? { mode: 'signup' } : { mode: 'signin' });
                  setError('');
                  setSuccessMsg('');
                }}
                className="px-3 py-1.5 rounded-xl bg-brand-emerald text-black hover:bg-emerald-400 font-bold transition-all cursor-pointer shadow-md shadow-brand-emerald/20 text-xs"
              >
                {isRegister ? "Sign In" : "Create Account"}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;
