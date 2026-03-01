import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';
import { Login } from './pages/Login';
import { Invite } from './pages/Invite';
import { Dashboard } from './pages/Dashboard';
import { Alunos } from './pages/Alunos';
import { AlunoForm } from './pages/AlunoForm';
import { AlunoDetail } from './pages/AlunoDetail';
import { Pendencias } from './pages/Pendencias';
import { MainLayout } from './layouts/MainLayout';
import { Usuarios } from './pages/Usuarios';
import { UsuarioForm } from './pages/UsuarioForm';
import { ResetPassword } from './pages/ResetPassword';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
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
      </AuthProvider>
    </BrowserRouter>
  );
}
