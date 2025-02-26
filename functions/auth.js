export function onRequestGet(context) {
  const env = context.env;
  return Response.redirect(
    `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=repo,user,read:org`,
    302
  );
}
