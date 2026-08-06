import { api } from "../api/client.js";

// Firecrawl service for the frontend
// Wraps backend firecrawl endpoints for automated evidence gathering

export async function scrapeUrl(url, formats = ["markdown"]) {
  try {
    const { data } = await api.post("/firecrawl/scrape", { url, formats });
    return data;
  } catch (error) {
    console.error("[FirecrawlService] Scrape error:", error.message);
    return { error: error.message, offline: true };
  }
}

export async function searchWeb(query, limit = 8) {
  try {
    const { data } = await api.post("/firecrawl/search", { query, limit });
    return data;
  } catch (error) {
    console.error("[FirecrawlService] Search error:", error.message);
    return { error: error.message, offline: true };
  }
}

// High-level verification enrichment functions
export async function enrichCompany(companyName) {
  const queries = [
    `${companyName} company reviews`,
    `${companyName} glassdoor reviews`,
    `${companyName} reddit reviews`,
    `${companyName} ambitionbox reviews`,
    `${companyName} official website`,
    `${companyName} linkedin company`,
    `${companyName} scam fraud complaint`,
  ];

  const results = {
    company: companyName,
    reputation: [],
    complaints: [],
    officialSite: null,
    linkedin: null,
    sources: [],
  };

  for (const query of queries) {
    try {
      const searchResult = await searchWeb(query, 5);
      if (searchResult.data) {
        for (const item of searchResult.data) {
          results.sources.push({
            query,
            url: item.url,
            title: item.title,
            snippet: item.description || (item.markdown || "").slice(0, 300),
          });

          // Categorize results
          const url = (item.url || "").toLowerCase();
          const text = ((item.title || "") + " " + (item.description || "") + " " + (item.markdown || "")).toLowerCase();

          if (url.includes("glassdoor") || text.includes("glassdoor")) {
            results.reputation.push({ source: "glassdoor", item });
          } else if (url.includes("reddit.com") || text.includes("reddit")) {
            results.reputation.push({ source: "reddit", item });
          } else if (url.includes("ambitionbox.com")) {
            results.reputation.push({ source: "ambitionbox", item });
          } else if (text.includes("scam") || text.includes("fraud") || text.includes("complaint") || text.includes("police")) {
            results.complaints.push({ source: "search", item });
          } else if (!url.includes("linkedin.com") && !url.includes("indeed.com") && !url.includes("naukri.com")) {
            if (!results.officialSite) {
              results.officialSite = item.url;
            }
          }

          if (url.includes("linkedin.com") && !results.linkedin) {
            results.linkedin = item.url;
          }
        }
      }
    } catch (err) {
      console.warn(`[FirecrawlService] Query failed: ${query}`, err.message);
    }
  }

  return results;
}

export async function enrichJobPosting(jobTitle, companyName, sourceUrl) {
  const results = {
    jobTitle,
    company: companyName,
    sourceUrl,
    crossPlatform: [],
    redFlags: [],
    consistencyScore: 0,
    sources: [],
  };

  // Search for the same job on other platforms
  const query = `"${jobTitle}" "${companyName}" job`;
  try {
    const searchResult = await searchWeb(query, 10);
    if (searchResult.data) {
      for (const item of searchResult.data) {
        results.sources.push({
          url: item.url,
          title: item.title,
          snippet: item.description || (item.markdown || "").slice(0, 300),
        });
        results.crossPlatform.push(item);
      }
    }
  } catch (err) {
    console.warn(`[FirecrawlService] Job search failed: ${query}`, err.message);
  }

  // Check for red flags in the original posting
  try {
    const scrapeResult = await scrapeUrl(sourceUrl, ["markdown"]);
    const markdown = scrapeResult.data?.markdown || "";
    results.originalContent = markdown.slice(0, 5000);

    // Red flag detection
    const redFlagKeywords = {
      upfront_fee: ["upfront fee", "training deposit", "processing fee", "registration fee", "security deposit"],
      mlm: ["mlm", "multi-level marketing", "network marketing", "pyramid scheme", "direct selling"],
      wire_transfer: ["wire transfer", "western union", "moneygram", "bitcoin", "crypto payment", "gift card"],
      personal_info: ["ssn", "social security number", "passport scan", "bank account details", "drivers license"],
      vague: ["unlimited earnings", "be your own boss", "work from anywhere", "no experience needed", "get rich quick"],
    };

    const text = markdown.toLowerCase();
    for (const [flag, keywords] of Object.entries(redFlagKeywords)) {
      if (keywords.some(k => text.includes(k))) {
        results.redFlags.push(flag);
      }
    }

    // Consistency: how many other legitimate sources have this job
    const legitSources = results.crossPlatform.filter(item => {
      const url = (item.url || "").toLowerCase();
      return !url.includes("linkedin.com") && !url.includes("indeed.com") && !url.includes("naukri.com") && !url.includes("glassdoor.com");
    }).length;

    results.consistencyScore = Math.min(1.0, legitSources / 3);
  } catch (err) {
    console.warn(`[FirecrawlService] Job scrape failed: ${sourceUrl}`, err.message);
  }

  return results;
}

export async function verifyRecruiterEmail(companyName, recruiterEmail) {
  if (!recruiterEmail || !companyName) return { match: false, risk: "no_data" };

  const emailDomain = recruiterEmail.split("@")[1]?.toLowerCase();
  if (!emailDomain) return { match: false, risk: "invalid_email" };

  try {
    const searchResult = await searchWeb(`${companyName} official email domain`, 8);
    const text = (searchResult.data || []).map(d => (d.title || "") + " " + (d.description || "")).join(" ");
    const domains = [...new Set(text.match(/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])];

    const match = domains.some(d => emailDomain.includes(d) || d.includes(emailDomain));
    return {
      recruiterEmail,
      emailDomain,
      companyDomains: domains.slice(0, 10),
      match,
      risk: match ? "low" : "medium",
    };
  } catch (err) {
    console.warn(`[FirecrawlService] Recruiter verification failed:`, err.message);
    return { match: false, risk: "error", error: err.message };
  }
}

export async function getDomainIntelligence(domain) {
  if (!domain) return { ageDays: 0 };

  try {
    const searchResult = await searchWeb(`whois ${domain} domain age registrar`, 5);
    const text = (searchResult.data || []).map(d => (d.title || "") + " " + (d.description || "")).join(" ").toLowerCase();

    let ageDays = 0;
    const yearMatches = text.match(/(\d+)\s*years?\s*old/g);
    if (yearMatches) {
      ageDays = Math.max(...yearMatches.map(m => parseInt(m) * 365));
    }

    let registrar = null;
    for (const reg of ["godaddy", "namecheap", "cloudflare", "google domains", "amazon", "route53", "aws"]) {
      if (text.includes(reg)) {
        registrar = reg;
        break;
      }
    }

    return { ageDays, registrar };
  } catch (err) {
    console.warn(`[FirecrawlService] Domain intel failed:`, err.message);
    return { ageDays: 0, error: err.message };
  }
}