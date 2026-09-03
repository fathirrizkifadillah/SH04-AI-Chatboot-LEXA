import { useState, lazy, Suspense, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Conversations = lazy(() => import('./pages/Conversations'));
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'));
const Settings = lazy(() => import('./pages/Settings'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Users = lazy(() => import('./pages/Users'));

interface ProtectedRouteProps {
  children: ReactNode;
  authToken: string | null;
}

const ProtectedRoute = ({ children, authToken }: ProtectedRouteProps) => {
  if (!authToken) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      <span className="text-sm text-slate-500">Loading...</span>
    </div>
  </div>
);

function App() {
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('lexa_admin_token'));

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login setAuthToken={setAuthToken} />} />
          <Route path="/" element={
            <ProtectedRoute authToken={authToken}>
              <Layout setAuthToken={setAuthToken} />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="conversations" element={<Conversations />} />
            <Route path="kb" element={<KnowledgeBase />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="users" element={<Users />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<div className="p-4 text-slate-500">Page not found</div>} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;