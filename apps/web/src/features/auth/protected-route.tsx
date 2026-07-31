import { Navigate } from 'react-router-dom';
import { useAuth } from './use-auth.js';

export function ProtectedRoute({ children }: { children: React.ReactNode }): JSX.Element {
  const { user, emailVerified, loading } = useAuth();

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

  // Signed in is not enough: the API guard rejects every request an unverified
  // password account makes, so this route would render a UI that only 401s.
  if (!emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  return <>{children}</>;
}
