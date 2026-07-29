import axios from "axios";
import { env } from "../config/env.js";

// Optional direct Firecrawl access for ad-hoc scrapes from the frontend.
// End-to-end verification goes through the ML service, not this path.
const BASE = "https://api.firecrawl.dev/v1";

function client() {
  if (!env.FIRECRAWL_API_KEY) return null;
  return axios.create({
    baseURL: BASE,
    timeout: 30_000,
    headers: { authorization: `Bearer ${env.FIRECRAWL_API_KEY}` },
  });
}

export async function scrape(url, formats = ["markdown"]) {
  const c = client();
  if (!c) return { error: "firecrawl_not_configured" };
  const { data } = await c.post("/scrape", { url, formats, onlyMainContent: true });
  return data;
}

export async function search(query, limit = 8) {
  const c = client();
  if (!c) return { error: "firecrawl_not_configured" };
  const { data } = await c.post("/search", { query, limit });
  return data;
}