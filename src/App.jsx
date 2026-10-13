import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Home from './views/Home';
import MovieDetails from './views/MovieDetails';
import WatchPage from './views/WatchPage';
import Login from './views/Login';
import Watchlist from './views/Watchlist';
import Favorites from './views/Favorites';
import CategoryPage from './views/CategoryPage';
import WatchTogetherLobby from './views/WatchTogetherLobby';
import WatchTogetherRoom from './views/WatchTogetherRoom';

const NotFound = () => <div className="p-8 text-center text-white text-2xl mt-20">404 - Not Found</div>;

// Layout wrapper for routes that need the navbar and sidebar
const MainLayout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-brand-background text-brand-main">
      <Navbar onToggleSidebar={() => setIsSidebarOpen(prev => !prev)} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="md:ml-16 lg:ml-64 transition-all duration-300">
        {children}
      </div>
    </div>
  );
};

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
          <Route path="/login" element={<Login />} />
          <Route path="/watchlist" element={<MainLayout><Watchlist /></MainLayout>} />
          <Route path="/favorites" element={<MainLayout><Favorites /></MainLayout>} />
          <Route path="/category/:category" element={<MainLayout><CategoryPage /></MainLayout>} />

          {/* Watch Together Routes */}
          <Route path="/watch-together" element={<MainLayout><WatchTogetherLobby /></MainLayout>} />
          <Route path="/watch-together/:roomCode" element={<WatchTogetherRoom />} />

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
