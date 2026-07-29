import { z } from "zod";
import { scrape, search } from "../services/firecrawlService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const scrapeUrl = asyncHandler(async (req, res) => {
  const { url, formats } = z.object({
    url: z.string().url(),
    formats: z.array(z.string()).optional(),
  }).parse(req.body);
  res.json(await scrape(url, formats));
});

export const searchWeb = asyncHandler(async (req, res) => {
  const { query, limit } = z.object({
    query: z.string().min(2),
    limit: z.number().int().min(1).max(20).optional(),
  }).parse(req.body);
  res.json(await search(query, limit));
});