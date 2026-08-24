import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Conversations from './pages/Conversations';
import KnowledgeBase from './pages/KnowledgeBase';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';
import Users from './pages/Users';
import Login from './pages/Login';

const ProtectedRoute = ({ children, authToken }) => {
  if (!authToken) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  const [authToken, setAuthToken] = useState(localStorage.getItem('lexa_admin_token'));

  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;
