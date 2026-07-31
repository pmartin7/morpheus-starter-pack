import { useContext } from 'react';
import {
  createUserWithEmailAndPassword,
  getIdTokenResult,
  GoogleAuthProvider,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { requireFirebaseAuth } from '../../lib/firebase.js';
import { AuthContext } from './auth-provider.js';

// Firebase's hosted handler returns the user here rather than to /login: the
// session stays alive through verification, and this page redirects onward as
// soon as the token claim catches up.
function verificationContinueUrl(): string {
  return `${window.location.origin}/verify-email`;
}

// Module scope, not a closure over the hook: the verification page polls this
// from an interval and needs an identity that survives re-renders.
async function refreshUser(): Promise<void> {
  const current = requireFirebaseAuth().currentUser;
  if (!current) return;
  await reload(current);
  const result = await getIdTokenResult(current);
  // reload() moved the account flag but not the cached token, and the API reads
  // the token. Force a refresh across that gap — it also fires
  // onIdTokenChanged, which is what re-derives the claim in AuthProvider.
  if (current.emailVerified && result.claims['email_verified'] !== true) {
    await getIdTokenResult(current, true);
  }
}

async function resendVerification(): Promise<void> {
  const current = requireFirebaseAuth().currentUser;
  if (!current) return;
  await sendEmailVerification(current, { url: verificationContinueUrl() });
}

export function useAuth() {
  const { user, emailVerified, loading } = useContext(AuthContext);

  const signIn = async (email: string, password: string): Promise<void> => {
    await signInWithEmailAndPassword(requireFirebaseAuth(), email, password);
  };

  const signUp = async (email: string, password: string, displayName: string): Promise<void> => {
    const name = displayName.trim();
    if (!name) throw new Error('A display name is required');
    const credential = await createUserWithEmailAndPassword(requireFirebaseAuth(), email, password);
    // The API stores decoded['name'] from the token, which stays null until the
    // profile carries a displayName.
    await updateProfile(credential.user, { displayName: name });
    await sendEmailVerification(credential.user, { url: verificationContinueUrl() });
  };

  // Must be called directly from a click handler — the user gesture is what
  // keeps browsers from blocking the popup.
  const signInWithGoogle = async (): Promise<void> => {
    await signInWithPopup(requireFirebaseAuth(), new GoogleAuthProvider());
  };

  const signOut = (): Promise<void> => firebaseSignOut(requireFirebaseAuth());

  const getToken = async (): Promise<string | null> => {
    if (!user) return null;
    const result = await getIdTokenResult(user);
    // A token minted before verification keeps claiming `email_verified: false`
    // until it expires, and the API guard rejects it however verified the
    // account itself is. Spend a forced refresh rather than send that token.
    if (result.claims['email_verified'] === true) return result.token;
    return user.getIdToken(true);
  };

  return {
    user,
    emailVerified,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    getToken,
    refreshUser,
    resendVerification,
  };
}
