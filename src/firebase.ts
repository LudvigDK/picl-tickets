import { initializeApp, type FirebaseOptions } from "firebase/app";
import {
  browserSessionPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

export interface FirebaseServices {
  auth: Auth;
  db: Firestore;
}

export async function initializeFirebase(): Promise<FirebaseServices | null> {
  let config: FirebaseOptions = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  };
  if (
    !config.apiKey ||
    !config.projectId ||
    !config.appId ||
    !config.authDomain
  ) {
    // Optional runtime config lets GitHub Pages work without injecting build variables.
    const response = await fetch(
      `${import.meta.env.BASE_URL}firebase-config.json`,
    );
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("application/json")
    )
      return null;
    config = await response.json();
    if (
      !config.apiKey ||
      !config.projectId ||
      !config.appId ||
      !config.authDomain
    )
      return null;
  }
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (
    import.meta.env.DEV &&
    import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true"
  ) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  await setPersistence(auth, browserSessionPersistence);
  await auth.authStateReady();
  return { auth, db };
}

// StrictMode and multiple consumers must share a single initialization.
export const firebaseReady = initializeFirebase();
