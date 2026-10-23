export function connectionMessage(hostname?: string) {
  const host =
    hostname ?? (typeof window !== "undefined" ? window.location.hostname : "");
  return ["127.0.0.1", "localhost", "[::1]"].includes(host)
    ? "SecondRoute's local server is unavailable. Open Start-SecondRoute.cmd in the project folder, then retry. Loading records and signing in require the server to be running."
    : "The SecondRoute server is unavailable. Please retry when the connection is restored.";
}

export async function requestJSON<T = Record<string, unknown>>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error(connectionMessage());
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The server returned an unreadable response. Restart SecondRoute and retry.",
    );
  }
  if (!response.ok)
    throw new Error(
      data.message ||
        data.error ||
        "The server could not complete this request.",
    );
  return data as T;
}
