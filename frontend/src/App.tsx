import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useToast } from './hooks/useToast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ShortDetail from './pages/ShortDetail';
import UserManagement from './pages/UserManagement';
import PaymentTracking from './pages/PaymentTracking';
import ProfileCompletion from './pages/ProfileCompletion';
import Guide from './pages/Guide';
import FlashbackReference from './pages/FlashbackReference';
import EditingReference from './pages/EditingReference';
import YouTubeStats from './pages/YouTubeStats';
import ScriptReview from './pages/ScriptReview';
import PrivateRoute from './components/PrivateRoute';
import ProfileCheckRoute from './components/ProfileCheckRoute';
import { SidebarNav } from './components/SidebarNav';
import { IconBrandYoutube } from '@tabler/icons-react';

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <SidebarNav />
      <div className="flex flex-1 overflow-hidden relative">
        <div
          className="flex h-full w-full flex-1 flex-col gap-2 p-2 md:p-8 overflow-y-auto relative"
          style={{ background: 'transparent' }}
        >
          <a
            href="https://youtube.com/@knavishmantis"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-4 right-4 z-10 p-2 rounded transition-all"
            style={{ color: '#FF5E5E' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,94,94,0.12)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            title="Visit YouTube Channel"
          >
            <IconBrandYoutube className="h-5 w-5" />
          </a>
          {children}
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { ToastComponent } = useToast();

  return (
    <>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/complete-profile"
            element={
              <PrivateRoute>
                <ProfileCompletion />
              </PrivateRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProfileCheckRoute>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </ProfileCheckRoute>
            }
          />
          <Route
            path="/shorts/:id"
            element={
              <ProfileCheckRoute>
                <AppLayout>
                  <ShortDetail />
                </AppLayout>
              </ProfileCheckRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProfileCheckRoute requiredRole="admin">
                <AppLayout>
                  <UserManagement />
                </AppLayout>
              </ProfileCheckRoute>
            }
          />
          <Route
            path="/payments"
            element={
              <ProfileCheckRoute>
                <AppLayout>
                  <PaymentTracking />
                </AppLayout>
              </ProfileCheckRoute>
            }
          />
          <Route
            path="/guide"
            element={
              <ProfileCheckRoute>
                <AppLayout>
                  <Guide />
                </AppLayout>
              </ProfileCheckRoute>
            }
          />
          <Route
            path="/flashback-reference"
            element={
              <ProfileCheckRoute>
                <AppLayout>
                  <FlashbackReference />
                </AppLayout>
              </ProfileCheckRoute>
            }
          />
          <Route
            path="/editing-reference"
            element={
              <ProfileCheckRoute>
                <AppLayout>
                  <EditingReference />
                </AppLayout>
              </ProfileCheckRoute>
            }
          />
          <Route
            path="/youtube-stats"
            element={
              <ProfileCheckRoute>
                <AppLayout>
                  <YouTubeStats />
                </AppLayout>
              </ProfileCheckRoute>
            }
          />
          <Route
            path="/script-review"
            element={
              <ProfileCheckRoute requiredRole="admin">
                <AppLayout>
                  <ScriptReview />
                </AppLayout>
              </ProfileCheckRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      <ToastComponent />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
