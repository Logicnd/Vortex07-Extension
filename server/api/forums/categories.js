import { kv } from "@vercel/kv";

const CATEGORIES = [
  { id: "general",   label: "General",        description: "General Vortex chat." },
  { id: "places",    label: "Places",          description: "Talk about games and places." },
  { id: "help",      label: "Help & Support",  description: "Need a hand? Ask here." },
  { id: "offtopic",  label: "Off Topic",       description: "Anything goes." },
  { id: "vortex07",  label: "Vortex07",        description: "Extension feedback, bugs and ideas." }
];

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();

  const withCounts = await Promise.all(
    CATEGORIES.map(async (cat) => {
      const count = (await kv.llen(`forum:threads:${cat.id}`)) || 0;
      return { ...cat, threadCount: count };
    })
  );

  return res.status(200).json({ categories: withCounts });
}
