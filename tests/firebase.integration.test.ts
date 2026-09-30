import { afterAll, describe, expect, it } from "vitest";
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signOut } from "firebase/auth";
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDocFromServer,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  setLogLevel,
  terminate,
  updateDoc,
} from "firebase/firestore";
import {
  createEvent,
  editorEmail,
  saveEvent,
  unlockEvent,
} from "../src/events";
import type { EventData, PublishedEvent } from "../src/domain";
import { fromStoredEvent, toStoredEvent } from "../src/storage";

const enabled = process.env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8080";
describe.skipIf(!enabled)(
  "Firebase editing and rules (local emulators only)",
  () => {
    const app = initializeApp(
      {
        apiKey: "demo-key",
        authDomain: "demo-picl-events.firebaseapp.com",
        projectId: "demo-picl-events",
        appId: "demo-app",
      },
      "integration",
    );
    const auth = getAuth(app);
    const db = getFirestore(app);
    if (enabled) {
      setLogLevel("silent");
      connectAuthEmulator(auth, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
    }
    afterAll(async () => {
      await terminate(db);
      await deleteApp(app);
    });
    const data: EventData = {
      title: "Integration party",
      description: "Test event.",
      date: "",
      location: "",
      boxUrl:
        "https://qr.mobilepay.dk/box/12345678-abcd-1234-abcd-123456789012/pay-in",
      tickets: [
        {
          id: "ENTRY001",
          name: "Entry",
          priceOre: 12500,
          maxPerUser: 2,
          soldOut: false,
          fields: [{ id: "NAME0001", label: "Name", type: "text" }],
        },
      ],
    };
    let saved: PublishedEvent;

    it("creates an event with its own authenticated owner and no password in the document", async () => {
      const id = await createEvent({ auth, db }, data, "test-password-long");
      const snapshot = await getDocFromServer(doc(db, "events", id));
      const raw = snapshot.data()!;
      expect(raw.ownerUid).toBe(auth.currentUser!.uid);
      expect(auth.currentUser!.email).toBe(editorEmail(id));
      expect(raw).not.toHaveProperty("password");
      expect(raw.revision).toBe(1);
      saved = {
        ...fromStoredEvent(raw as any),
        ownerUid: raw.ownerUid,
        revision: raw.revision,
        id,
      };
    });

    it("allows public direct reads but rejects public edits and listing", async () => {
      await signOut(auth);
      expect(
        (await getDocFromServer(doc(db, "events", saved.id))).exists(),
      ).toBe(true);
      await expect(
        updateDoc(doc(db, "events", saved.id), { title: "Hijacked" }),
      ).rejects.toMatchObject({ code: "permission-denied" });
      await expect(getDocs(collection(db, "events"))).rejects.toMatchObject({
        code: "permission-denied",
      });
    });

    it("rejects the wrong password and unlocks with the original password", async () => {
      await expect(
        unlockEvent({ auth, db }, saved.id, "wrong-password"),
      ).rejects.toBeTruthy();
      await unlockEvent({ auth, db }, saved.id, "test-password-long");
      expect(auth.currentUser!.uid).toBe(saved.ownerUid);
    });

    it("persists sold-out updates and rejects stale editing revisions", async () => {
      await saveEvent({ auth, db }, saved, {
        ...data,
        tickets: [{ ...data.tickets[0], soldOut: true }],
      });
      const snapshot = await getDocFromServer(doc(db, "events", saved.id));
      expect(snapshot.data()!.tickets[0].soldOut).toBe(true);
      expect(snapshot.data()!.revision).toBe(2);
      await expect(saveEvent({ auth, db }, saved, data)).rejects.toThrow(
        "another editor",
      );
      const raw = snapshot.data()!;
      saved = {
        ...fromStoredEvent(raw as any),
        ownerUid: raw.ownerUid,
        revision: raw.revision,
        id: saved.id,
      };
    });

    it("denies changing ownership, negative prices, and invalid nested fields", async () => {
      const ref = doc(db, "events", saved.id);
      const version = {
        revision: saved.revision + 1,
        updatedAt: serverTimestamp(),
      };
      await expect(
        updateDoc(ref, { ...version, ownerUid: "intruder" }),
      ).rejects.toMatchObject({ code: "permission-denied" });
      await expect(
        updateDoc(ref, {
          ...version,
          tickets: [{ ...toStoredEvent(data).tickets[0], priceOre: -1 }],
        }),
      ).rejects.toMatchObject({ code: "permission-denied" });
      await expect(
        updateDoc(ref, {
          ...version,
          tickets: [
            { ...toStoredEvent(data).tickets[0], fields: ["NAME0001:text:"] },
          ],
        }),
      ).rejects.toMatchObject({ code: "permission-denied" });
    });

    it("does not let another event’s password edit this event", async () => {
      const id = await createEvent({ auth, db }, data, "second-event-password");
      console.info(`Guest checkout emulator event: /#/event/${id}`);
      await expect(
        updateDoc(doc(db, "events", saved.id), {
          title: "Wrong owner",
          revision: saved.revision + 1,
          updatedAt: serverTimestamp(),
        }),
      ).rejects.toMatchObject({ code: "permission-denied" });
      await expect(
        setDoc(doc(db, "events", "ABCDEFGH123456789012"), {
          ...toStoredEvent(data),
          ownerUid: auth.currentUser!.uid,
          revision: 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ).rejects.toMatchObject({ code: "permission-denied" });
    });

    it("supports the full six-ticket, four-field schema within the rules evaluation budget", async () => {
      const full = {
        ...data,
        tickets: Array.from({ length: 6 }, (_, index) => ({
          ...data.tickets[0],
          id: `TICKET0${index}`,
          fields: Array.from({ length: 4 }, (_, field) => ({
            id: `FIELD00${field}`,
            label: `Field ${field}`,
            type: "text" as const,
          })),
        })),
      };
      const id = await createEvent({ auth, db }, full, "max-schema-password");
      const raw = (await getDocFromServer(doc(db, "events", id))).data()!;
      expect(raw.tickets).toHaveLength(6);
      const maxEvent = {
        ...fromStoredEvent(raw as any),
        ownerUid: raw.ownerUid,
        revision: raw.revision,
        id,
      };
      await saveEvent({ auth, db }, maxEvent, {
        ...full,
        title: "Updated maximum event",
      });
      expect(
        (await getDocFromServer(doc(db, "events", id))).data()!.revision,
      ).toBe(2);
      console.info(`Maximum-schema emulator event: /#/event/${id}`);
    });
  },
);
