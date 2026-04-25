import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import SkeletonLoader from './components/SkeletonLoader';
import FloatingChatbot from './components/FloatingChatbot';

// Eager-load critical pages
import HomePage         from './pages/HomePage';
import SetupPage        from './pages/SetupPage';
import AdminLogin       from './pages/AdminLogin';
import DeveloperLogin   from './pages/DeveloperLogin';
import DeveloperDashboard from './pages/DeveloperDashboard';
import ConnectRepo      from './pages/ConnectRepo';

// Lazy-load dashboard pages
const RepositoryOverview = lazy(() => import('./pages/RepositoryOverview'));
const DeveloperImpact    = lazy(() => import('./pages/DeveloperImpact'));
const SkillIntelligence  = lazy(() => import('./pages/SkillIntelligence'));
const RequirementMapping = lazy(() => import('./pages/RequirementMapping'));
const KnowledgeRisk      = lazy(() => import('./pages/KnowledgeRisk'));
const Recommendations    = lazy(() => import('./pages/Recommendations'));
const PlanVsReality      = lazy(() => import('./pages/PlanVsReality'));
const PredictiveRisk     = lazy(() => import('./pages/PredictiveRisk'));
const ManagerDashboard   = lazy(() => import('./pages/ManagerDashboard'));
const SimulationPage     = lazy(() => import('./pages/Simulation'));
const InterventionsPage  = lazy(() => import('./pages/Interventions'));
const DeveloperList      = lazy(() => import('./pages/DeveloperList'));
const DeveloperView      = lazy(() => import('./pages/DeveloperView'));

/* ─────────────────────────────────────────────────────────────────
   Route Guards
───────────────────────────────────────────────────────────────── */

/** Redirect already-logged-in admins away from login/signup pages.
 *  Requires a real session (adminEmail) — not just a stale role flag. */
function AdminAuthGuard({ children }) {
  const { isAdmin, adminEmail, isSetupComplete } = useAuth();
  // Only redirect if BOTH role=admin AND a valid session email exist
  if (isAdmin && adminEmail) {
    return <Navigate to={isSetupComplete ? '/dashboard/overview' : '/connect-repo'} replace />;
  }
  return children;
}

/** Protect /connect-repo — must be a logged-in admin */
function ConnectRepoGuard({ children }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/login" replace />;
  return children;
}

/** Protect /developer-dashboard — must be a logged-in developer */
function DevGuard({ children }) {
  const { isDeveloper, devEmail } = useAuth();
  if (!isDeveloper || !devEmail) return <Navigate to="/developer-login" replace />;
  return children;
}

/* ─────────────────────────────────────────────────────────────────
   Admin Dashboard Layout
───────────────────────────────────────────────────────────────── */
function DashboardLayout() {
  const location = useLocation();
  const navigate  = useNavigate();
  const [loading, setLoading]           = useState(false);
  const [previousPath, setPreviousPath] = useState(location.pathname);

  if (location.pathname !== previousPath) {
    setLoading(true);
    setPreviousPath(location.pathname);
  }

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setLoading(false), 300);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const activePage = location.pathname.split('/').pop();

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <Sidebar
        activePage={activePage}
        onNavigate={(page) => navigate(`/dashboard/${page}`)}
        onSetup={() => navigate('/setup')}
      />
      <Navbar
        repoName={localStorage.getItem('codepulse_repo_name') || ''}
        onSetup={() => navigate('/setup')}
      />
      <main className="ml-[72px] pt-16 lg:pt-[72px] min-h-screen">
        <div className="p-6 lg:p-8">
          {loading ? (
            <SkeletonLoader />
          ) : (
            <Suspense fallback={<SkeletonLoader />}>
              <Routes>
                <Route path="overview"        element={<RepositoryOverview />} />
                <Route path="impact"          element={<DeveloperImpact />} />
                <Route path="skills"          element={<SkillIntelligence />} />
                <Route path="mapping"         element={<RequirementMapping />} />
                <Route path="risk"            element={<KnowledgeRisk />} />
                <Route path="recommendations" element={<Recommendations />} />
                <Route path="plan-reality"    element={<PlanVsReality />} />
                <Route path="predictive-risk" element={<PredictiveRisk />} />
                <Route path="manager-hub"     element={<ManagerDashboard />} />
                <Route path="simulator"       element={<SimulationPage />} />
                <Route path="interventions"   element={<InterventionsPage />} />
                <Route path="developers"      element={<DeveloperList />} />
                <Route path="developers/:githubUsername" element={<DeveloperView />} />
                <Route path="*"               element={<Navigate to="overview" replace />} />
              </Routes>
            </Suspense>
          )}
        </div>
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   App Layout (all top-level routes)
───────────────────────────────────────────────────────────────── */
function AppLayout() {
  const navigate = useNavigate();
  const { isAdmin, isSetupComplete, isDeveloper } = useAuth();

  const handleNavigate = (view) => {
    const map = {
      setup: '/setup', landing: '/', dashboard: '/dashboard/overview',
      login: '/login', 'developer-login': '/developer-login',
    };
    navigate(map[view] || '/');
  };

  const handleSetupComplete = () => navigate('/dashboard/overview');

  return (
    <Routes>
      {/* ── Public ── */}
      <Route path="/"      element={<HomePage onNavigate={handleNavigate} />} />
      <Route path="/setup" element={<SetupPage onComplete={handleSetupComplete} />} />

      {/* ── Admin Auth — redirect away if already signed in ── */}
      <Route path="/login" element={
        <AdminAuthGuard><AdminLogin /></AdminAuthGuard>
      } />

      {/* ── First-time setup — admin only ── */}
      <Route path="/connect-repo" element={
        <ConnectRepoGuard><ConnectRepo /></ConnectRepoGuard>
      } />

      {/* ── Admin Dashboard ── */}
      <Route path="/dashboard/*" element={<DashboardLayout />} />

      {/* ── Developer Portal ── */}
      <Route path="/developer-login" element={<DeveloperLogin />} />
      <Route path="/developer-dashboard" element={
        <DevGuard><DeveloperDashboard /></DevGuard>
      } />

      {/* ── Fallback ── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Root
───────────────────────────────────────────────────────────────── */
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppLayout />
          <FloatingChatbot />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
