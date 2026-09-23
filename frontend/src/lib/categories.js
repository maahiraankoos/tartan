export const CATEGORIES = [
  { id: "reconnect", label: "Reconnect", emoji: "🎓", blurb: "Find your people again — school, college, workplace or old crew.", example: "Reconnect the Class of 2010, Lincoln High" },
  { id: "cause", label: "Cause & Awareness", emoji: "📣", blurb: "Rally people behind an idea that matters.", example: "Clean water for every village" },
  { id: "event", label: "Event", emoji: "🎉", blurb: "Spread the word and fill the room.", example: "Garowe Tech Meetup — August" },
  { id: "fundraiser", label: "Fundraiser", emoji: "💛", blurb: "Grow the chain of givers, person to person.", example: "Help rebuild the community library" },
  { id: "brand", label: "Brand & Company", emoji: "🚀", blurb: "Launch a referral wave for your product or brand.", example: "Refer friends to our new app" },
  { id: "challenge", label: "Challenge", emoji: "🔥", blurb: "Start a movement people can't help but pass on.", example: "The 7-day kindness challenge" },
];

export const CATEGORY_MAP = CATEGORIES.reduce((m, c) => { m[c.id] = c; return m; }, {});
