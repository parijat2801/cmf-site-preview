// GitHub OAuth callback for Sveltia CMS. Exchanges the code for a token and
// hands it to the CMS window via the postMessage handshake Sveltia/Decap expect:
// the popup announces "authorizing:github", the opener replies, then we post
// "authorization:github:success:{json}" and the CMS takes over.
export default async function handler(req, res) {
  const { code } = req.query;
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!code || !clientId || !clientSecret) { res.status(400).send('missing code or OAuth env vars'); return; }

  const r = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  const data = await r.json();

  const payload = data.access_token
    ? `authorization:github:success:${JSON.stringify({ token: data.access_token, provider: 'github' })}`
    : `authorization:github:error:${JSON.stringify(data)}`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><html><body><script>
    (function () {
      function receiveMessage() {
        window.opener.postMessage(${JSON.stringify(payload)}, '*');
        window.removeEventListener('message', receiveMessage, false);
      }
      window.addEventListener('message', receiveMessage, false);
      window.opener.postMessage('authorizing:github', '*');
    })();
  </script></body></html>`);
}
