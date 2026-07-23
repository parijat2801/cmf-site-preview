// GitHub OAuth for Sveltia CMS (Decap-compatible flow), as a Vercel function.
// Entry point: the CMS opens /api/oauth; we bounce to GitHub's authorize page.
// Requires env vars GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET (an OAuth App whose
// callback URL is https://<site>/api/callback).
export default function handler(_req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) { res.status(500).send('GITHUB_CLIENT_ID not configured'); return; }
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  // least privilege: public_repo suffices while the repo is public. If the repo
  // is ever made private, set GITHUB_OAUTH_SCOPE=repo,user in Vercel env.
  url.searchParams.set('scope', process.env.GITHUB_OAUTH_SCOPE || 'public_repo,user');
  res.redirect(302, url.toString());
}
