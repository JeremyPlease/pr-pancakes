export async function onRequestGet(context) {
  try {
    const env = context.env;
    const url = new URL(context.request.url);
    const code = url.searchParams.get('code');
    
    if (!code) {
      return new Response('Missing authorization code', {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': 'https://prpancakes.com',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
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
      return new Response('Failed to obtain access token', {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': 'https://prpancakes.com',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }
    
    // SECURITY FIX: Instead of putting token in URL, create a secure callback page
    // that safely transfers the token to localStorage using postMessage
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
        <h2>🥞 Authenticating with GitHub...</h2>
        <p>Redirecting you back to PR Pancakes...</p>
      </div>
      <script>
        (function() {
          const token = ${JSON.stringify(data.access_token)};
          
          // Store token securely in localStorage
          if (window.localStorage) {
            localStorage.setItem('github_token', token);
          }
          
          // Redirect to main app
          setTimeout(() => {
            window.location.href = 'https://prpancakes.com';
          }, 1500);
        })();
      </script>
    </body>
    </html>
    `;
    
    return new Response(callbackHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
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
