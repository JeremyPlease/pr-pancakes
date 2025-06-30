export function onRequestGet(context) {
  const env = context.env;

  // Determine redirect URI based on environment
  const isLocal = context.request.url.includes('localhost:8788');
  const redirectUri = isLocal
    ? 'http://localhost:8788/auth-callback'
    : 'https://prpancakes.com/functions/auth-callback';

  return Response.redirect(
    `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=repo,user,read:org&redirect_uri=${encodeURIComponent(redirectUri)}`,
    302
  );
}
