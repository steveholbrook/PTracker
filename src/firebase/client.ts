import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  ReCaptchaEnterpriseProvider,
  initializeAppCheck,
} from "firebase/app-check";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);

let appCheckStarted = false;
let firestoreStarted = false;

export function getFirebaseApp(): FirebaseApp | undefined {
  if (!firebaseConfigured) return undefined;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

  // PTracker domain objects intentionally use optional fields. Firestore rejects
  // JavaScript `undefined` values by default, which can make otherwise valid
  // saves fail (for example when an invoice lock is removed). Configure the
  // client once so optional properties are omitted rather than rejecting the
  // entire write.
  if (!firestoreStarted) {
    initializeFirestore(app, { ignoreUndefinedProperties: true });
    firestoreStarted = true;
  }

  const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
  if (
    typeof window !== "undefined" &&
    siteKey &&
    !appCheckStarted
  ) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    appCheckStarted = true;
  }
  return app;
}
