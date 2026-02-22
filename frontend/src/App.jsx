import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppShell from './layouts/AppShell';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Summaries from './pages/Summaries';
import Blockers from './pages/Blockers';
import Meetings from './pages/Meetings';
import Profile from './pages/Profile';
import Integrations from './pages/Integrations';
import Code from './pages/Code';
import Repositories from './pages/Repositories';
import Analytics from './pages/Analytics';
import Projects from './pages/Projects';
import Team from './pages/Team';
import TeamSetup from './pages/onboarding/TeamSetup';
import ConnectTools from './pages/onboarding/ConnectTools';
import InviteTeam from './pages/onboarding/InviteTeam';
import OnboardingComplete from './pages/onboarding/OnboardingComplete';
import WelcomeMember from './pages/onboarding/WelcomeMember';
import JoinTeam from './pages/auth/JoinTeam';
import About from './pages/company/About';
import Blog from './pages/company/Blog';
import Contact from './pages/company/Contact';
import Privacy from './pages/legal/Privacy';
import Terms from './pages/legal/Terms';
import Security from './pages/legal/Security';
import DemoWorkspace from './pages/DemoWorkspace';
import Waitlist from './pages/Waitlist';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/about" element={<About />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/security" element={<Security />} />
          <Route path="/demo" element={<DemoWorkspace />} />
          <Route path="/waitlist" element={<Waitlist />} />
          <Route path="/join" element={<JoinTeam />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/onboarding" element={<Navigate to="/onboarding/team-setup" replace />} />
          <Route path="/onboarding/team-setup" element={<ProtectedRoute><TeamSetup /></ProtectedRoute>} />
          <Route path="/onboarding/connect-tools" element={<ProtectedRoute><ConnectTools /></ProtectedRoute>} />
          <Route path="/onboarding/invite-team" element={<ProtectedRoute><InviteTeam /></ProtectedRoute>} />
          <Route path="/onboarding/complete" element={<ProtectedRoute><OnboardingComplete /></ProtectedRoute>} />
          <Route path="/onboarding/welcome-member" element={<ProtectedRoute><WelcomeMember /></ProtectedRoute>} />

          <Route path="/app" element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="summaries" element={<Summaries />} />
            <Route path="blockers" element={<Blockers />} />
            <Route path="meetings" element={<Meetings />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="profile" element={<Profile />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="projects" element={<Projects />} />
            <Route path="code" element={<Code />} />
            <Route path="team" element={<Team />} />
            <Route path="code/repos" element={<Repositories />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
