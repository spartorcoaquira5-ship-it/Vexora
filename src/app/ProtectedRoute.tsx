import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import type { UserRole } from '@/shared/types/db';

export function ProtectedRoute({ children, allow }: { children: ReactNode; allow?: UserRole[] }) {
  const { session, profile, loading } = useAuth();

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-2)' }}>Cargando...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (allow && profile && !allow.includes(profile.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}
