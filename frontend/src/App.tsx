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
import PrivateRoute from './components/PrivateRoute';
import ProfileCheckRoute from './components/ProfileCheckRoute';
import { SidebarNav } from './components/SidebarNav';

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-100">
      <SidebarNav />
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex h-full w-full flex-1 flex-col gap-2 rounded-tl-2xl border border-neutral-200 bg-white p-2 md:p-10 overflow-y-auto">
          {/* YouTube Icon - Top Right */}
          <a
            href="https://www.youtube.com/@knavishmantis"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-4 right-4 z-10 p-2 text-red-600 hover:text-red-700 transition-colors"
            title="Visit YouTube Channel"
          >
            <svg
              className="w-6 h-6"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
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

