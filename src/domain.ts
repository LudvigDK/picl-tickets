export const MAX_TICKETS = 6;
export const MAX_FIELDS = 4;
// Conservative application limit; never silently discard attendee information.
export const MAX_MESSAGE_LENGTH = 140;
export const MAX_QUANTITY = 20;

export type FieldType = "text" | "email" | "tel" | "number";
export interface TicketField {
  id: string;
  label: string;
  type: FieldType;
}
export interface Ticket {
  id: string;
  name: string;
  priceOre: number;
  maxPerUser: number;
  soldOut: boolean;
  fields: TicketField[];
}
export interface EventData {
  title: string;
  description: string;
  date: string;
  location: string;
  boxUrl: string;
  tickets: Ticket[];
}
export interface PublishedEvent extends EventData {
  id: string;
  ownerUid: string;
  revision: number;
}
export type Answers = Record<string, Record<string, string>[]>;
export type Quantities = Record<string, number>;
export interface Payment {
  url: string;
  message: string;
  totalOre: number;
  count: number;
}

export function makeId(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
}

export function parsePrice(value: string): number {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim()))
    throw new Error("Enter a price with up to two decimal places.");
  const [whole, fraction = ""] = value.trim().replace(",", ".").split(".");
  const ore = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(ore) || ore < 1 || ore > 3000000)
    throw new Error("Ticket prices must be between 0.01 and 30,000 kr.");
  return ore;
}

export const formatMoney = (ore: number) =>
  new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: ore % 100 ? 2 : 0,
  }).format(ore / 100);

export function normalizeBoxUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Paste the full Box share link from the MobilePay app.");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "qr.mobilepay.dk" ||
    url.port ||
    url.username ||
    url.password ||
    !/^\/box\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/pay-in\/?$/i.test(
      url.pathname,
    )
  ) {
    throw new Error(
      "Use a MobilePay Box share link: https://qr.mobilepay.dk/box/…/pay-in. A short Box number is not enough.",
    );
  }
  // Start clean so an amount/message copied from the app cannot override this checkout.
  return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
}

export function validateEvent(data: EventData): EventData {
  const cleaned: EventData = {
    ...data,
    title: data.title.trim(),
    description: data.description.trim(),
    location: data.location.trim(),
    boxUrl: normalizeBoxUrl(data.boxUrl),
    tickets: data.tickets.map((ticket) => ({
      ...ticket,
      name: ticket.name.trim(),
      fields: ticket.fields.map((field) => ({
        ...field,
        label: field.label.trim(),
      })),
    })),
  };
  if (!cleaned.title || cleaned.title.length > 100)
    throw new Error("Give your event a title of up to 100 characters.");
  if (!cleaned.description || cleaned.description.length > 5000)
    throw new Error("Add an event description of up to 5,000 characters.");
  if (cleaned.location.length > 120)
    throw new Error("Keep the location under 120 characters.");
  if (cleaned.date && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(cleaned.date))
    throw new Error("Choose a valid event date and time.");
  if (!cleaned.tickets.length || cleaned.tickets.length > MAX_TICKETS)
    throw new Error(`Add between 1 and ${MAX_TICKETS} ticket types.`);
  const ticketIds = new Set<string>();
  for (const ticket of cleaned.tickets) {
    if (!/^[A-Z0-9]{8}$/.test(ticket.id) || ticketIds.has(ticket.id))
      throw new Error("Ticket IDs must be unique.");
    ticketIds.add(ticket.id);
    if (!ticket.name || ticket.name.length > 40)
      throw new Error("Give each ticket a name of up to 40 characters.");
    if (
      !Number.isInteger(ticket.priceOre) ||
      ticket.priceOre < 1 ||
      ticket.priceOre > 3000000
    )
      throw new Error("Enter a valid ticket price.");
    if (
      !Number.isInteger(ticket.maxPerUser) ||
      ticket.maxPerUser < 1 ||
      ticket.maxPerUser > MAX_QUANTITY
    )
      throw new Error(
        `Each ticket limit must be between 1 and ${MAX_QUANTITY}.`,
      );
    if (ticket.fields.length > MAX_FIELDS)
      throw new Error(
        `Each ticket can have up to ${MAX_FIELDS} custom fields.`,
      );
    const fieldIds = new Set<string>();
    for (const field of ticket.fields) {
      if (!/^[A-Z0-9]{8}$/.test(field.id) || fieldIds.has(field.id))
        throw new Error("Custom field IDs must be unique.");
      fieldIds.add(field.id);
      if (!field.label || field.label.length > 30)
        throw new Error(
          "Give each custom field a label of up to 30 characters.",
        );
      if (!["text", "email", "tel", "number"].includes(field.type))
        throw new Error("Choose a valid custom field type.");
    }
  }
  return cleaned;
}

