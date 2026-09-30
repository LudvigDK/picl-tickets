import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocFromServer,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { FirebaseServices } from "./firebase";
import { validateEvent, type EventData, type PublishedEvent } from "./domain";
import {
  fromStoredEvent,
  toStoredEvent,
  type StoredEventData,
} from "./storage";

export const editorEmail = (id: string) =>
  `event-${id.toLowerCase()}@events.picl.dk`;

export async function createEvent(
  services: FirebaseServices,
  data: EventData,
  password: string,
): Promise<string> {
  const validated = validateEvent(data);
  if (password.length < 10)
    throw new Error("Use an editing password with at least 10 characters.");
  const ref = doc(collection(services.db, "events"));
  await signOut(services.auth);
  const { user } = await createUserWithEmailAndPassword(
    services.auth,
    editorEmail(ref.id),
    password,
  );
  try {
    await setDoc(ref, {
      ...toStoredEvent(validated),
      ownerUid: user.uid,
      revision: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    // Avoid leaving an unusable editor account when event creation fails.
    await deleteUser(user).catch(() => {});
    throw error;
  }
  return ref.id;
}

export async function unlockEvent(
  services: FirebaseServices,
  id: string,
  password: string,
): Promise<void> {
  await signInWithEmailAndPassword(services.auth, editorEmail(id), password);
}

export const lockEvent = (services: FirebaseServices) => signOut(services.auth);

export async function saveEvent(
  services: FirebaseServices,
  event: PublishedEvent,
  data: EventData,
): Promise<void> {
  const validated = validateEvent(data);
  const ref = doc(services.db, "events", event.id);
  await runTransaction(services.db, async (transaction) => {
    const current = await transaction.get(ref);
    if (!current.exists()) throw new Error("This event no longer exists.");
    if (current.data().revision !== event.revision)
      throw new Error(
        "This event changed in another editor. Reload the page before saving.",
      );
    transaction.update(ref, {
      ...toStoredEvent(validated),
      revision: event.revision + 1,
      updatedAt: serverTimestamp(),
    });
  });
}

export function watchEvent(
  services: FirebaseServices,
  id: string,
  onEvent: (event: PublishedEvent | null) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    doc(services.db, "events", id),
    (snapshot) => {
      if (!snapshot.exists()) {
        onEvent(null);
        return;
      }
      try {
        const raw = snapshot.data();
        onEvent({
          ...fromStoredEvent(raw as StoredEventData),
          id: snapshot.id,
          ownerUid: raw.ownerUid,
          revision: raw.revision,
        });
      } catch {
        onError(
          new Error(
            "This event contains invalid data. Ask the organizer to update it.",
          ),
        );
      }
    },
    onError,
  );
}

export async function refreshEvent(
  services: FirebaseServices,
  id: string,
): Promise<PublishedEvent> {
  const snapshot = await getDocFromServer(doc(services.db, "events", id));
  if (!snapshot.exists()) throw new Error("This event is no longer available.");
  const raw = snapshot.data();
  return {
    ...fromStoredEvent(raw as StoredEventData),
    id,
    ownerUid: raw.ownerUid,
    revision: raw.revision,
  };
}

export function friendlyError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (
    [
      "auth/invalid-credential",
      "auth/wrong-password",
      "auth/user-not-found",
      "auth/invalid-login-credentials",
    ].includes(code ?? "")
  )
    return "That password did not match. Please try again.";
  if (code === "auth/too-many-requests")
    return "Too many attempts. Wait a little before trying again.";
  if (code === "auth/operation-not-allowed")
    return "Enable Email/Password authentication in your Firebase project.";
  if (code === "auth/password-does-not-meet-requirements")
    return "This password does not meet the Firebase project’s password policy. Try a stronger password.";
  if (code === "permission-denied")
    return "Firebase denied access. Check the deployed database rules and your editing session.";
  if (["unavailable", "auth/network-request-failed"].includes(code ?? ""))
    return "Could not connect. Check your internet connection and try again.";
  if (code === "auth/invalid-api-key")
    return "The Firebase API key is invalid. Check your configuration.";
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
