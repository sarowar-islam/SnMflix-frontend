import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Film } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) return;

    // Simple and easy mock/client auth session (instant login/signup)
    const mockUser = {
      email: email.trim(),
      name: email.split('@')[0],
    };
    const mockToken = 'snm_flix_token_' + Date.now();

    login(mockUser, mockToken);
    navigate(-1); // Return back to where they were instantly
  };

  return (
    <div className="flex justify-center items-center min-h-[85vh] flex-col p-4 text-white">
      <div className="bg-brand-surface border border-brand-hover rounded-2xl p-8 max-w-sm w-full shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-center gap-2 mb-6 text-brand-emerald">
          <Film size={32} />
          <span className="text-2xl font-bold text-white">SnM Flix</span>
        </div>

        <h2 className="text-xl font-bold mb-6 text-center text-gray-200">
          {isRegister ? "Create Your Account" : "Sign In to Your Account"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Email or Username</label>
            <input
              type="text"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="e.g. alex@example.com"
              className="w-full p-3 bg-brand-background border border-brand-hover rounded-xl focus:outline-none focus:border-brand-emerald text-sm text-white"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-3 bg-brand-background border border-brand-hover rounded-xl focus:outline-none focus:border-brand-emerald text-sm text-white"
              required
            />
          </div>

          <button 
            type="submit" 
            className="mt-2 w-full py-3 rounded-xl font-bold bg-brand-emerald text-black hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-brand-emerald/20 text-sm"
          >
            <LogIn size={18} />
            {isRegister ? "Sign Up Now" : "Sign In"}
          </button>
        </form>

        <button 
          onClick={() => setIsRegister(!isRegister)}
          className="mt-6 text-xs text-brand-sage hover:text-white w-full text-center transition-colors"
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
