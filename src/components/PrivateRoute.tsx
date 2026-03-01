import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface PrivateRouteProps {
    children: React.ReactNode;
    allowedRoles?: string[];
}

export function PrivateRoute({ children, allowedRoles }: PrivateRouteProps) {
    const { session, profile, isLoading, hasPrivilege } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-50">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-objetivo-blue border-t-transparent"></div>
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && profile && !allowedRoles.some(role => hasPrivilege(role))) {
        toast.error('Você não tem permissão para acessar esta área.');
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
}
