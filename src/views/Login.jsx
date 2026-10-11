import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Film, UserPlus, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../utils/api';

const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

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
    }

    setLoading(true);
    try {
      if (isRegister) {
        // Register API call
        await api.post('/auth/register', {
          email: email.trim(),
          username: username.trim(),
          password,
          confirmPassword
        });
        setSuccessMsg('Account created successfully! Signing you in...');

        // Auto login after successful registration
        const loginRes = await api.post('/auth/login', {
          login: email.trim() || username.trim(),
          password
        });

        const { token, ...userData } = loginRes.data;
        login(userData, token);
        setTimeout(() => navigate('/'), 1000);
      } else {
        // Login API call
        const loginRes = await api.post('/auth/login', {
          login: email.trim(),
          password
        });

        const { token, ...userData } = loginRes.data;
        login(userData, token);
        navigate(-1);
      }
    } catch (err) {
      const msg = err.response?.data || err.message || 'Authentication failed. Please check your credentials.';
      setError(typeof msg === 'string' ? msg : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    // UI preparation and integration point for Google OAuth
    alert("Continue with Google integration point is prepared. Please configure your Google OAuth credentials in backend/frontend environment variables to activate.");
  };

  return (
    <div className="flex justify-center items-center min-h-[85vh] flex-col p-4 text-white">
      <div className="bg-brand-surface border border-brand-hover rounded-2xl p-8 max-w-md w-full shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-center gap-2 mb-6 text-brand-emerald">
          <Film size={32} />
          <span className="text-2xl font-bold text-white">SnM Flix</span>
        </div>

        <h2 className="text-xl font-bold mb-2 text-center text-gray-200">
          {isRegister ? "Create Your Account" : "Sign In to Your Account"}
        </h2>
        <p className="text-xs text-gray-400 text-center mb-6">
          {isRegister ? "Join SnM Flix to access Watch Together and sync your watchlist" : "Welcome back! Enter your details to continue"}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-900/50 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/50 border border-emerald-900/50 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle size={16} className="flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              {isRegister ? "Email Address" : "Email or Username"}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Mail size={16} />
              </span>
              <input
                type={isRegister ? "email" : "text"}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={isRegister ? "alex@example.com" : "alex@example.com or username"}
                className="w-full pl-10 pr-3 py-3 bg-brand-background border border-brand-hover rounded-xl focus:outline-none focus:border-brand-emerald text-sm text-white"
                required
              />
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Username</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <User size={16} />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="alex_movies"
                  className="w-full pl-10 pr-3 py-3 bg-brand-background border border-brand-hover rounded-xl focus:outline-none focus:border-brand-emerald text-sm text-white"
                  required={isRegister}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Lock size={16} />
              </span>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3 py-3 bg-brand-background border border-brand-hover rounded-xl focus:outline-none focus:border-brand-emerald text-sm text-white"
                required
              />
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Confirm Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-3 bg-brand-background border border-brand-hover rounded-xl focus:outline-none focus:border-brand-emerald text-sm text-white"
                  required={isRegister}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full py-3 rounded-xl font-bold bg-brand-emerald text-black hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-brand-emerald/20 text-sm cursor-pointer disabled:opacity-50"
          >
            {isRegister ? <UserPlus size={18} /> : <LogIn size={18} />}
            {loading ? "Processing..." : (isRegister ? "Sign Up Now" : "Sign In")}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-brand-hover"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-brand-surface px-2 text-gray-400">Or continue with</span>
          </div>
        </div>

        {/* Continue with Google Button */}
        <button
          type="button"
          onClick={handleGoogleAuth}
          className="w-full py-2.5 px-4 rounded-xl border border-brand-hover bg-brand-background hover:bg-brand-hover text-white font-medium text-xs flex items-center justify-center gap-3 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.18v3.15C3.15 21.32 7.21 24 12 24z"/>
            <path fill="#FBBC05" d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.18C.43 8.12 0 9.81 0 12s.43 3.88 1.18 5.39l4.09-3.15z"/>
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.21 0 3.15 2.68 1.18 6.61l4.09 3.15c.95-2.85 3.6-4.96 6.73-4.96z"/>
          </svg>
          Continue with Google
        </button>

        <button
          onClick={() => { setIsRegister(!isRegister); setError(''); setSuccessMsg(''); }}
          className="mt-6 text-xs text-brand-sage hover:text-white w-full text-center transition-colors cursor-pointer"
        >
          {isRegister ? "Already have an account? Sign in" : "New to SnM Flix? Create an account"}
        </button>
      </div>

      <p className="mt-6 max-w-xs text-center text-xs text-gray-500">
        Account creation is optional. You can always browse and stream movies as a guest without signing in.
      </p>
    </div>
  );
};

export default Login;
