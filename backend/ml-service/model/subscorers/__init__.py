from . import legal, gstin, reputation, domain, jd, consistency, financial, complaints, recruiter

REGISTRY = {
    "legal":       (legal,       "Legal Registration (MCA)", 0.15),
    "gstin":       (gstin,       "GSTIN & Tax",              0.10),
    "reputation":  (reputation,  "Online Reputation",        0.15),
    "domain":      (domain,      "Domain & Recruiter",       0.10),
    "jd":          (jd,          "JD Red-Flag Analysis",     0.15),
    "consistency": (consistency, "Posting Consistency",      0.10),
    "financial":   (financial,   "Financial Health",         0.05),
    "complaints":  (complaints,  "Historical Complaints",    0.10),
    "recruiter":   (recruiter,   "Recruiter Verification",   0.10),
}

SUB_KEYS = list(REGISTRY.keys())
