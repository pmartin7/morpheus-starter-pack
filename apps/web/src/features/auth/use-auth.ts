import { useContext } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { requireFirebaseAuth } from '../../lib/firebase.js';
import { AuthContext } from './auth-provider.js';

// Thrown for auth failures Firebase has no code for. Shaped like FirebaseError
// (a `code` property) so callers can map every auth failure the same way.
export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export function useAuth() {
  const { user, loading } = useContext(AuthContext);

  const signIn = async (email: string, password: string): Promise<void> => {
    const auth = requireFirebaseAuth();
    const credential = await signInWithEmailAndPassword(auth, email, password);
    // Google accounts always arrive verified, so this single check covers
    // both providers.
    if (!credential.user.emailVerified) {
      await firebaseSignOut(auth);
      throw new AuthError('email-not-verified', 'Email address is not verified');
    }
  };

  const signUp = async (email: string, password: string): Promise<void> => {
    const auth = requireFirebaseAuth();
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    try {
      // continueUrl brings the user back to /login after they click the
      // verification link on Firebase's hosted page.
      await sendEmailVerification(credential.user, {
        url: `${window.location.origin}/login`,
      });
    } finally {
      // Always sign out: a failed email send must not strand a signed-in
      // unverified user.
      await firebaseSignOut(auth);
    }
  };

  // Must be called directly from a click handler — the user gesture is what
  // keeps browsers from blocking the popup.
  const signInWithGoogle = async (): Promise<void> => {
    await signInWithPopup(requireFirebaseAuth(), new GoogleAuthProvider());
  };

  const signOut = (): Promise<void> => firebaseSignOut(requireFirebaseAuth());

  const getToken = async (): Promise<string | null> => {
    if (!user) return null;
    return user.getIdToken();
  };

  return { user, loading, signIn, signUp, signInWithGoogle, signOut, getToken };
}
