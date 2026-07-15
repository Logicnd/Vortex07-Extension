import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(__dirname, "../../server");

const baseUrl = String(
  process.env.VORTEX07_API_URL || "https://vortex07-extension.vercel.app/api",
).replace(/\/$/, "");

const endpoints = [
  { url: `${baseUrl}/health`, label: "health" },
  {
    url: `${baseUrl}/forum?action=threads&category=general&voterId=vortex07-verify`,
    label: "forum threads",
  },
  {
    url: `${baseUrl}/reputation?userId=1&voterId=vortex07-verify`,
    label: "reputation",
  },
  {
    url: `${baseUrl}/economy?userId=1&voterId=vortex07-verify`,
    label: "economy",
  },
];

async function check({ url, label }) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const ok = res.ok;
    const text = await res.text().catch(() => "");
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* ignore */
    }
    return { label, ok, status: res.status, json };
  } catch (err) {
    return { label, ok: false, error: err.message };
  }
}

async function main() {
  console.log(`\nVerifying Vortex07 API at ${baseUrl}...\n`);
  const results = await Promise.all(endpoints.map(check));
  let failed = 0;
  for (const r of results) {
    const status = r.ok ? "✅" : "❌";
    if (r.error) {
      console.log(`${status} ${r.label}: ${r.error}`);
    } else {
      console.log(`${status} ${r.label}: HTTP ${r.status}`);
      if (r.json && (r.json.error || r.json.message)) {
        console.log(`   ${r.json.error || r.json.message}`);
      }
    }
    if (!r.ok) failed++;
  }
  console.log("");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Verify failed:", err);
  process.exit(1);
});
