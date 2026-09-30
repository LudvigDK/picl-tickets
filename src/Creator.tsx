import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Eye,
  Link2,
  LockKeyhole,
  MapPin,
  Plus,
  ShieldCheck,
  Ticket as TicketIcon,
  Trash2,
} from "lucide-react";
import { createEvent, friendlyError, lockEvent, saveEvent } from "./events";
import type { FirebaseServices } from "./firebase";
import {
  eventUrl,
  formatDate,
  formatMoney,
  makeId,
  MAX_FIELDS,
  MAX_QUANTITY,
  MAX_TICKETS,
  parsePrice,
  type EventData,
  type FieldType,
  type PublishedEvent,
  type TicketField,
} from "./domain";
import { ErrorMessage, Pickle, SectionHeading } from "./components";

interface DraftTicket {
  id: string;
  name: string;
  price: string;
  maxPerUser: number;
  soldOut: boolean;
  fields: TicketField[];
}
const newTicket = (): DraftTicket => ({
  id: makeId(),
  name: "",
  price: "125",
  maxPerUser: 4,
  soldOut: false,
  fields: [],
});

export default function Creator({
  services,
  initial,
  published = false,
}: {
  services: FirebaseServices | null;
  initial?: PublishedEvent;
  published?: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [boxUrl, setBoxUrl] = useState(initial?.boxUrl ?? "");
  const [tickets, setTickets] = useState<DraftTicket[]>(
    () =>
      initial?.tickets.map((ticket) => ({
        ...ticket,
        price: String(ticket.priceOre / 100),
      })) ?? [newTicket()],
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(published);
  const [copied, setCopied] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const baseline = useRef(initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);
  const isEditing = !!initial;

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function updateTicket(id: string, patch: Partial<DraftTicket>) {
    setTickets((current) =>
      current.map((ticket) =>
        ticket.id === id ? { ...ticket, ...patch } : ticket,
      ),
    );
    setDirty(true);
    setSaved(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    if (!services) {
      setError(
        "Connect Firebase before publishing your event. See the setup note above.",
      );
      return;
    }
    try {
      const data: EventData = {
        title,
        description,
        date,
        location,
        boxUrl,
        tickets: tickets.map((ticket) => {
          const { price, ...rest } = ticket;
          return { ...rest, priceOre: parsePrice(price) };
        }),
      };
      if (!isEditing && password !== confirmPassword)
        throw new Error("Your editing passwords do not match.");
      setBusy(true);
      if (baseline.current) {
        await saveEvent(services, baseline.current, data);
        baseline.current = {
          ...baseline.current,
          ...data,
          revision: baseline.current.revision + 1,
        };
        setSaved(true);
        setDirty(false);
      } else {
        const id = await createEvent(services, data, password);
        setDirty(false);
        setPassword("");
        setConfirmPassword("");
        window.location.hash = `/event/${id}/edit?published=1`;
      }
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(edit = false) {
    if (!initial) return;
    try {
      await navigator.clipboard.writeText(eventUrl(initial.id, edit));
      setCopied(edit ? "edit" : "guest");
    } catch {
      setError("Copy the event link manually from the field below.");
    }
  }

  async function lock() {
    if (!services || !initial) return;
    try {
      await lockEvent(services);
      window.location.hash = `/event/${initial.id}`;
    } catch (cause) {
      setError(friendlyError(cause));
    }
  }

  return (
    <main className="creator-main">
      <div className="page-intro">
        <div>
          <div className="eyebrow">
            <span className="tiny-star">✳</span> BRING YOUR PEOPLE TOGETHER
          </div>
          <h1>
            {isEditing
              ? "Keep the good times going."
              : "Make something worth gathering for."}
          </h1>
          <p>
            {isEditing
              ? "Update your event, manage tickets, and share the good news."
              : "Your event. Your people. A simple way to get them together."}
          </p>
        </div>
        <span className="intro-doodle">
          <Pickle playful />
          <span>
            let’s make
            <br />a big dill.
          </span>
        </span>
      </div>
      {!services && (
        <div className="setup-note">
          <ShieldCheck size={21} />
          <div>
            <strong>A quick setup before you go live.</strong>
            <p>
              You can design your event below. To publish and save it, connect
              your Firebase project using <code>.env</code> or{" "}
              <code>public/firebase-config.json</code>. The README has the
              steps.
            </p>
          </div>
        </div>
      )}
      {initial && (
        <div className="share-banner">
          <CheckCircle2 size={24} />
          <div>
            <strong>
              {published
                ? "Your event is live. Spread the word!"
                : "Your event link"}
            </strong>
            <input
              aria-label="Public event link"
              value={eventUrl(initial.id)}
              readOnly
              onFocus={(event) => event.target.select()}
            />
          </div>
          <button
            type="button"
            className="button secondary small"
            onClick={() => copyLink()}
          >
            {copied === "guest" ? <Check size={16} /> : <Copy size={16} />}{" "}
            {copied === "guest" ? "Copied" : "Copy link"}
          </button>
        </div>
      )}
      <div className="creator-grid">
        <form
          ref={formRef}
          onSubmit={submit}
          onChange={() => {
            setDirty(true);
            setSaved(false);
          }}
          className="event-form"
        >
          <section className="form-section">
            <SectionHeading
              number="01"
              title="The main event"
              description="Give your gathering a name and a little personality."
            />
            <label className="field">
              Event title <span className="required">*</span>
              <input
                required
                maxLength={100}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. A very good pickle party"
              />
            </label>
            <label className="field">
              Description <span className="required">*</span>
              <textarea
                required
                maxLength={5000}
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What’s the occasion? Tell your guests what to look forward to."
              />
              <span className="field-helper character-count">
                {description.length.toLocaleString()} / 5,000
              </span>
            </label>
            <div className="field-row">
              <label className="field">
                Date & time <span className="optional">optional</span>
                <input
                  type="datetime-local"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
                <span className="field-helper">Copenhagen time</span>
              </label>
              <label className="field">
                Location <span className="optional">optional</span>
                <input
                  maxLength={120}
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Where are we meeting?"
                />
              </label>
            </div>
          </section>
          <section className="form-section">
            <SectionHeading
              number="02"
              title="A ticket to a good time"
              description="Add your ticket types, prices, and guest details."
            />
            <div className="ticket-editors">
              {tickets.map((ticket, index) => (
                <div
                  key={ticket.id}
                  className={`ticket-editor ${ticket.soldOut ? "is-sold-out" : ""}`}
                >
                  <div className="ticket-editor-heading">
                    <span>
                      <TicketIcon size={17} /> Ticket{" "}
                      {String(index + 1).padStart(2, "0")}{" "}
                      <span className="ticket-id">{ticket.id}</span>
                    </span>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove ticket ${index + 1}`}
                      disabled={tickets.length === 1}
                      onClick={() => {
                        setTickets((current) =>
                          current.filter((item) => item.id !== ticket.id),
                        );
                        setDirty(true);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <label className="field">
                    Ticket name <span className="required">*</span>
                    <input
                      required
                      maxLength={40}
                      value={ticket.name}
                      onChange={(event) =>
                        updateTicket(ticket.id, { name: event.target.value })
                      }
                      placeholder="e.g. General admission"
                    />
                  </label>
                  <div className="field-row">
                    <label className="field">
                      Price <span className="required">*</span>
                      <div className="input-suffix">
                        <input
                          required
                          inputMode="decimal"
                          aria-label={`Price for ticket ${index + 1}`}
                          value={ticket.price}
                          onChange={(event) =>
                            updateTicket(ticket.id, {
                              price: event.target.value,
                            })
                          }
                        />
                        <span>DKK</span>
                      </div>
                    </label>
                    <label className="field">
                      Max. tickets per person{" "}
                      <span className="required">*</span>
                      <select
                        value={ticket.maxPerUser}
                        onChange={(event) =>
                          updateTicket(ticket.id, {
                            maxPerUser: Number(event.target.value),
                          })
                        }
                      >
                        {Array.from({ length: MAX_QUANTITY }, (_, i) => (
                          <option key={i} value={i + 1}>
                            {i + 1} {i ? "tickets" : "ticket"}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className="field-helper limit-note">
                    Limit applies to each checkout. Repeat purchases are handled
                    in MobilePay.
                  </p>
                  <div className="custom-fields-header">
                    <span>Details for each ticket</span>
                    <span className="optional">
                      {ticket.fields.length}/{MAX_FIELDS}
                    </span>
                  </div>
                  {ticket.fields.length === 0 && (
                    <p className="field-helper custom-empty">
                      Need a name for every guest? Add a required field below.
                    </p>
                  )}
                  {ticket.fields.map((field, fieldIndex) => (
                    <div className="custom-field-row" key={field.id}>
                      <label className="sr-only" htmlFor={`field-${field.id}`}>
                        Label for custom field {fieldIndex + 1} of ticket{" "}
                        {index + 1}
                      </label>
                      <input
                        id={`field-${field.id}`}
                        required
                        maxLength={30}
                        value={field.label}
                        placeholder="e.g. Name"
                        onChange={(event) =>
                          updateTicket(ticket.id, {
                            fields: ticket.fields.map((item) =>
                              item.id === field.id
                                ? { ...item, label: event.target.value }
                                : item,
                            ),
                          })
                        }
                      />
                      <label className="sr-only" htmlFor={`type-${field.id}`}>
                        Type for custom field {fieldIndex + 1} of ticket{" "}
                        {index + 1}
                      </label>
                      <select
                        id={`type-${field.id}`}
                        value={field.type}
                        onChange={(event) =>
                          updateTicket(ticket.id, {
                            fields: ticket.fields.map((item) =>
                              item.id === field.id
                                ? {
                                    ...item,
                                    type: event.target.value as FieldType,
                                  }
                                : item,
                            ),
                          })
                        }
                      >
                        <option value="text">Text</option>
                        <option value="email">Email</option>
                        <option value="tel">Phone</option>
                        <option value="number">Number</option>
                      </select>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Remove custom field ${fieldIndex + 1} from ticket ${index + 1}`}
                        onClick={() =>
                          updateTicket(ticket.id, {
                            fields: ticket.fields.filter(
                              (item) => item.id !== field.id,
                            ),
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <div className="ticket-bottom">
                    <button
                      type="button"
                      className="text-button"
                      disabled={ticket.fields.length >= MAX_FIELDS}
                      onClick={() =>
                        updateTicket(ticket.id, {
                          fields: [
                            ...ticket.fields,
                            { id: makeId(), label: "", type: "text" },
                          ],
                        })
                      }
                    >
                      <Plus size={16} /> Add custom field
                    </button>
                    <label className="switch-label">
                      <input
                        type="checkbox"
                        role="switch"
                        checked={ticket.soldOut}
                        onChange={(event) =>
                          updateTicket(ticket.id, {
                            soldOut: event.target.checked,
                          })
                        }
                      />
                      <span className="switch-track" />
                      Sold out
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="button dashed"
              disabled={tickets.length >= MAX_TICKETS}
              onClick={() => {
                setTickets((current) => [...current, newTicket()]);
                setDirty(true);
              }}
            >
              <Plus size={18} /> Add ticket type{" "}
              <span className="optional">
                {tickets.length}/{MAX_TICKETS}
              </span>
            </button>
          </section>
          <section className="form-section">
            <SectionHeading
              number="03"
              title="Payments, kept simple"
              description="Connect your MobilePay Box. We’ll make the payment links."
            />
            <label className="field">
              MobilePay Box share link <span className="required">*</span>
              <div className="input-prefix">
                <Link2 size={17} />
                <input
                  required
                  type="url"
                  value={boxUrl}
                  onChange={(event) => setBoxUrl(event.target.value)}
                  placeholder="https://qr.mobilepay.dk/box/…/pay-in"
                />
              </div>
              <span className="field-helper">
                In MobilePay, open your Box → Share → copy the link.
              </span>
            </label>
            <div className="inline-note">
              <ShieldCheck size={18} />
              <p>
                Payments go directly to your Box. Guest details are included in
                the payment message, once for each ticket.
              </p>
            </div>
            {!isEditing && (
              <div className="password-section">
                <h3>
                  <LockKeyhole size={17} /> Only you hold the keys
                </h3>
                <p>
                  Set a password to edit your event later. Keep it safe —
                  there’s no password reset.
                </p>
                <div className="field-row">
                  <label className="field">
                    Editing password <span className="required">*</span>
                    <div className="password-input">
                      <input
                        required
                        minLength={10}
                        maxLength={128}
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="At least 10 characters"
                      />
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        onClick={() => setShowPassword((current) => !current)}
                      >
                        <Eye size={17} />
                      </button>
                    </div>
                  </label>
                  <label className="field">
                    Repeat password <span className="required">*</span>
                    <input
                      required
                      minLength={10}
                      maxLength={128}
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      placeholder="Once more, just to be sure"
                    />
                  </label>
                </div>
              </div>
            )}
          </section>
          <div className="publish-bar">
            <ErrorMessage message={error} />
            {saved && (
              <p className="success-message" role="status">
                <CheckCircle2 size={18} />{" "}
                {isEditing
                  ? "Changes saved. Your guest page is up to date."
                  : "Event published."}
              </p>
            )}
            <div>
              <p>
                <LockKeyhole size={15} />{" "}
                {isEditing
                  ? "Your changes go live when you save."
                  : "You can edit everything later."}
              </p>
              <button
                type="submit"
                className="button primary"
                disabled={busy || !services}
              >
                {busy
                  ? "Saving…"
                  : isEditing
                    ? "Save changes"
                    : "Publish event"}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </form>
        <aside className="preview-aside">
          <div className="preview-sticky">
            <div className="preview-label">
              <Eye size={16} /> THE GUEST VIEW <span>Live preview</span>
            </div>
            <div className="preview-card">
              <div className="preview-cover">
                <span className="preview-wordmark">
                  picl. <span>events</span>
                </span>
                <div className="pickle-cluster">
                  <Pickle className="pickle-one" />
                  <Pickle className="pickle-two" />
                  <span className="cover-star star-one">✳</span>
                  <span className="cover-star star-two">✦</span>
                  <span className="cover-dot" />
                </div>
                <span className="cover-caption">
                  good things
                  <br />
                  come together.
                </span>
              </div>
              <div className="preview-content">
                <span className="badge">YOU’RE INVITED</span>
                <h2>{title || "Your next good thing."}</h2>
                <div className="preview-meta">
                  <span>
                    <CalendarDays size={15} />
                    {formatDate(date)}
                  </span>
                  <span>
                    <MapPin size={15} />
                    {location || "Somewhere lovely"}
                  </span>
                </div>
                <p className="preview-description">
                  {description ||
                    "Your event story goes here. A little context, a little excitement, and all the details your people need."}
                </p>
                <div className="preview-tickets-heading">
                  <h3>Pick your tickets</h3>
                  <TicketIcon size={17} />
                </div>
                {tickets.map((ticket, index) => (
                  <div className="preview-ticket" key={ticket.id}>
                    <div>
                      <strong>{ticket.name || `Ticket ${index + 1}`}</strong>
                      <span>
                        {ticket.soldOut
                          ? "All snapped up"
                          : `Max. ${ticket.maxPerUser} per person`}
                      </span>
                    </div>
                    <span
                      className={
                        ticket.soldOut ? "badge sold-out" : "preview-price"
                      }
                    >
                      {ticket.soldOut ? "Sold out" : previewPrice(ticket.price)}
                    </span>
                  </div>
                ))}
                <div className="preview-pay">
                  Pay with MobilePay <ArrowRight size={16} />
                </div>
                <p className="preview-disclaimer">
                  No ticket emails. Your payment is your confirmation.
                </p>
              </div>
            </div>
            <div className="preview-footnote">
              <span className="note-icon">✳</span>
              <p>
                A little less admin.
                <br />
                <strong>A little more event.</strong>
              </p>
            </div>
            {initial ? (
              <div className="editor-actions">
                <a className="button secondary" href={`#/event/${initial.id}`}>
                  <Eye size={16} /> View guest page
                </a>
                <button className="text-button" onClick={() => copyLink(true)}>
                  <Copy size={15} />
                  {copied === "edit"
                    ? "Editing link copied"
                    : "Copy editing link"}
                </button>
                <button className="text-button" onClick={lock}>
                  <LockKeyhole size={15} /> Lock editing
                </button>
              </div>
            ) : (
              <a className="preview-example" href="#/demo">
                Explore an example event <ArrowRight size={15} />
              </a>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function previewPrice(price: string) {
  try {
    return formatMoney(parsePrice(price));
  } catch {
    return "— kr.";
  }
}
