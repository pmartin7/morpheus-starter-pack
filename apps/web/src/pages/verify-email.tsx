import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/use-auth.js';
import { Button } from '../components/ui/button.js';
import { BrandMark } from '../components/brand-mark.js';

const POLL_INTERVAL_MS = 5_000;
const RESEND_COOLDOWN_MS = 60_000;

// The cooldown lives in sessionStorage, not in component state or route state:
// this page unmounts the moment the claim turns verified, and any user who lands
// back here (a second sign-in, a failed verification) must still be held to it.
const COOLDOWN_KEY = 'verify-email:last-sent-at';

function cooldownSecondsLeft(): number {
  const raw = sessionStorage.getItem(COOLDOWN_KEY);
  if (!raw) return 0;
  const sentAt = Number(raw);
  if (!Number.isFinite(sentAt)) return 0;
  return Math.max(0, Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - sentAt)) / 1000));
}

export function VerifyEmailPage(): JSX.Element {
  const { user, emailVerified, loading, refreshUser, resendVerification, signOut } = useAuth();
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(cooldownSecondsLeft);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Verification happens in an email client or another tab, which tells this
    // one nothing. Polling is what turns it into a redirect without a reload.
    const interval = window.setInterval(() => {
      // A failed poll is not actionable — the next one retries, and a revoked
      // session signs itself out through the provider.
      void refreshUser().catch(() => undefined);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refreshUser]);

  useEffect(() => {
    if (secondsLeft === 0) return;
    const timer = window.setTimeout(() => setSecondsLeft(cooldownSecondsLeft()), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  const handleResend = async (): Promise<void> => {
    setError(null);
    setSending(true);
    try {
      await resendVerification();
      sessionStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      setSecondsLeft(cooldownSecondsLeft());
      setSent(true);
    } catch {
      setError('Could not send the email. Please try again in a moment.');
    } finally {
      setSending(false);
    }
  };

  const handleSignOut = async (): Promise<void> => {
    await signOut();
    navigate('/login', { replace: true });
  };

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

  if (emailVerified) {
    return <Navigate to="/chat" replace />;
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-56px)] px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <BrandMark className="h-8 w-8 mx-auto" />
        <h1 className="text-2xl font-bold text-ink">Verify your email</h1>
        <p className="text-sm text-ink-muted">
          We sent a verification link to <span className="font-medium text-ink">{user.email}</span>.
          Click it and this page will continue on its own.
        </p>
        {sent && <p className="text-sm text-ink-muted">Verification email sent.</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleResend}
          disabled={sending || secondsLeft > 0}
        >
          {secondsLeft > 0
            ? `Resend in ${secondsLeft}s`
            : sending
              ? 'Sending…'
              : 'Resend verification email'}
        </Button>
        <Button variant="ghost" className="w-full" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
