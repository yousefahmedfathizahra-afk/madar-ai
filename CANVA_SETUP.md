# MADAR AI × Canva (developer-preview integration)

This optional integration enables **individual MADAR visitors** to connect their own Canva accounts and generate images through Canva AI. It is distinct from the user's ChatGPT–Canva plugin connection.

## Canva owner action (required, not something the ChatGPT Canva connector can do)

1. In [Canva Developers](https://www.canva.com/developers/), create a Canva Connect integration and select **Outside Canva**.
2. Set the OAuth redirect URL exactly to:
   `https://madar-ai-yousef.vercel.app/api/canva/callback`
3. Enable the minimal **asset:write** OAuth scope, needed by the image-generation API.
4. Generate the Canva **Client ID** and **Client Secret**.
5. In the Vercel **madar-ai-yousef** project, set these as **encrypted Production environment variables** `CANVA_CLIENT_ID` and `CANVA_CLIENT_SECRET`. Never post them in chat or commit them to GitHub.
6. A 32+ character `CANVA_COOKIE_SECRET` must also be configured server-side for encrypted per-user OAuth cookies.
7. Redeploy. A user then types **اربط Canva** or **اربط كانفا** in MADAR's chat, authorizes Canva, and creates pictures via their *own* Canva AI credits.

The preview API **cannot be published to all Canva users via a public approved app** as of October 2026; use it for authorized testing only until Canva changes that status.

## Routes

- `GET /api/canva/session` — safe connection status (no secrets).
- `GET /api/canva/start` — OAuth 2.0 authorization-code + PKCE + state.
- `GET /api/canva/callback` — redeems code server-side; stores encrypted per-user refresh token in secure, httpOnly, SameSite cookie.
- `POST /api/canva/image` — starts an authorized image-generation job with an explicit visitor request.
- `GET /api/canva/image?job=...` — polls image-generation result.

When Canva isn't connected or configured, MADAR retains its existing Puter image workflow. No owner Canva account or credits are ever shared with other visitors.

## Implementation constraints

The preview image-generation API consumes the authorized **user's AI credits**, can fail if quota/capability is unavailable, and returns temporary image URLs valid for 24 hours. No permanent image storage is promised. Developer authorization is separate from the chat plugin. Keep Canva client secret and session secret out of browser code.

Sources: https://www.canva.dev/docs/apps/rest-apis/authentication/ and https://www.canva.dev/docs/apps/rest-apis/reference/generations/create-image-generation-job/
