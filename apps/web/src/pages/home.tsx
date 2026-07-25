import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/use-auth.js';
import { Button } from '../components/ui/button.js';

export function HomePage(): JSX.Element {
  const { user } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] px-4">
      <div className="max-w-2xl w-full text-center space-y-6">
        <h1 className="text-4xl font-bold text-ink tracking-tight">Your AI-powered app</h1>
        <p className="text-lg text-ink-muted">
          Built with Morpheus — full-stack TypeScript, AI streaming, and a production-ready agent
          OS.
        </p>
        <div className="flex items-center justify-center gap-3">
          {user ? (
            <Link to="/chat">
              <Button size="lg">Open Chat</Button>
            </Link>
          ) : (
            <Link to="/login">
              <Button size="lg">Get started</Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
