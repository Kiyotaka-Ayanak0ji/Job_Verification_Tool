import { z } from "zod";
import { badRequest, formatZodError } from "../utils/apiError.js";

/**
 * Validation middleware factory using Zod schemas.
 * Supports validating body, query, params, or headers.
 *
 * @param {Object} schemas - Object with keys: body, query, params, headers (each a Zod schema)
 * @param {Object} options - Options: stripUnknown (default true), returnRaw (default false)
 * @returns Express middleware function
 */
export function validate(schemas, options = {}) {
  const { stripUnknown = true, returnRaw = false } = options;

  return (req, _res, next) => {
    const errors = {};
    const validated = {};

    // Validate each source
    const sources = ["body", "query", "params", "headers"];
    for (const source of sources) {
      const schema = schemas[source];
      if (!schema) continue;

      try {
        const data = req[source] || {};
        const parsed = schema.parse(data);

        if (stripUnknown) {
          validated[source] = parsed;
        } else {
          // Merge validated data back, preserving unknown fields
          validated[source] = { ...data, ...parsed };
        }
      } catch (err) {
        if (err instanceof z.ZodError) {
          errors[source] = formatZodError(err);
        } else {
          errors[source] = { _errors: [err.message] };
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      throw badRequest("validation_error", "Invalid request data", errors);
    }

    // Replace request data with validated data
    for (const [source, data] of Object.entries(validated)) {
      req[source] = data;
    }

    // Also attach combined validated data for convenience
    if (returnRaw) {
      req.validated = validated;
    }

    next();
  };
}

/**
 * Shorthand for validating just the body
 */
export function validateBody(schema, options = {}) {
  return validate({ body: schema }, options);
}

/**
 * Shorthand for validating query params
 */
export function validateQuery(schema, options = {}) {
  return validate({ query: schema }, options);
}

/**
 * Shorthand for validating URL params
 */
export function validateParams(schema, options = {}) {
  return validate({ params: schema }, options);
}

/**
 * Shorthand for validating headers
 */
export function validateHeaders(schema, options = {}) {
  return validate({ headers: schema }, options);
}

/**
 * Combined validation for body + query + params
 */
export function validateAll(schema, options = {}) {
  return validate(schema, options);
}

// Common reusable schemas
export const commonSchemas = {
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    sort: z.string().optional(),
    order: z.enum(["asc", "desc"]).default("desc"),
  }),

  // ID parameter
  idParam: z.object({
    id: z.string().min(1),
  }),

  // MongoDB ObjectId
  objectIdParam: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId"),
  }),

  // Date range
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),

  // Search
  search: z.object({
    q: z.string().min(1).max(200).optional(),
  }),
};

// Validation helpers for specific routes
export const routeValidations = {
  // Auth
  signup: validateBody(z.object({
    name: z.string().min(2).max(80),
    email: z.string().email(),
    password: z.string().min(8).max(200),
  })),

  login: validateBody(z.object({
    email: z.string().email(),
    password: z.string(),
  })),

  changePassword: validateBody(z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(8).max(200),
  })),

  updateProfile: validateBody(z.object({
    name: z.string().min(2).max(80).optional(),
    avatarUrl: z.string().url().optional(),
  })),

  // Reports
  listReports: validateQuery(z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    q: z.string().max(200).optional(),
    band: z.enum(["high", "likely", "caution", "risk"]).optional(),
    groupId: z.string().optional(),
  })),

  // Verification
  verifyCompany: validateBody(z.object({
    input: z.string().min(2).max(500),
    deepThink: z.boolean().optional().default(false),
    groupId: z.string().optional().nullable(),
    model: z.string().optional().nullable(),
  })),

  // Groups
  createGroup: validateBody(z.object({
    name: z.string().min(1).max(100),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  })),

  renameGroup: validateBody(z.object({
    name: z.string().min(1).max(100),
  })).combine(validateParams(commonSchemas.objectIdParam)),

  // Billing
  startCheckout: validateBody(z.object({
    provider: z.enum(["razorpay"]),
    interval: z.enum(["monthly", "yearly"]).default("monthly"),
  })),

  verifyRazorpay: validateBody(z.object({
    razorpay_payment_id: z.string().min(1),
    razorpay_subscription_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
  })),

  // Feedback
  submitFeedback: validateBody(z.object({
    verificationId: z.string().min(6),
    accurate: z.boolean(),
    tags: z.array(z.string().max(40)).max(6).optional(),
    comment: z.string().max(2000).optional(),
    userRating: z.number().int().min(1).max(5).optional(),
    userReview: z.enum(["positive", "moderate", "negative"]).optional(),
  })),

  // Admin
  updateUser: validateBody(z.object({
    role: z.enum(["user", "admin"]).optional(),
    plan: z.enum(["free", "pro_monthly", "pro_yearly"]).optional(),
    suspended: z.boolean().optional(),
  })).combine(validateParams(commonSchemas.objectIdParam)),

  listUsers: validateQuery(z.object({
    q: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(500).default(50),
    role: z.enum(["user", "admin"]).optional(),
    plan: z.enum(["free", "pro_monthly", "pro_yearly"]).optional(),
  })),

  // ML Admin
  mlSettings: validateBody(z.object({
    weights: z.object({
      legal: z.number().min(0).max(1).optional(),
      gstin: z.number().min(0).max(1).optional(),
      reputation: z.number().min(0).max(1).optional(),
      domain: z.number().min(0).max(1).optional(),
      jd: z.number().min(0).max(1).optional(),
      consistency: z.number().min(0).max(1).optional(),
      financial: z.number().min(0).max(1).optional(),
      complaints: z.number().min(0).max(1).optional(),
      recruiter: z.number().min(0).max(1).optional(),
    }).optional(),
    thresholds: z.object({
      high: z.number().min(0).max(100).optional(),
      likely: z.number().min(0).max(100).optional(),
      caution: z.number().min(0).max(100).optional(),
    }).optional(),
  })),

  retrain: validateBody(z.object({
    bump: z.enum(["patch", "minor", "major"]).optional(),
    since: z.string().datetime().optional(),
    feedbackIds: z.array(z.string()).optional(),
  })),

  rescoreSample: validateBody(z.object({
    verificationIds: z.array(z.string()).min(1),
  })),

  toggleFeedbackInclude: validateBody(z.object({
    include: z.boolean(),
  })).combine(validateParams(commonSchemas.objectIdParam)),

  // Bulk
  startBulkJob: validateBody(z.object({
    urls: z.array(z.string().url()).min(1).max(100),
  })),

  // Firecrawl
  firecrawlScrape: validateBody(z.object({
    url: z.string().url(),
    formats: z.array(z.enum(["markdown", "html", "links", "screenshot"])).optional(),
  })),

  firecrawlSearch: validateBody(z.object({
    query: z.string().min(1).max(500),
    limit: z.coerce.number().int().min(1).max(20).default(8),
  })),
};