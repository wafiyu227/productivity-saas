import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import AuthCallback from './pages/auth/AuthCallback';
import About from './pages/company/About';
import Contact from './pages/company/Contact';
import Privacy from './pages/legal/Privacy';
import Terms from './pages/legal/Terms';
import Security from './pages/legal/Security';
import DemoWorkspace from './pages/DemoWorkspace';
import Waitlist from './pages/Waitlist';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // ✅ FIX: Wait for auth state to load before checking user
  // This prevents premature redirect to /login during OAuth callback processing
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
}

function LandingRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams((location.hash || '').replace(/^#/, ''));

  const hasOAuthParams = searchParams.has('code')
    || searchParams.has('error')
    || searchParams.has('error_description')
    || hashParams.has('access_token')
    || hashParams.has('refresh_token')
    || hashParams.has('error')
    || hashParams.has('error_description');

  if (hasOAuthParams) {
    // Forward to /auth/callback, preserving all params
    // Build query string with next/plan if available from hash or search
    const next = searchParams.get('next') || hashParams.get('next') || '';
    const plan = searchParams.get('plan') || hashParams.get('plan') || '';

    let callbackUrl = `/auth/callback${location.search}${location.hash}`;

    // If we only have hash params (like implicit flow), ensure we still route correctly
    if (!searchParams.has('code') && hashParams.has('access_token')) {
      const newSearch = new URLSearchParams();
      if (next) newSearch.set('next', next);
      if (plan) newSearch.set('plan', plan);
      const qs = newSearch.toString();
      callbackUrl = `/auth/callback${qs ? '?' + qs : ''}${location.hash}`;
    }

    return <Navigate to={callbackUrl} replace />;
  }

  // ✅ New Logic: If user is already logged in and hits landing page, send them to app
  if (!loading && user) {
    return <Navigate to="/app" replace />;
  }

  return <Landing />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingRoute />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/security" element={<Security />} />
          <Route path="/demo" element={<DemoWorkspace />} />
          <Route path="/waitlist" element={<Waitlist />} />
          <Route path="/join" element={<JoinTeam />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
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
