import { Navigate } from 'react-router-dom';
import { useAuth } from './use-auth.js';

export function PublicRoute({ children }: { children: React.ReactNode }): JSX.Element {
  const { user, emailVerified, loading } = useAuth();

  // Render children while auth resolves rather than a spinner: anonymous
  // visitors are the common case on these routes and must not wait.
  if (loading) {
    return <>{children}</>;
  }

  if (user) {
    return <Navigate to={emailVerified ? '/chat' : '/verify-email'} replace />;
  }

  return <>{children}</>;
}
