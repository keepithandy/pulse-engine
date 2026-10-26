// Unsupported async work may still finish after its synchronous caller rejects it.
export function synchronousResult(response, message) {
  if (response && typeof response.then === "function") {
    // Observe late failures without accepting the Promise as an engine result.
    Promise.resolve(response).catch(() => {});
    throw new TypeError(message);
  }
  return response;
}
