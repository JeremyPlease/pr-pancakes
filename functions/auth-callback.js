const getCookie = (request, name) => {
  const cookies = request.headers.get('Cookie') || '';
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
};

// One-shot cookie: always cleared by whichever response ends the flow
const CLEAR_STATE_COOKIE = 'oauth_state=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0';

const errorResponse = (message, status) =>
  new Response(message, {
    status,
    headers: { 'Set-Cookie': CLEAR_STATE_COOKIE }
  });

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const env = context.env;
  const isLocal = url.hostname === 'localhost';

  try {
    const code = url.searchParams.get('code');
    if (!code) {
      return errorResponse('Missing authorization code', 400);
    }

    // Verify the state we set when starting the flow (OAuth CSRF protection)
    const returnedState = url.searchParams.get('state');
    const expectedState = getCookie(context.request, 'oauth_state');
    if (!expectedState || returnedState !== expectedState) {
      return errorResponse('Invalid OAuth state. Please try signing in again.', 403);
    }

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

    if (!data.access_token) {
      return errorResponse('Failed to obtain access token', 400);
    }

    // Hand the token to the SPA. In local dev the SPA runs on a different
    // origin (localhost:3000), so localStorage isn't shared and the token
    // rides a query param the app strips immediately; in production the SPA
    // is same-origin, so localStorage set here is all that's needed.
    const callbackHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>PR Pancakes - Authenticating...</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: #0d1117;
          color: #c9d1d9;
        }
        .container { text-align: center; }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(240, 196, 108, 0.2);
          border-radius: 50%;
          border-top: 3px solid #f0c46c;
          animation: spin 1s linear infinite;
          margin: 20px auto;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="spinner"></div>
        <h2>&#x1F95E; Authenticating with GitHub...</h2>
        <p>Redirecting you back to PR Pancakes...</p>
      </div>
      <script>
        (function() {
          const token = ${JSON.stringify(data.access_token)};

          if (window.localStorage) {
            localStorage.setItem('github_token', token);
          }

          const isLocal = ${JSON.stringify(isLocal)};
          const redirectUrl = isLocal
            ? 'http://localhost:3000?token=' + encodeURIComponent(token)
            : ${JSON.stringify(url.origin)};

          setTimeout(() => {
            window.location.href = redirectUrl;
          }, 1000);
        })();
      </script>
    </body>
    </html>
    `;

    return new Response(callbackHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Set-Cookie': CLEAR_STATE_COOKIE
      }
    });
  } catch (error) {
    console.error('Error during OAuth:', error);
    return errorResponse('Authentication failed', 500);
  }
}
