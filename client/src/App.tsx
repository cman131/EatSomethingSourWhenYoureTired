import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import GameSubmission from './pages/GameSubmission';
import Profile from './pages/Profile';
import GamesList from './pages/GamesList';
import Resources from './pages/Resources';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/submit-game" element={<GameSubmission />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/games" element={<GamesList />} />
            <Route path="/resources" element={<Resources />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;

