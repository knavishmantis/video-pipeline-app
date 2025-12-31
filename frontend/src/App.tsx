import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ShortDetail from './pages/ShortDetail';
import UserManagement from './pages/UserManagement';
import PaymentTracking from './pages/PaymentTracking';
import ProfileCompletion from './pages/ProfileCompletion';
import PrivateRoute from './components/PrivateRoute';
import ProfileCheckRoute from './components/ProfileCheckRoute';
import { SidebarNav } from './components/SidebarNav';

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-100 dark:bg-neutral-800">
      <SidebarNav />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex h-full w-full flex-1 flex-col gap-2 rounded-tl-2xl border border-neutral-200 bg-white p-2 md:p-10 dark:border-neutral-700 dark:bg-neutral-900 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

function App() {

  return (
    <AuthProvider>
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
              <ProfileCheckRoute>
                <AppLayout>
                  <UserManagement />
                </AppLayout>
              </ProfileCheckRoute>
            }
          />
          <Route
            path="/payments"
            element={
              <ProfileCheckRoute requiredRole="admin">
                <AppLayout>
                  <PaymentTracking />
                </AppLayout>
              </ProfileCheckRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

