from . import legal, gstin, reputation, domain, jd, consistency, financial, complaints

REGISTRY = {
    "legal":       (legal,       "Legal Registration (MCA)", 0.20),
    "gstin":       (gstin,       "GSTIN & Tax",              0.15),
    "reputation":  (reputation,  "Online Reputation",        0.20),
    "domain":      (domain,      "Domain & Recruiter",       0.10),
    "jd":          (jd,          "JD Red-Flag Analysis",     0.15),
    "consistency": (consistency, "Posting Consistency",      0.10),
    "financial":   (financial,   "Financial Health",         0.05),
    "complaints":  (complaints,  "Historical Complaints",    0.05),
}
