import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthContext } from './auth-provider.js';
import { ProtectedRoute } from './protected-route.js';
import type { ContextType } from 'react';
import type { User } from 'firebase/auth';

type AuthState = ContextType<typeof AuthContext>;

// The guard only reads truthiness off the user, so a two-field fixture beats a
// mock of the Firebase user.
const signedIn = { uid: 'firebase-uid-1', email: 'ada@example.com' } as User;

// Driven through a real router so the assertion is where the user landed, not
// which props Navigate was called with.
function renderProtectedChat(auth: AuthState): void {
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/chat']}>
        <Routes>
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <div>chat page</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>login page</div>} />
          <Route path="/verify-email" element={<div>verify email page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('ProtectedRoute', () => {
  it('renders its children for a signed-in, verified user', () => {
    renderProtectedChat({ user: signedIn, emailVerified: true, loading: false });

    expect(screen.queryByText('chat page')).not.toBeNull();
  });

  it('redirects a signed-out visitor to /login', () => {
    renderProtectedChat({ user: null, emailVerified: false, loading: false });

    expect(screen.queryByText('login page')).not.toBeNull();
    expect(screen.queryByText('chat page')).toBeNull();
  });

  it('redirects a signed-in but unverified user to /verify-email', () => {
    renderProtectedChat({ user: signedIn, emailVerified: false, loading: false });

    // The API guard 401s every request this user makes, so the protected UI
    // would render nothing but errors.
    expect(screen.queryByText('verify email page')).not.toBeNull();
    expect(screen.queryByText('chat page')).toBeNull();
  });

  it('renders neither children nor a redirect while auth is still resolving', () => {
    renderProtectedChat({ user: null, emailVerified: false, loading: true });

    // Deciding before the token claim arrives sends a verified user to the
    // verification page.
    expect(screen.queryByText('chat page')).toBeNull();
    expect(screen.queryByText('login page')).toBeNull();
    expect(screen.queryByText('verify email page')).toBeNull();
  });
});
