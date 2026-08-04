const isDevelopment = process.env.NODE_ENV === 'development';

export const initializeAuth = () => {
  if (isDevelopment) {
    console.log('🥞 Local development mode detected');
    console.log('Using local Wrangler functions for OAuth');
  }
};

export const getAuthUrl = () => {
  if (isDevelopment) {
    // For local development with Wrangler
    return 'http://localhost:8788/auth';
  } else {
    // Pages mounts files in functions/ at the site root: functions/auth.js -> /auth
    return '/auth';
  }
};

export const getToken = () => {
  return localStorage.getItem('github_token');
};

export const clearToken = () => {
  localStorage.removeItem('github_token');
};
