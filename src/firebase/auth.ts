import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { getFirebaseApp } from "@/firebase/client";

export function getFirebaseAuth() {
  const app = getFirebaseApp();
  return app ? getAuth(app) : undefined;
}

export async function loginWithEmail(email: string, password: string) {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase has not been configured");
  return signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithEmail(email: string, password: string) {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase has not been configured");
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function loginWithGoogle() {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase has not been configured");
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export async function loginWithMicrosoft() {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase has not been configured");
  return signInWithPopup(auth, new OAuthProvider("microsoft.com"));
}

export async function logoutFirebase() {
  const auth = getFirebaseAuth();
  if (auth) await signOut(auth);
}

