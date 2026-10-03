import { describe, expect, it } from "vitest";
import {
  buildPayment,
  normalizeBoxUrl,
  parsePrice,
  validateEvent,
  type PublishedEvent,
} from "../src/domain";
import { fromStoredEvent, toStoredEvent } from "../src/storage";

const event: PublishedEvent = {
  id: "aBcD1234567890123456",
  ownerUid: "owner",
  revision: 1,
  title: "Pickle party",
  description: "Come together.",
  date: "",
  location: "",
  boxUrl:
    "https://qr.mobilepay.dk/box/12345678-abcd-1234-abcd-123456789012/pay-in",
  tickets: [
    {
      id: "ENTRY001",
      name: "Entry",
      priceOre: 12550,
      maxPerUser: 2,
      soldOut: false,
      fields: [{ id: "NAME0001", label: "Name", type: "text" }],
    },
  ],
};

describe("pricing", () => {
  it("uses integer øre for both Danish and dot decimals", () => {
    expect(parsePrice("125,50")).toBe(12550);
    expect(parsePrice("0.29")).toBe(29);
    expect(parsePrice("125")).toBe(12500);
    for (const invalid of ["0", "-1", "1.234", "1e3", "NaN", "", "30001"])
      expect(() => parsePrice(invalid)).toThrow();
  });
});

describe("Box URL validation", () => {
  it("removes copied query parameters and fragments", () => {
    expect(normalizeBoxUrl(`${event.boxUrl}/?amount=1&message=old#test`)).toBe(
      event.boxUrl,
    );
  });
  it("rejects legacy, lookalike, non-HTTPS, and credential-bearing links", () => {
    for (const url of [
      "https://mobilepay.dk/box?phone=1234AB",
      event.boxUrl.replace("https:", "http:"),
      event.boxUrl.replace("qr.mobilepay.dk", "qr.mobilepay.dk.example.com"),
      event.boxUrl.replace("https://", "https://me:secret@"),
      event.boxUrl.replace("pay-in", "other"),
    ])
      expect(() => normalizeBoxUrl(url)).toThrow();
  });
});

describe("checkout", () => {
  it("includes a separate answer for each purchased ticket and encodes the exact total", () => {
    const payment = buildPayment(
      event,
      { ENTRY001: 2 },
      { ENTRY001: [{ NAME0001: "Anna & Søren" }, { NAME0001: "Bo" }] },
    );
    const url = new URL(payment.url);
    expect(payment.totalOre).toBe(25100);
    expect(payment.count).toBe(2);
    expect(url.searchParams.get("amount")).toBe("25100");
    expect(url.searchParams.get("message")).toBe(
      "2/Entry|nam=Anna & Søren|nam=Bo",
    );
  });
  it("includes every selected ticket type in one transfer", () => {
    const mixed = {
      ...event,
      tickets: [
        ...event.tickets,
        {
          ...event.tickets[0],
          id: "FOOD0001",
          name: "Food",
          priceOre: 5000,
          fields: [],
        },
      ],
    };
    const payment = buildPayment(
      mixed,
      { ENTRY001: 1, FOOD0001: 2 },
      { ENTRY001: [{ NAME0001: "Anna" }] },
    );
    expect(payment.totalOre).toBe(22550);
    expect(payment.message).toBe("1/Entry|nam=Anna | 2/Food");
  });
  it("uses the requested format with three-character lowercase field labels and no IDs", () => {
    const withPhone: PublishedEvent = {
      ...event,
      tickets: [{
        ...event.tickets[0],
        name: "TicketName",
        fields: [
          { id: "NAME0001", label: "Navn", type: "text" },
          { id: "PHONE001", label: "Telefon", type: "tel" },
          { id: "AGE00001", label: "År", type: "number" },
        ],
      }],
    };
    const payment = buildPayment(withPhone, { ENTRY001: 1 }, {
      ENTRY001: [{ NAME0001: "Anna", PHONE001: "+45 12345678", AGE00001: "25" }],
    });
    expect(payment.message).toBe("1/TicketName|nav=Anna;tel=+45 12345678;år=25");
    expect(new URL(payment.url).searchParams.get("message")).toBe(payment.message);
  });
  it("keeps each guest's fields together when buying several tickets", () => {
    const withPhone: PublishedEvent = {
      ...event,
      tickets: [{
        ...event.tickets[0],
        fields: [
          { id: "NAME0001", label: "Navn", type: "text" },
          { id: "PHONE001", label: "Telefon", type: "tel" },
        ],
      }],
    };
    const payment = buildPayment(withPhone, { ENTRY001: 2 }, {
      ENTRY001: [
        { NAME0001: "Anna", PHONE001: "12345678" },
        { NAME0001: "Bo", PHONE001: "87654321" },
      ],
    });
    expect(payment.message).toBe("2/Entry|nav=Anna;tel=12345678|nav=Bo;tel=87654321");
  });
  it("blocks quantity bypasses, sold-out tickets, and removed ticket types", () => {
    for (const qty of [3, -1, 0.5])
      expect(() => buildPayment(event, { ENTRY001: qty }, {})).toThrow();
    expect(() =>
      buildPayment(
        { ...event, tickets: [{ ...event.tickets[0], soldOut: true }] },
        { ENTRY001: 1 },
        {},
      ),
    ).toThrow("sold out");
    expect(() => buildPayment(event, { REMOVED1: 1 }, {})).toThrow(
      "no longer available",
    );
    expect(() => buildPayment(event, {}, {})).toThrow("Select at least one");
  });
  it("requires all per-ticket answers, including the second ticket", () => {
    expect(() =>
      buildPayment(
        event,
        { ENTRY001: 2 },
        { ENTRY001: [{ NAME0001: "Anna" }] },
      ),
    ).toThrow("ticket 2");
  });
  it("never truncates a long message", () => {
    expect(() =>
      buildPayment(
        event,
        { ENTRY001: 2 },
        {
          ENTRY001: [
            { NAME0001: "A".repeat(75) },
            { NAME0001: "B".repeat(75) },
          ],
        },
      ),
    ).toThrow("No information has been removed");
  });
  it("reserves message delimiters without losing names", () => {
    const payment = buildPayment(
      event,
      { ENTRY001: 1 },
      { ENTRY001: [{ NAME0001: "Anna|Bo;\nTest" }] },
    );
    expect(payment.message).toBe("1/Entry|nam=Anna Bo Test");
  });
});

describe("event validation", () => {
  it("preserves custom-field types and Unicode labels with colons through storage", () => {
    const data = {
      ...event,
      tickets: [
        {
          ...event.tickets[0],
          fields: [
            { id: "NAME0001", label: "Navn: gæst", type: "text" as const },
          ],
        },
      ],
    };
    expect(fromStoredEvent(toStoredEvent(data)).tickets[0].fields).toEqual(
      data.tickets[0].fields,
    );
  });
  it("rejects duplicate IDs and empty custom labels", () => {
    expect(() =>
      validateEvent({
        ...event,
        tickets: [event.tickets[0], event.tickets[0]],
      }),
    ).toThrow("unique");
    expect(() =>
      validateEvent({
        ...event,
        tickets: [
          {
            ...event.tickets[0],
            fields: [{ id: "NAME0001", label: "", type: "text" }],
          },
        ],
      }),
    ).toThrow("label");
  });
});
