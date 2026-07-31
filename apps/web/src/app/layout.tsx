import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/use-auth.js';
import { Button } from '../components/ui/button.js';
import { BrandMark } from '../components/brand-mark.js';

export function AppLayout(): JSX.Element {
  const { user, emailVerified, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async (): Promise<void> => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <nav className="border-b border-border bg-card px-6 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold text-ink text-sm">
          <BrandMark className="h-5 w-5" />
          Morpheus App
        </Link>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* Unverified accounts cannot reach /chat, so offering the link
                  would only bounce them to the verification page. */}
              {emailVerified && (
                <Link to="/chat" className="text-sm text-ink-muted hover:text-ink">
                  Chat
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                Sign out
              </Button>
            </>
          ) : (
            <Link to="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          )}
        </div>
      </nav>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
