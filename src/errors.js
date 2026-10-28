// Structured failure metadata is attached to existing Error subclasses to preserve
// instanceof TypeError/RangeError checks and established human-readable messages.
export function pulseError(ErrorType, code, category, message, cause) {
  const error = cause === undefined ? new ErrorType(message) : new ErrorType(message, { cause });
  error.code = code;
  error.category = category;
  return error;
}

/** Return a plain JSON-safe diagnostic without serializing stack traces or arbitrary causes. */
export function summarizePulseError(error) {
  if (!(error instanceof Error)) {
    return { code: "PULSE_UNKNOWN", category: "unknown", message: "Unknown thrown value.", cause: null };
  }
  const code = typeof error.code === "string" ? error.code : "PULSE_UNKNOWN";
  const category = typeof error.category === "string" ? error.category : "unknown";
  const cause = error.cause instanceof Error
    ? { name: error.cause.name, message: error.cause.message, code: typeof error.cause.code === "string" ? error.cause.code : null }
    : null;
  return { code, category, message: error.message, cause };
}
