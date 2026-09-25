import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Receives loan updates from Zapier (Webhooks by Zapier → POST, JSON payload).
// URL: https://<your-site>.netlify.app/api/ingest?key=<INGEST_KEY>
//
// Expected JSON fields (only loan_number is required; send whatever Arive gives you):
//   loan_number, borrower, status, loan_officer, processor, closer, funder,
//   title_company, closing_date, funding_date, loan_amount, property_state
// Optional: action = "remove"  → deletes the loan from the queue.

const FIELDS = [
  "loan_number",
  "borrower",
  "status",
  "loan_officer",
  "processor",
  "closer",
  "funder",
  "title_company",
  "closing_date",
  "funding_date",
  "loan_amount",
  "property_state",
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const expected = Netlify.env.get("INGEST_KEY");
  const provided = url.searchParams.get("key") || req.headers.get("x-ingest-key");

  if (!expected) return json({ ok: false, error: "INGEST_KEY env var is not set on this site" }, 500);
  if (provided !== expected) return json({ ok: false, error: "unauthorized" }, 401);

  // GET = quick health check so you can confirm the URL + key work in a browser
  if (req.method === "GET") return json({ ok: true, message: "Funding queue ingest is live" });
  if (req.method !== "POST") return json({ ok: false, error: "use POST" }, 405);

  let payload: Record<string, unknown>;
  try {
    const type = req.headers.get("content-type") || "";
    if (type.includes("application/json")) {
      payload = await req.json();
    } else {
      // Zapier "form" payload type fallback
      payload = Object.fromEntries((await req.formData()).entries());
    }
  } catch {
    return json({ ok: false, error: "could not read request body" }, 400);
  }

  const loanNumber = String(payload.loan_number ?? "").trim();
  if (!loanNumber) return json({ ok: false, error: "loan_number is required" }, 400);

  const store = getStore({ name: "funding-queue", consistency: "strong" });
  const key = `loan/${loanNumber.replace(/[^A-Za-z0-9_-]/g, "_")}`;

  if (String(payload.action ?? "").toLowerCase() === "remove") {
    await store.delete(key);
    return json({ ok: true, removed: loanNumber });
  }

  const existing = (await store.get(key, { type: "json" })) || {};
  const record: Record<string, unknown> = { ...existing };
  for (const f of FIELDS) {
    const v = payload[f];
    // Blank values from Zapier don't wipe out data we already have
    if (v !== undefined && v !== null && String(v).trim() !== "") record[f] = String(v).trim();
  }
  record.loan_number = loanNumber;
  record.updated_at = new Date().toISOString();

  await store.setJSON(key, record);
  return json({ ok: true, loan: record });
};

export const config: Config = {
  path: "/api/ingest",
};
