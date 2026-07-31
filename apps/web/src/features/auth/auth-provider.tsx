import { createContext, useEffect, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { getIdTokenResult, onIdTokenChanged } from 'firebase/auth';
import { getFirebaseAuth } from '../../lib/firebase.js';

interface AuthContextValue {
  user: FirebaseUser | null;
  emailVerified: boolean;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  emailVerified: false,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      // Firebase not configured: render the logged-out state instead of crashing.
      setLoading(false);
      return;
    }

    let mounted = true;
    let latest = 0;

    // onIdTokenChanged, not onAuthStateChanged: verification is read off the
    // token, so every token refresh has to re-derive it.
    const unsubscribe = onIdTokenChanged(auth, (firebaseUser) => {
      const sequence = ++latest;

      if (!firebaseUser) {
        setUser(null);
        setEmailVerified(false);
        setLoading(false);
        return;
      }

      void (async () => {
        // The API guard authorises on the token's `email_verified` claim, never
        // on the account's own flag: reload() refreshes the flag and leaves the
        // cached token alone, so the two diverge.
        let verified = false;
        try {
          const result = await getIdTokenResult(firebaseUser);
          verified = result.claims['email_verified'] === true;
        } catch {
          verified = false;
        }
        if (!mounted || sequence !== latest) return;
        setUser(firebaseUser);
        setEmailVerified(verified);
        // loading resolves only once the claim has: a route guard that decides
        // before then sends a verified user to the verification page.
        setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, emailVerified, loading }}>{children}</AuthContext.Provider>
  );
}
