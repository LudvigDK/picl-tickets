import type { PublishedEvent } from "./domain";

// Read-only example, never persisted or presented as a published event.
export const demoEvent: PublishedEvent = {
  id: "picklepartyexample",
  ownerUid: "demo",
  revision: 1,
  title: "A very good pickle party.",
  description:
    "Good people, great music, and a little something pickled. Join us for an evening in the courtyard — bring your friends and your best dance moves.\n\nYour ticket includes entry and a welcome drink. Doors open at 18:00. We can’t wait to see you!",
  date: "2026-10-23T18:00",
  location: "The courtyard · Copenhagen",
  boxUrl:
    "https://qr.mobilepay.dk/box/00000000-0000-0000-0000-000000000000/pay-in",
  tickets: [
    {
      id: "GENERAL1",
      name: "General admission",
      priceOre: 12500,
      maxPerUser: 4,
      soldOut: false,
      fields: [{ id: "FULLNAME", label: "Name", type: "text" }],
    },
    {
      id: "EARLY001",
      name: "Early bird",
      priceOre: 9500,
      maxPerUser: 2,
      soldOut: true,
      fields: [{ id: "FULLNAME", label: "Name", type: "text" }],
    },
  ],
};
