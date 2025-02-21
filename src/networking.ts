export const throwingFetch = async (input: string, init?: RequestInit) => {
  const res = await fetch(input, init);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch (${res.status} ${res.statusText}) ${input}`
    );
  }
  return res;
};

export const fetchJson = async <TResponse>(
  input: string,
  init?: RequestInit
) => {
  const res = await throwingFetch(input, init);
  const bodyText = await res.text();
  try {
    const bodyJson = JSON.parse(bodyText) as TResponse;
    return bodyJson;
  } catch {
    throw new Error(`Failed to parse response as JSON ${input}`);
  }
};
