import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import GameSubmission from './pages/GameSubmission';
import Profile from './pages/Profile';
import GamesList from './pages/GamesList';
import GameDetail from './pages/GameDetail';
import Resources from './pages/Resources';
import MembersList from './pages/MembersList';
import AchievementsList from './pages/AchievementsList';
import ScoreCalculator from './pages/ScoreCalculator';
import DiscardQuiz from './pages/DiscardQuiz';
import DecisionQuiz from './pages/DecisionQuiz';
import TournamentSubmission from './pages/TournamentSubmission';
import TournamentDetail from './pages/TournamentDetail';
import TournamentsList from './pages/TournamentsList';
import TournamentGameSubmission from './pages/TournamentGameSubmission';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/submit-game" element={<GameSubmission />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/games" element={<GamesList />} />
            <Route path="/games/:id" element={<GameDetail />} />
            <Route path="/tournaments" element={<TournamentsList />} />
            <Route path="/members" element={<MembersList />} />
            <Route path="/achievements" element={<AchievementsList />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/calculator" element={<ScoreCalculator />} />
            <Route path="/discard-quiz/:discardQuizId" element={<DiscardQuiz />} />
            <Route path="/discard-quiz" element={<DiscardQuiz />} />
            <Route path="/decision-quiz/:decisionQuizId" element={<DecisionQuiz />} />
            <Route path="/decision-quiz" element={<DecisionQuiz />} />
            <Route path="/create-tournament" element={<TournamentSubmission />} />
            <Route path="/tournaments/:id" element={<TournamentDetail />} />
            <Route path="/tournaments/:tournamentId/submit-game/:roundNumber/:tableNumber" element={<TournamentGameSubmission />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;

