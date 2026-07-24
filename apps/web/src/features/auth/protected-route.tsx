import { Navigate } from 'react-router-dom';
import { useAuth } from './use-auth.js';

export function ProtectedRoute({ children }: { children: React.ReactNode }): JSX.Element {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)]">
        <div className="text-sm text-ink-muted">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
