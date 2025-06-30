// Super simple rate limiting for your GitHub app

let isCurrentlyRateLimited = false;
let retryAttempts = 0;
let nextRetryTime = null;

// Check if error is rate limit
export const isRateLimit = (error) => {
  return error?.errors?.some(err => err.type === 'RATE_LIMITED') ||
         error?.status === 403 ||
         error?.message?.toLowerCase().includes('rate limit');
};

// Handle rate limit with simple backoff
export const handleRateLimit = (fetchFunction) => {
  if (isCurrentlyRateLimited) return;

  isCurrentlyRateLimited = true;
  retryAttempts++;

  // Wait 30s, then 60s, then 120s
  const delay = Math.min(30000 * retryAttempts, 120000);
  nextRetryTime = Date.now() + delay;

  console.log(`Rate limited. Retrying in ${delay/1000} seconds (attempt ${retryAttempts}/3)`);

  if (retryAttempts <= 3) {
    setTimeout(() => {
      isCurrentlyRateLimited = false;
      nextRetryTime = null;
      fetchFunction(true); // Retry in background
    }, delay);
  } else {
    console.log('Max retries reached');
    isCurrentlyRateLimited = false;
    retryAttempts = 0;
    nextRetryTime = null;
  }
};

// Reset when successful
export const resetRateLimit = () => {
  isCurrentlyRateLimited = false;
  retryAttempts = 0;
  nextRetryTime = null;
};

// Check if currently rate limited
export const isBlocked = () => isCurrentlyRateLimited;

// Get seconds remaining until next retry
export const getSecondsUntilRetry = () => {
  if (!nextRetryTime) return 0;
  const remaining = Math.ceil((nextRetryTime - Date.now()) / 1000);
  return Math.max(0, remaining);
};
