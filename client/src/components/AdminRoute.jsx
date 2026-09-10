import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute({ children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0efeb]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#007c89] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-[#5c5c5c]">Verifying security credentials...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.role?.toLowerCase() !== 'admin') {
    return <Navigate to="/dashboard" state={{ unauthorizedAdmin: true }} replace />;
  }

  return children;
}
