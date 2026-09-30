import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Copy,
  LockKeyhole,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  Smartphone,
  Ticket as TicketIcon,
} from "lucide-react";
import {
  buildPayment,
  formatDate,
  formatMoney,
  MAX_MESSAGE_LENGTH,
  type Answers,
  type Payment,
  type PublishedEvent,
  type Quantities,
} from "./domain";
import { friendlyError, refreshEvent } from "./events";
import type { FirebaseServices } from "./firebase";
import { ErrorMessage, Modal, Pickle } from "./components";

export default function EventScreen({
  event,
  services,
  demo = false,
}: {
  event: PublishedEvent;
  services: FirebaseServices | null;
  demo?: boolean;
}) {
  const [quantities, setQuantities] = useState<Quantities>({});
  const [answers, setAnswers] = useState<Answers>({});
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoPreview, setDemoPreview] = useState(false);
  const count = event.tickets.reduce(
    (sum, ticket) => sum + (ticket.soldOut ? 0 : (quantities[ticket.id] ?? 0)),
    0,
  );
  const totalOre = event.tickets.reduce(
    (sum, ticket) =>
      sum +
      (ticket.soldOut ? 0 : (quantities[ticket.id] ?? 0)) * ticket.priceOre,
    0,
  );

  useEffect(() => {
    setPayment(null);
    setQuantities((current) =>
      Object.fromEntries(
        event.tickets.map((ticket) => [
          ticket.id,
          ticket.soldOut
            ? 0
            : Math.min(current[ticket.id] ?? 0, ticket.maxPerUser),
        ]),
      ),
    );
  }, [event.revision]);

  function changeQuantity(id: string, delta: number) {
    setQuantities((current) => ({
      ...current,
      [id]: (current[id] ?? 0) + delta,
    }));
    setError("");
    setPayment(null);
  }

  function changeAnswer(
    ticketId: string,
    index: number,
    fieldId: string,
    value: string,
  ) {
    setAnswers((current) => {
      const perTicket = [...(current[ticketId] ?? [])];
      perTicket[index] = { ...perTicket[index], [fieldId]: value };
      return { ...current, [ticketId]: perTicket };
    });
    setPayment(null);
    setError("");
  }

  async function purchase(formEvent: FormEvent) {
    formEvent.preventDefault();
    setError("");
    setBusy(true);
    try {
      const latest = demo
        ? event
        : services
          ? await refreshEvent(services, event.id)
          : null;
      if (!latest)
        throw new Error(
          "Payments are unavailable until Firebase is connected.",
        );
      if (latest.revision !== event.revision)
        throw new Error(
          "The organizer just updated this event. Review the tickets and try again.",
        );
      const result = buildPayment(latest, quantities, answers);
      if (demo) {
        setPayment(result);
        setDemoPreview(true);
        return;
      }
      // Pointer and user-agent together cover desktops, phones, and tablets without relying on width alone.
      const mobile =
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 1 &&
          window.matchMedia("(pointer: coarse)").matches);
      if (mobile) window.location.assign(result.url);
      else setPayment(result);
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  }

  const allSoldOut = event.tickets.every((ticket) => ticket.soldOut);

  return (
    <main className="guest-main">
      {demo && (
        <div className="demo-banner">
          <span>
            <EyeDot /> You’re exploring an example event. Payments are disabled.
          </span>
          <a href="#/create">
            Make your own <ArrowRight size={15} />
          </a>
        </div>
      )}
      <div className="event-cover">
        <div>
          <span className="eyebrow">A PICL GET-TOGETHER</span>
          <p>
            Good things
            <br />
            come together<span>.</span>
          </p>
        </div>
        <div className="event-pickles">
          <Pickle className="event-pickle-one" playful />
          <Pickle className="event-pickle-two" />
          <span className="event-sparkle">✳</span>
          <span className="event-sparkle small">✦</span>
          <span className="event-circle" />
        </div>
        <span className="cover-side-note">
          a little
          <br />
          big dill.
        </span>
      </div>
      <div className="guest-grid">
        <section className="event-story">
          <span className="badge">
            {allSoldOut ? "ALL TICKETS SOLD OUT" : "YOU’RE INVITED"}
          </span>
          <h1>{event.title}</h1>
          <div className="event-meta">
            <span>
              <CalendarDays size={18} />
              {formatDate(event.date)}
              {event.date && <small>Copenhagen time</small>}
            </span>
            {event.location && (
              <span>
                <MapPin size={18} />
                {event.location}
              </span>
            )}
          </div>
          <div className="story-divider" />
          <h2>A little about the event</h2>
          <p className="event-description">{event.description}</p>
          <div className="guest-info">
            <span className="note-icon">✳</span>
            <div>
              <h3>Your payment is your confirmation.</h3>
              <p>
                Pay directly to the organizer’s MobilePay Box. Your ticket
                details go in the payment message. Check-in is handled by the
                organizer — no ticket or email is sent.
              </p>
            </div>
          </div>
          {!demo && (
            <a className="manage-link" href={`#/event/${event.id}/edit`}>
              <LockKeyhole size={14} /> Organizing this event? Edit it here
            </a>
          )}
        </section>
        <form className="checkout-card" onSubmit={purchase}>
          <div className="checkout-heading">
            <span className="section-number">
              <TicketIcon size={19} />
            </span>
            <div>
              <h2>Pick your tickets</h2>
              <p>Good times are just a tap away.</p>
            </div>
          </div>
          <div className="guest-tickets">
            {event.tickets.map((ticket) => (
              <div
                key={ticket.id}
                className={`guest-ticket ${ticket.soldOut ? "ticket-unavailable" : ""}`}
              >
                <div className="guest-ticket-top">
                  <div>
                    <h3>{ticket.name}</h3>
                    <span className="guest-ticket-price">
                      {formatMoney(ticket.priceOre)} <span>/ person</span>
                    </span>
                    <p className="field-helper">
                      Max. {ticket.maxPerUser} per person, per checkout
                    </p>
                  </div>
                  {ticket.soldOut ? (
                    <span className="badge sold-out">Sold out</span>
                  ) : (
                    <div className="quantity-control">
                      <button
                        type="button"
                        aria-label={`Remove one ${ticket.name} ticket`}
                        disabled={!(quantities[ticket.id] ?? 0) || busy}
                        onClick={() => changeQuantity(ticket.id, -1)}
                      >
                        <Minus size={15} />
                      </button>
                      <output aria-label={`${ticket.name} quantity`}>
                        {quantities[ticket.id] ?? 0}
                      </output>
                      <button
                        type="button"
                        aria-label={`Add one ${ticket.name} ticket`}
                        disabled={
                          (quantities[ticket.id] ?? 0) >= ticket.maxPerUser ||
                          busy
                        }
                        onClick={() => changeQuantity(ticket.id, 1)}
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  )}
                </div>
                {!ticket.soldOut &&
                  ticket.fields.length > 0 &&
                  Array.from(
                    { length: quantities[ticket.id] ?? 0 },
                    (_, index) => (
                      <fieldset className="attendee-fields" key={index}>
                        <legend>
                          <span>
                            Guest {String(index + 1).padStart(2, "0")}
                          </span>{" "}
                          · {ticket.name}
                        </legend>
                        {ticket.fields.map((field) => (
                          <label className="field" key={field.id}>
                            {field.label} <span className="required">*</span>
                            <input
                              required
                              type={
                                field.type === "number" ? "text" : field.type
                              }
                              inputMode={
                                field.type === "number" ? "decimal" : undefined
                              }
                              maxLength={80}
                              autoComplete="off"
                              value={
                                answers[ticket.id]?.[index]?.[field.id] ?? ""
                              }
                              onChange={(change) =>
                                changeAnswer(
                                  ticket.id,
                                  index,
                                  field.id,
                                  change.target.value,
                                )
                              }
                              placeholder={
                                field.type === "email"
                                  ? "you@example.com"
                                  : `Guest ${index + 1}’s ${field.label.toLowerCase()}`
                              }
                            />
                          </label>
                        ))}
                      </fieldset>
                    ),
                  )}
              </div>
            ))}
          </div>
          <div className="order-summary">
            <span>
              Total{" "}
              <small>
                {count} {count === 1 ? "ticket" : "tickets"}
              </small>
            </span>
            <strong>{formatMoney(totalOre)}</strong>
          </div>
          <ErrorMessage message={error} />
          <button
            type="submit"
            className="button primary payment-button"
            disabled={!count || busy || allSoldOut}
          >
            {busy
              ? "Checking tickets…"
              : allSoldOut
                ? "All tickets sold out"
                : demo
                  ? "Preview payment"
                  : "Pay with MobilePay"}
            <ArrowRight size={18} />
          </button>
          <p className="checkout-help">
            <ShieldCheck size={14} /> Secure payment in the MobilePay app
          </p>
          <p className="message-limit-note">
            Guest details are sent to the organizer in your payment message (up
            to {MAX_MESSAGE_LENGTH} characters). They aren’t saved on this site.
          </p>
        </form>
      </div>
      {payment && (
        <PaymentDialog
          payment={payment}
          demo={demoPreview}
          onClose={() => {
            setPayment(null);
            setDemoPreview(false);
          }}
        />
      )}
    </main>
  );
}

