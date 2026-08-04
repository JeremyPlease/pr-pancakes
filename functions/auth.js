export function onRequestGet(context) {
  const env = context.env;
  const url = new URL(context.request.url);

  // The callback function lives at /auth-callback on whichever origin is
  // serving us (prod or wrangler dev) — Pages mounts functions/ at the root
  const redirectUri = `${url.origin}/auth-callback`;

  // Random state, echoed back by GitHub and verified in the callback so a
  // forged callback URL can't complete the flow (OAuth CSRF protection)
  const stateBytes = new Uint8Array(16);
  crypto.getRandomValues(stateBytes);
  const state = [...stateBytes].map(byte => byte.toString(16).padStart(2, '0')).join('');

  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set('scope', 'repo,user,read:org');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', state);

  // Secure can't be set on plain-http localhost or the cookie is dropped
  const isLocal = url.hostname === 'localhost';
  const stateCookie = [
    `oauth_state=${state}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=600',
    ...(isLocal ? [] : ['Secure'])
  ].join('; ');

  return new Response(null, {
    status: 302,
    headers: {
      'Location': authorizeUrl.toString(),
      'Set-Cookie': stateCookie
    }
  });
}
