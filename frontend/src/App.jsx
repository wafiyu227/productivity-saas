import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PaddleProvider } from './contexts/PaddleContext';
import AppShell from './layouts/AppShell';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import WorkInsights from './pages/WorkInsights';
import AgentChat from './pages/AgentChat';
import SharedConversation from './pages/SharedConversation';
import Blockers from './pages/Blockers';
import Meetings from './pages/Meetings';
import Profile from './pages/Profile';
import Integrations from './pages/Integrations';
import Code from './pages/Code';
import Repositories from './pages/Repositories';
import Analytics from './pages/Analytics';
import Projects from './pages/Projects';
import AuthCallback from './pages/auth/AuthCallback';
import About from './pages/company/About';
import Contact from './pages/company/Contact';
import Privacy from './pages/legal/Privacy';
import Terms from './pages/legal/Terms';
import Security from './pages/legal/Security';
import RefundPolicy from './pages/legal/RefundPolicy';
import DemoWorkspace from './pages/DemoWorkspace';
import Waitlist from './pages/Waitlist';
import ForgotPassword from './pages/auth/ForgotPassword';
import UpdatePassword from './pages/auth/UpdatePassword';
import Onboarding from './pages/Onboarding';
import OnboardingIntegrations from './pages/onboarding/OnboardingIntegrations';


const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

// Requires login only
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? children : <Navigate to="/login" replace />;
}

function LandingRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams((location.hash || '').replace(/^#/, ''));

  const hasOAuthParams =
    searchParams.has('code') || searchParams.has('error') ||
    searchParams.has('error_description') ||
    hashParams.has('access_token') || hashParams.has('refresh_token') ||
    hashParams.has('error') || hashParams.has('error_description');

  if (hasOAuthParams) {
    const next = searchParams.get('next') || hashParams.get('next') || '';
    const plan = searchParams.get('plan') || hashParams.get('plan') || '';
    let callbackUrl = `/auth/callback${location.search}${location.hash}`;
    if (!searchParams.has('code') && hashParams.has('access_token')) {
      const newSearch = new URLSearchParams();
      if (next) newSearch.set('next', next);
      if (plan) newSearch.set('plan', plan);
      const qs = newSearch.toString();
      callbackUrl = `/auth/callback${qs ? '?' + qs : ''}${location.hash}`;
    }
    return <Navigate to={callbackUrl} replace />;
  }

  if (loading) return <Spinner />;
  if (user) return <Navigate to="/app" replace />;
  return <Landing />;
}

function App() {
  return (
    <BrowserRouter>
      <PaddleProvider>
        <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingRoute />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/security" element={<Security />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="/demo" element={<DemoWorkspace />} />
          <Route path="/waitlist" element={<Waitlist />} />
          <Route path="/shared/chat/:shareToken" element={<SharedConversation />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/update-password" element={<UpdatePassword />} />

          <Route path="/onboarding" element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="welcome" replace />} />
            <Route path="welcome" element={<OnboardingIntegrations />} />
          </Route>


          <Route path="/app" element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="insights" element={<WorkInsights />} />
            <Route path="chat" element={<AgentChat />} />
            <Route path="blockers" element={<Blockers />} />
            <Route path="meetings" element={<Meetings />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="profile" element={<Profile />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="projects" element={<Projects />} />
            <Route path="code" element={<Code />} />
            <Route path="code/repos" element={<Repositories />} />
          </Route>
        </Routes>
      </AuthProvider>
      </PaddleProvider>
    </BrowserRouter>
  );
}

export default App;
