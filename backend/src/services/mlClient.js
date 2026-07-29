import axios from "axios";
import FormData from "form-data";
import { env } from "../config/env.js";

const client = axios.create({
  baseURL: env.FLASK_URL,
  timeout: 60_000,
  headers: env.ML_SERVICE_API_KEY ? { "x-api-key": env.ML_SERVICE_API_KEY } : {},
});

export async function verifyCompany(payload) {
  const { data } = await client.post("/verify-company", payload);
  return data;
}

export async function scoreJob(payload) {
  const { data } = await client.post("/score", payload);
  return data;
}

export async function listModels() {
  const { data } = await client.get("/models");
  return data;
}
export async function bulkCsv(buffer, filename = "upload.csv") {
  const form = new FormData();
  form.append("file", buffer, { filename });
  const { data } = await client.post("/bulk-csv", form, { headers: form.getHeaders() });
  return data;
}
export async function mlHealth() {
  try { const { data } = await client.get("/health"); return { ok: true, ...data }; }
  catch (e) { return { ok: false, error: e.message }; }
}
