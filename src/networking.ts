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

type RetryConfig = {
  retries: number;
  backoff: number;
};

const defaultRetryConfig: RetryConfig = {
  retries: 3,
  backoff: 2000,
};

export const retry = async <T>(
  promise: () => Promise<T>,
  onRetry?: (currentRetry: number) => void,
  retryConfig: RetryConfig = defaultRetryConfig
) => {
  let currentBackoff = retryConfig.backoff;

  for (let i = 0; i < retryConfig.retries; i++) {
    if (i > 0) {
      onRetry?.(i);
    }
    try {
      return await promise();
    } catch (error) {
      if (i === retryConfig.retries - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, currentBackoff));
      currentBackoff *= 2; // Exponential backoff
    }
  }
  throw new Error("Unreachable");
};
