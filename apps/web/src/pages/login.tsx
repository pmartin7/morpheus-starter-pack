import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/use-auth.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { BrandMark } from '../components/brand-mark.js';

type Mode = 'signin' | 'signup' | 'check-email';

// User dismissed the Google popup — an action, not an error. Show nothing.
const POPUP_DISMISSED_CODES = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'];

function authErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err && typeof err.code === 'string') {
    return err.code;
  }
  return 'unknown';
}

function friendlyAuthMessage(err: unknown): string {
  switch (authErrorCode(err)) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password is too weak — use at least 6 characters.';
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'email-not-verified':
      return 'Please verify your email first — check your inbox for the verification link.';
    default:
      return err instanceof Error && err.message.includes('not configured')
        ? err.message
        : 'Something went wrong. Please try again.';
  }
}

function GoogleLogo({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28a7.21 7.21 0 0 1 0-4.56V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

// IMPORTANT: this page must never auto-redirect on auth state (no `user`
// effect). Sign-up transiently authenticates before signUp signs back out — a
// user-watching redirect would destroy the check-email confirmation state.
// Navigate only imperatively in the submit handlers below.
export function LoginPage(): JSX.Element {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUp(email, password);
        setMode('check-email');
      } else {
        await signIn(email, password);
        navigate('/chat');
      }
    } catch (err) {
      setError(friendlyAuthMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (): Promise<void> => {
    setError(null);
    try {
      await signInWithGoogle();
      navigate('/chat');
    } catch (err) {
      if (POPUP_DISMISSED_CODES.includes(authErrorCode(err))) return;
      setError(friendlyAuthMessage(err));
    }
  };

  const switchMode = (next: Mode): void => {
    setMode(next);
    setError(null);
  };

  if (mode === 'check-email') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)] px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <BrandMark className="h-8 w-8 mx-auto" />
          <h1 className="text-2xl font-bold text-ink">Check your email</h1>
          <p className="text-sm text-ink-muted">
            We sent a verification link to <span className="font-medium text-ink">{email}</span>.
            Click it, then sign in.
          </p>
          <Button variant="outline" className="w-full" onClick={() => switchMode('signin')}>
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-56px)] px-4">
      <div className="w-full max-w-sm space-y-6">
        <BrandMark className="h-8 w-8 mx-auto" />
        <h1 className="text-2xl font-bold text-ink text-center">
          {mode === 'signin' ? 'Sign in' : 'Create your account'}
        </h1>
        <Button type="button" variant="outline" className="w-full gap-2" onClick={handleGoogle}>
          <GoogleLogo className="h-4 w-4" />
          Continue with Google
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-ink-muted">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {mode === 'signin'
              ? loading
                ? 'Signing in…'
                : 'Sign in'
              : loading
                ? 'Creating account…'
                : 'Sign up'}
          </Button>
        </form>
        {mode === 'signin' ? (
          <p className="text-sm text-ink-muted text-center">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => switchMode('signup')}
            >
              Sign up
            </button>
          </p>
        ) : (
          <p className="text-sm text-ink-muted text-center">
            Already have an account?{' '}
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => switchMode('signin')}
            >
              Sign in
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
