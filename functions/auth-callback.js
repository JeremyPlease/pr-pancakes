export async function onRequestGet(context) {
  const code = context.params.code;
  const env = context.env;
  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code: code
      })
    });
    const data = await tokenResponse.json();
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `https://prpancakes.com?token=${data.access_token}`,
        'Access-Control-Allow-Origin': 'https://prpancakes.com',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  } catch (error) {
    console.error('Error during OAuth:', error);
    return new Response('Authentication failed', {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': 'https://prpancakes.com',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

}