function EyeDot() {
  return <span className="demo-dot" aria-hidden="true" />;
}

function PaymentDialog({
  payment,
  demo,
  onClose,
}: {
  payment: Payment;
  demo: boolean;
  onClose: () => void;
}) {
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (demo) return;
    let active = true;
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(payment.url, {
          width: 600,
          margin: 4,
          errorCorrectionLevel: "M",
          color: { dark: "#183d2b", light: "#ffffff" },
        }),
      )
      .then((value) => {
        if (active) setQr(value);
      })
      .catch(() => {
        if (active)
          setError(
            "Could not generate the QR code. Open or copy the payment link below.",
          );
      });
    return () => {
      active = false;
    };
  }, [payment.url, demo]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(payment.url);
      setCopied(true);
    } catch {
      setError("Could not copy the link. Use the payment button below.");
    }
  }
  return (
    <Modal
      title={demo ? "A peek at your payment." : "Scan. Pay. See you there."}
      onClose={onClose}
    >
      <p className="modal-subtitle">
        {demo
          ? "This example shows how ticket details appear in MobilePay. No money can be sent."
          : "Open your phone’s camera and scan to pay in MobilePay."}
      </p>
      {!demo && (
        <div className="qr-frame">
          {qr ? (
            <img
              src={qr}
              alt={`QR code to pay ${formatMoney(payment.totalOre)} with MobilePay`}
              width="260"
              height="260"
            />
          ) : (
            <p role="status">Preparing your QR code…</p>
          )}
        </div>
      )}
      <div className="payment-total">
        <strong>{formatMoney(payment.totalOre)}</strong>
        <span>
          {payment.count} {payment.count === 1 ? "ticket" : "tickets"}
        </span>
      </div>
      <div className="message-preview">
        <span>PAYMENT MESSAGE</span>
        <p>{payment.message}</p>
      </div>
      <ErrorMessage message={error} />
      {!demo && (
        <>
          <a className="button primary" href={payment.url}>
            <Smartphone size={17} /> Open MobilePay <ArrowRight size={17} />
          </a>
          <button className="text-button copy-payment" onClick={copy}>
            {copied ? <Check size={15} /> : <Copy size={15} />}{" "}
            {copied ? "Payment link copied" : "Copy payment link"}
          </button>
          <p className="modal-footnote">
            Complete the transfer in MobilePay. Keep the amount and message as
            shown. No ticket or email will be sent.
          </p>
        </>
      )}
    </Modal>
  );
}
