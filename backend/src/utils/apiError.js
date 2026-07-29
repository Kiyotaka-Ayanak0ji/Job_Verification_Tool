export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message ?? code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export const badRequest = (code, message, details) => new ApiError(400, code, message, details);
export const unauthorized = (code = "unauthorized", message) => new ApiError(401, code, message);
export const forbidden = (code = "forbidden", message) => new ApiError(403, code, message);
export const notFound = (code = "not_found", message) => new ApiError(404, code, message);
export const conflict = (code, message) => new ApiError(409, code, message);
export const paymentRequired = (code, message, details) => new ApiError(402, code, message, details);
export const apiError = (status, code, message, details) => new ApiError(status, code, message, details);