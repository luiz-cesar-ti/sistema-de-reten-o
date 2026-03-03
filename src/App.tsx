import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';
import { LoadingSpinner } from './components/LoadingSpinner';

// Lazy loaded components
const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Invite = lazy(() => import('./pages/Invite').then(module => ({ default: module.Invite })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Alunos = lazy(() => import('./pages/Alunos').then(module => ({ default: module.Alunos })));
const AlunoForm = lazy(() => import('./pages/AlunoForm').then(module => ({ default: module.AlunoForm })));
const AlunoDetail = lazy(() => import('./pages/AlunoDetail').then(module => ({ default: module.AlunoDetail })));
const Pendencias = lazy(() => import('./pages/Pendencias').then(module => ({ default: module.Pendencias })));
const MainLayout = lazy(() => import('./layouts/MainLayout').then(module => ({ default: module.MainLayout })));
const Usuarios = lazy(() => import('./pages/Usuarios').then(module => ({ default: module.Usuarios })));
const UsuarioForm = lazy(() => import('./pages/UsuarioForm').then(module => ({ default: module.UsuarioForm })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then(module => ({ default: module.ResetPassword })));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/convite/:token" element={<Invite />} />

            <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />

              <Route path="alunos" element={<Alunos />} />
              <Route path="alunos/novo" element={<PrivateRoute allowedRoles={['atendimento']}><AlunoForm /></PrivateRoute>} />
              <Route path="alunos/:id" element={<AlunoDetail />} />

              <Route path="pendencias" element={<PrivateRoute allowedRoles={['admin', 'diretor', 'coordenacao']}><Pendencias /></PrivateRoute>} />

              <Route path="usuarios" element={<PrivateRoute allowedRoles={['admin']}><Usuarios /></PrivateRoute>} />
              <Route path="usuarios/novo" element={<PrivateRoute allowedRoles={['admin']}><UsuarioForm /></PrivateRoute>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
