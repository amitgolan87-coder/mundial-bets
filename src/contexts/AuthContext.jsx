import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { STARTING_POINTS } from '../utils/constants';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (!fbUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const ref = doc(db, 'users', fbUser.uid);
      const profileUnsub = onSnapshot(ref, async (snap) => {
        if (!snap.exists()) {
          // Profile doesn't exist - create as pending (shouldn't normally happen, signUp creates it)
          await setDoc(ref, {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName || fbUser.email.split('@')[0],
            balance: STARTING_POINTS,
            matchPoints: 0,
            livePoints: 0,
            duelPoints: 0,
            isAdmin: false,
            status: 'pending',
            createdAt: serverTimestamp(),
          });
        } else {
          setProfile({ id: snap.id, ...snap.data() });
        }
        setLoading(false);
      });
      return () => profileUnsub();
    });
    return () => unsub();
  }, []);

  const signUp = async (email, password, displayName) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      email: cred.user.email,
      displayName,
      balance: STARTING_POINTS,
      matchPoints: 0,
      livePoints: 0,
      duelPoints: 0,
      isAdmin: false,
      status: 'pending', // <- requires admin approval
      createdAt: serverTimestamp(),
    });
    return cred;
  };

  const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