function messageValue(value: string): string {
  // Reserve our delimiters to keep payments legible at check-in.
  return value
    .trim()
    .replace(/[\r\n|;=\[\]]/g, " ")
    .replace(/\s+/g, " ");
}

export function buildPayment(
  event: PublishedEvent,
  quantities: Quantities,
  answers: Answers,
): Payment {
  let totalOre = 0;
  let count = 0;
  const parts: string[] = [];
  for (const [id, quantity] of Object.entries(quantities)) {
    if (quantity && !event.tickets.some((ticket) => ticket.id === id))
      throw new Error("A selected ticket is no longer available.");
  }
  for (const ticket of event.tickets) {
    const quantity = quantities[ticket.id] ?? 0;
    if (
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      quantity > ticket.maxPerUser
    )
      throw new Error(
        `Choose at most ${ticket.maxPerUser} ${ticket.name} tickets.`,
      );
    if (!quantity) continue;
    if (ticket.soldOut)
      throw new Error(
        `${ticket.name} is sold out. Please update your selection.`,
      );
    count += quantity;
    totalOre += ticket.priceOre * quantity;
    let part = `${quantity}/${messageValue(ticket.name)}`;
    for (let i = 0; i < quantity; i++) {
      const fields = ticket.fields.map((field) => {
        const value = answers[ticket.id]?.[i]?.[field.id]?.trim() ?? "";
        if (!value)
          throw new Error(
            `Fill in ${field.label} for ${ticket.name}, ticket ${i + 1}.`,
          );
        if (value.length > 80)
          throw new Error(`Keep ${field.label} under 80 characters.`);
        if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
          throw new Error(`Enter a valid email for ticket ${i + 1}.`);
        if (field.type === "number" && !/^-?\d+(?:[.,]\d+)?$/.test(value))
          throw new Error(`Enter a number for ${field.label}.`);
        const label = [...messageValue(field.label)].slice(0, 3).join("").toLowerCase();
        return `${label}=${messageValue(value)}`;
      });
      if (fields.length) part += `|${fields.join(";")}`;
    }
    parts.push(part);
  }
  if (!count) throw new Error("Select at least one ticket first.");
  if (!Number.isSafeInteger(totalOre) || totalOre < 1 || totalOre > 3000000)
    throw new Error("This checkout must total between 0.01 and 30,000 kr.");
  const message = parts.join(" | ");
  if ([...message].length > MAX_MESSAGE_LENGTH)
    throw new Error(
      `Your payment message is ${[...message].length} characters. Keep it within ${MAX_MESSAGE_LENGTH} by shortening answers or buying fewer tickets at once. No information has been removed.`,
    );
  const url = new URL(normalizeBoxUrl(event.boxUrl));
  url.searchParams.set("amount", String(totalOre));
  url.searchParams.set("message", message);
  return { url: url.toString(), message, totalOre, count };
}

export function eventUrl(id: string, edit = false): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = `/event/${encodeURIComponent(id)}${edit ? "/edit" : ""}`;
  return url.toString();
}

export function formatDate(value: string): string {
  if (!value) return "Date to be announced";
  // Event times are entered and displayed as Copenhagen local time, not buyer-local time.
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  return `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)))} · ${time}`;
}
