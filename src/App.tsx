import { useEffect, useState, type FormEvent } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import Creator from "./Creator";
import EventScreen from "./EventScreen";
import { ErrorMessage, Footer, Header, Pickle } from "./components";
import { firebaseReady, type FirebaseServices } from "./firebase";
import { friendlyError, unlockEvent, watchEvent } from "./events";
import type { PublishedEvent } from "./domain";
import { demoEvent } from "./demo";

function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash || "#/create");
  useEffect(() => {
    const change = () => {
      setHash(window.location.hash || "#/create");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  return hash.slice(1);
}

export default function App() {
  const route = useRoute();
  const [services, setServices] = useState<FirebaseServices | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let active = true;
    firebaseReady
      .then((value) => {
        if (!active) return;
        setServices(value);
        setInitialized(true);
        if (value) unsubscribe = onAuthStateChanged(value.auth, setUser);
      })
      .catch((error) => {
        if (active) {
          setSetupError(friendlyError(error));
          setInitialized(true);
        }
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);
  const eventMatch = route.match(
    /^\/event\/([a-zA-Z0-9]{20})(\/edit)?(?:\?published=1)?$/,
  );
  const isCreate = route === "/create" || route === "/" || route === "";
  useEffect(() => {
    document.title = isCreate
      ? "Create an event · Picl Events"
      : "Picl Events · Good things come together";
  }, [isCreate]);

  return (
    <>
      <Header active={isCreate ? "create" : "event"} />
      {setupError && (
        <div className="global-error">
          <ErrorMessage message={`Firebase setup: ${setupError}`} />
        </div>
      )}
      {isCreate ? (
        <Creator key="new" services={services} />
      ) : route === "/demo" ? (
        <EventScreen key="demo" event={demoEvent} services={null} demo />
      ) : eventMatch ? (
        <EventRoute
          key={eventMatch[1]}
          id={eventMatch[1]}
          editing={!!eventMatch[2]}
          published={route.endsWith("?published=1")}
          services={services}
          initialized={initialized}
          user={user}
        />
      ) : (
        <StateScreen
          title="This link took a wrong turn."
          description="The event address doesn’t look right. Check your link or create something new."
        />
      )}
      <Footer />
    </>
  );
}

function EventRoute({
  id,
  editing,
  published,
  services,
  initialized,
  user,
}: {
  id: string;
  editing: boolean;
  published: boolean;
  services: FirebaseServices | null;
  initialized: boolean;
  user: User | null;
}) {
  const [event, setEvent] = useState<PublishedEvent | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!services) return;
    return watchEvent(
      services,
      id,
      (value) => {
        setEvent(value);
        setLoaded(true);
      },
      (cause) => {
        setError(friendlyError(cause));
        setLoaded(true);
      },
    );
  }, [id, services]);
  useEffect(() => {
    if (event) document.title = `${event.title} · Picl Events`;
  }, [event?.title]);
  if (!initialized || (services && !loaded))
    return (
      <StateScreen
        title="Getting the good things ready…"
        description="Loading your event."
        loading
      />
    );
  if (!services)
    return (
      <StateScreen
        title="One little setup step."
        description="Connect the Firebase project to load and save events. Follow the README in this project to configure Firebase."
      />
    );
  if (error)
    return (
      <StateScreen
        title="We couldn’t load this event."
        description={error}
        retry
      />
    );
  if (!event)
    return (
      <StateScreen
        title="This event isn’t here."
        description="The link might be incomplete, or the event is no longer available. Check the link with your organizer."
      />
    );
  if (editing) {
    if (user?.uid !== event.ownerUid)
      return <Unlock services={services} event={event} />;
    return (
      <Creator
        key={`${event.id}-editor`}
        services={services}
        initial={event}
        published={published}
      />
    );
  }
  return <EventScreen key={event.id} event={event} services={services} />;
}

function Unlock({
  services,
  event,
}: {
  services: FirebaseServices;
  event: PublishedEvent;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function unlock(formEvent: FormEvent) {
    formEvent.preventDefault();
    setBusy(true);
    setError("");
    try {
      await unlockEvent(services, event.id, password);
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="unlock-main">
      <a className="text-button" href={`#/event/${event.id}`}>
        <ArrowLeft size={16} /> Back to the event
      </a>
      <div className="unlock-card">
        <span className="unlock-icon">
          <LockKeyhole size={27} />
        </span>
        <span className="eyebrow">FOR THE ORGANIZER</span>
        <h1>You hold the keys.</h1>
        <p>
          Enter the editing password for <strong>{event.title}</strong>.
        </p>
        <form onSubmit={unlock}>
          <label className="field">
            Editing password
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(change) => setPassword(change.target.value)}
              autoFocus
              placeholder="Your event’s password"
            />
          </label>
          <ErrorMessage message={error} />
          <button className="button primary" disabled={busy}>
            {busy ? "Unlocking…" : "Unlock event"}
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="field-helper">
          Use the password chosen when this event was created.
        </p>
      </div>
    </main>
  );
}

function StateScreen({
  title,
  description,
  loading = false,
  retry = false,
}: {
  title: string;
  description: string;
  loading?: boolean;
  retry?: boolean;
}) {
  return (
    <main className="state-screen">
      <Pickle playful />
      <h1>{title}</h1>
      <p role={loading ? "status" : undefined}>{description}</p>
      {!loading && (
        <div>
          {retry && (
            <button
              className="button primary"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          )}
          <a className="button secondary" href="#/create">
            Create an event <ArrowRight size={17} />
          </a>
        </div>
      )}
    </main>
  );
}
