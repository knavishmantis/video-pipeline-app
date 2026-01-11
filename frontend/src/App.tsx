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
import PrivateRoute from './components/PrivateRoute';
import ProfileCheckRoute from './components/ProfileCheckRoute';
import { SidebarNav } from './components/SidebarNav';

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-100">
      <SidebarNav />
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex h-full w-full flex-1 flex-col gap-2 rounded-tl-2xl border border-neutral-200 bg-white p-2 md:p-10 overflow-y-auto">
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

