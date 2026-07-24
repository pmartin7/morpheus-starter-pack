import { useContext } from 'react';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { requireFirebaseAuth } from '../../lib/firebase.js';
import { AuthContext } from './auth-provider.js';

export function useAuth() {
  const { user, loading } = useContext(AuthContext);

  const signIn = (email: string, password: string) =>
    signInWithEmailAndPassword(requireFirebaseAuth(), email, password);

  const signOut = () => firebaseSignOut(requireFirebaseAuth());

  const getToken = async (): Promise<string | null> => {
    if (!user) return null;
    return user.getIdToken();
  };

  return { user, loading, signIn, signOut, getToken };
}
