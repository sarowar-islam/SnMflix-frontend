import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './views/Home';
import MovieDetails from './views/MovieDetails';
import WatchPage from './views/WatchPage';
import Login from './views/Login';
import Watchlist from './views/Watchlist';
import Favorites from './views/Favorites';

const NotFound = () => <div className="p-8 text-center text-white text-2xl mt-20">404 - Not Found</div>;

// Layout wrapper for routes that need the navbar
const MainLayout = ({ children }) => (
  <div className="min-h-screen bg-brand-background text-brand-main">
    <Navbar />
    {children}
  </div>
);

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Main Layout Routes */}
          <Route path="/" element={<MainLayout><Home type="all" /></MainLayout>} />
          <Route path="/movies" element={<MainLayout><Home type="movies" /></MainLayout>} />
          <Route path="/tv" element={<MainLayout><Home type="tv" /></MainLayout>} />
          
          <Route path="/movie/:id" element={<MainLayout><MovieDetails /></MainLayout>} />
          <Route path="/login" element={<MainLayout><Login /></MainLayout>} />
          <Route path="/watchlist" element={<MainLayout><Watchlist /></MainLayout>} />
          <Route path="/favorites" element={<MainLayout><Favorites /></MainLayout>} />

          {/* Standalone full-screen routes */}
          <Route path="/watch/:id" element={<WatchPage />} />

          {/* Catch-all */}
          <Route path="*" element={<MainLayout><NotFound /></MainLayout>} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
