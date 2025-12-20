import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RequesterPage from './pages/RequesterPage';
import ReviewerPage from './pages/ReviewerPage';
import LoginPage from './pages/login';
import SignupPage from './pages/signup';
import DashboardGateway from './pages/dashboard';
import './App.css';
import '../src/css/dashlogsign.css'; 
import { isAuthenticated } from './utils/auth';
import { RoleBasedRoute } from './utils/RoleBasedRoute';
import { ProtectedRoute } from './components/protectedroute';
import TemplatesPage from './pages/templates';
import PublicRoute from './utils/publicRoute';

function App() {
  return (
    <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />

          <Route
          path="/signup"
          element={
            <PublicRoute>
               <SignupPage />
            </PublicRoute>
          }
          />
          {/* Protected route */}
          <Route
          path='/dashboard'
          element={
            <ProtectedRoute>
              <DashboardGateway />
            </ProtectedRoute>
          }
          />
          <Route
          path='/templates'
          element={
            <ProtectedRoute>
              <TemplatesPage />
            </ProtectedRoute>
          }
          />
          <Route
          path='/'
          element={
            isAuthenticated() ?
            <Navigate to='/dashboard' replace /> :
            <Navigate to='/login' replace />
          }
          />
          <Route
          path="/reviewer"
          element={
            <RoleBasedRoute allowedRoles={['admin']}>
              <ReviewerPage />
            </RoleBasedRoute>
          }
          />
          <Route
          path='/requester'
          element={
            <RoleBasedRoute allowedRoles={['user']}>
              <RequesterPage />
            </RoleBasedRoute>
          }
          />
          <Route
          path='*'
          element={
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100vh',
              flexDirection: 'column'
            }}>
              <h1>404 - Page Not Found</h1>
              <a href='/'>Go Home</a>
            </div>
          }
          />
        </Routes>
    </BrowserRouter>
  );
}

export default App;
