# MADAR PRO — isolated AI integration (NOT DEPLOYED)

## Live PRO chat without a separate API key (user-credit route)
- The PRO chat now supports an **optional** user-authorized direct AI connection. It is deliberately **not** available to MADAR Free and never uses the Free `GEMINI_API_KEY`.
- Open PRO over **HTTPS or http://127.0.0.1** (not via `file://`). Open **•••**, check the credit consent checkbox, and click **تفعيل شات PRO الحقيقي**. A Puter sign-in window may open. If the SDK was loading at first click, click again after the ready message.
- This mode uses the **user's Puter account credits**. It is not equivalent to a free, unlimited PRO API. No user credit is used unless an authenticated user initiates a request, and the app does not silently retry with a paid model.
- Once connected, the chat and PRO Studio tasks use a real client-side AI call. If no user consent is given, the normal dedicated PRO server route remains the preferred route; it requires its own PRO key.
- The actual model name is intentionally absent from the public UI and reply payload, but a sophisticated user can inspect network requests. Do not treat a client-side model identifier as a secret.
- AI output is not fabricated. Testing using mocked SDK calls is distinct from a real provider-backed result, which requires the user's authenticated account and credits.

## Video Studio
- PRO offers 1080p or 4K, 5/10/15 seconds using a premium video provider through the user's Puter account.
- Click **🔐 تسجيل الدخول لحساب الفيديو** inside the Video Studio before generating real video.
- **▶ جرّب عينة مجانية** passes the selected video model, duration and resolution plus `test_mode: true`. It returns a generic demonstration clip, **not** a generated clip based on the prompt, and does not spend credits.
- **🎬 توليد فيديو حقيقي** requires explicit checked consent to consuming the user's credits. Generating actual video has not been tested against a personal paid account, and insufficient credit must produce a clear error.
- Tested at code level with mocked provider replies to ensure the 4K option and credit gate are wired; no PRO deployment, paid call or account sign-in was performed by this change.

### Local dev (no web deployment)
From the repository root containing `pro.html` and the JS files, run `python -m http.server 8765 --bind 127.0.0.1`, then open `http://127.0.0.1:8765/pro.html`. A raw downloaded `pro.html` opened directly from disk cannot authenticate with Puter or invoke PRO server APIs. Do not expose the local server to the internet.


This branch is **development only**. Never publish, merge, or deploy changes without the owner's fresh, explicit approval. The production MADAR Free site and `api/chat.js` must remain untouched.

## What is wired
- `pro.html` — dark mode by default, quiet UI, all tools behind **+** and settings behind **•••**.
- AI model selector inside **•••**: **Auto**, **Gemini 3.8 Flash**, **DeepSeek R1 Free**.
- `pro-studio.js` — Platform Builder, Game Maker, Tutor, Design use PRO-only `/api/pro-chat`; Image Studio is still via the separately authenticated Puter SDK.
- `api/pro-chat.js` — independent Gemini / OpenRouter server endpoint, with input validation, timeout, basic local rate limiting and same-origin checks. It never reads the Free site `GEMINI_API_KEY`.

## Setup after owner authorizes a separate PRO deployment
Prefer a **separate Vercel project** dedicated to MADAR PRO, with a different URL and separate environment variables so the Free deployment cannot be impacted.

Configure the following server-side environment variables, **not inside HTML and not in chat**:
- `MADAR_PRO_GEMINI_API_KEY` — key generated for a separate PRO Google AI Studio project (Gemini 3.8 Flash).
- `MADAR_PRO_OPENROUTER_API_KEY` — a separate PRO OpenRouter key, used only for `deepseek/deepseek-r1:free`.
- `MADAR_PRO_ALLOW_PAID_MODELS` — leave **unset** (default disabled). If an owner later explicitly authorizes paid usage, review quotas and billing **before** setting this to `true`.

One of the first two keys is enough. If both are configured, **Auto** chooses Gemini. Explicit model selections do not silently fall back to another provider. No API keys are checked into GitHub.

**No new key is currently configured by this change.** Until the server is running with a dedicated PRO key, the AI buttons must show a real configuration error, not fake answers. Downloaded `file://` HTML will display the UI but cannot invoke the server. A local development server or dedicated authorized PRO deployment is needed for real AI.

## Costs and limitations
- **OpenRouter R1:free**: free model ID, but published OpenRouter limits include 50 requests/day on a new/unfunded account and 20 requests/minute; availability is not guaranteed. Never auto-upgrade to a paid model.
- **Gemini 3.8 Flash**: Google lists a limited free tier. If billing is enabled in the Google project, usage may be charged; isolate the PRO project and set budgets/quotas before launching.
- **Gemini 3.1 Pro Preview**: Google lists **no free tier**. The server disables this provider unless `MADAR_PRO_ALLOW_PAID_MODELS=true`, and the current UI disables its option.
- **WebContainers**: great for Node.js in-browser prototypes but commercial/for-profit production use requires a separate license per StackBlitz. Do not bundle it into the paid PRO plan without licensing; current HTML preview is not a full-stack sandbox.
- **PRO image generation**: Puter user sign-in and available credits/models are required. Do not promise Ultra-HD or image inpainting until empirically tested.

## Test checklist
1. Static: parse `api/pro-chat.js`, `pro-studio.js` and all inline `pro.html` scripts; verify unique element IDs.
2. Unit tests with mocked provider responses: successful Gemini and DeepSeek answer, wrong origin, missing key, disabled paid mode, invalid provider and empty reply.
3. Server (after keys): real POST `/api/pro-chat` with `{"messages":[{"role":"user","content":"2+2? Answer only the number."}],"provider":"gemini"}` should return a nonempty `reply` including 4.
4. Browser: verify dark mode on first paint, tool **+** menu, settings **•••**, language switch, working Studio and mobile layout.
5. Compare production MADAR Free before and after. Do not alter Free /api/chat or its environment.

This branch is intentionally **not published**.
