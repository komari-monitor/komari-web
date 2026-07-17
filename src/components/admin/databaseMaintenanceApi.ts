function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function requestAdminData(
  input: RequestInfo | URL,
  fallbackMessage: string,
  init?: RequestInit,
): Promise<unknown> {
  const response = await fetch(input, init);
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new Error(fallbackMessage);
  }

  const message =
    isRecord(payload) && typeof payload.message === "string"
      ? payload.message
      : fallbackMessage;
  if (
    !response.ok ||
    !isRecord(payload) ||
    payload.status !== "success" ||
    !("data" in payload)
  ) {
    throw new Error(message);
  }

  return payload.data;
}
