import {
  validateEvent,
  type EventData,
  type FieldType,
  type Ticket,
} from "./domain";

type StoredTicket = Omit<Ticket, "fields"> & { fields: string[] };
export type StoredEventData = Omit<EventData, "tickets"> & {
  tickets: StoredTicket[];
};

// Compact definitions let Firestore validate all 24 fields within its 1,000-expression budget.
// A label may include colons; only the first two separators are structural.
export function toStoredEvent(data: EventData): StoredEventData {
  return {
    ...data,
    tickets: data.tickets.map((ticket) => ({
      ...ticket,
      fields: ticket.fields.map(
        (field) => `${field.id}:${field.type}:${field.label}`,
      ),
    })),
  };
}

export function fromStoredEvent(data: StoredEventData): EventData {
  return validateEvent({
    ...data,
    tickets: data.tickets.map((ticket) => ({
      ...ticket,
      fields: ticket.fields.map((value) => {
        const match =
          typeof value === "string"
            ? value.match(/^([A-Z0-9]{8}):(text|email|tel|number):(.{1,30})$/)
            : null;
        if (!match) throw new Error("Invalid custom field definition.");
        return { id: match[1], type: match[2] as FieldType, label: match[3] };
      }),
    })),
  });
}
