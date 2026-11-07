# MADAR PRO — Zero-cost preview configuration (not production)

MADAR Free is **not modified** by this branch. All PRO changes are isolated to PRO-specific files. The PRO interface retains its dark-and-gold palette.

## What actually works for free

- PRO chat: `/api/pro-chat` calls the explicit `openrouter/free` model router only. That endpoint has zero model pricing (not a paid auto-router). A **dedicated OpenRouter API key** is required on the server, never in client JavaScript.
- Free router daily/rate limits apply. Free requests can stop when quota is exceeded. Do not promise unlimited chat.
- Images and files: user image data and extracted document text are sent to the same PRO chat route. A vision-capable free model may be selected when available.
- Posters: `pro-studio.js` draws graphic posters locally in Canvas and exports PNG. This is **not photo-realistic AI image generation**.
- Video: `madar-pro-video-studio.js` draws animated motion graphics locally and records a genuine video with CanvasCaptureStream + MediaRecorder. It can export 1080p or attempt 4K, 5/10/15 seconds, depending on browser/hardware. This is **not generative AI text-to-video**, and it has no audio.
- Site/lesson/game code tools require the PRO free chat route. No model name is displayed in the interface.

## One-time owner setup, not something every user does

1. Create a free OpenRouter account and its API key at https://openrouter.ai/settings/keys (this can be subject to the provider's current signup/usage policies).
2. Configure `MADAR_PRO_OPENROUTER_API_KEY` as an **encrypted server-side** environment variable for the PRO preview deployment. If using the same Vercel project as the Free website, restrict it to the PRO development branch preview. **Do not change or reuse the Free site's `GEMINI_API_KEY` or its production environment variables.**
3. Deploy the PRO development branch to a preview URL. Check the backend by sending `POST /api/pro-chat` with `{"provider":"auto","messages":[{"role":"user","content":"2+2"}]}`.
4. Before supporting many users, add durable request quotas/abuse protection. The current per-process rate limiter is *best-effort*, not a global distributed limit.

**If this separate key is not configured**, the server returns a truthful `503` response. No fallback calls paid services, and no user is asked to supply a key or connect a paid account.

## Strict no-charge guarantees in this implementation

- PRO code never accesses the Free site API keys.
- `openrouter/auto`, paid model IDs, Gemini Pro payment modes, Puter user-credit chat/image/video API calls and any automatic paid fallback are **not used**.
- UI images/video are made in the user's browser, so there is no provider charge. 4K recording may fail on slower devices; 1080p is the safe default.
- Do not falsely label motion graphics or posters as AI-generated scenes/photos.
- The existing Free edition remains unchanged by deploying the PRO preview. Do not promote it to production without explicit permission.

## Testing

- `node --test tests/pro-chat.test.js tests/pro-client-and-video.test.js`: validates free-only model routing, API input/denials, absence of paid paths, local video and image implementation markers.
- Real model response requires configuring the dedicated free-tier key. Tests use mocked responses rather than claiming real model access.
- Real video export should be tested in a current browser with MediaRecorder support, preferably Chrome or Edge. Test both 1080p and 4K hardware support.

## Cost note

OpenRouter `openrouter/free` is a zero-price model router but may have strict limits and terms; free hosting plans and external service limits can also change. This project does **not** authorize any purchases, subscriptions, or credit-consuming routes.
