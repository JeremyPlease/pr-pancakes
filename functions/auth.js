export function onRequestGet(context) {
  const env = context.env;
  const url = new URL(context.request.url);

  // The callback function lives at /auth-callback on whichever origin is
  // serving us (prod or wrangler dev) — Pages mounts functions/ at the root
  const redirectUri = `${url.origin}/auth-callback`;

  return Response.redirect(
    `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=repo,user,read:org&redirect_uri=${encodeURIComponent(redirectUri)}`,
    302
  );
}
