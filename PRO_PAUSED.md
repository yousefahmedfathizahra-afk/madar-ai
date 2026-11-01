# MADAR PRO — parked development checkpoint

Status: **SAVED ON FEATURE BRANCH ONLY — NOT RELEASED**.

Branch: `feature/pro-power-tools-no-stars`.

## Prepared changes
- The one-site landing page still offers Free vs PRO before entering a chat.
- Removed decorative star symbols from the plan chooser and PRO chat.
- Kept the violet/gold PRO chat layout.
- Connected real PRO model mode (already in the main site's chat API) and preserved Free.
- Replaced nonfunctional placeholder toolbar buttons with task prompt helpers for analysis, programming, tutoring, writing, and translation.
- Added Google search opening, export of current chat to TXT, optional browser speech dictation / playback, cancel generation, safe code-block rendering and copy buttons.
- Chat text history saves locally in the browser (not in a cloud account). Images intentionally are not stored in local history.
- Kept the current basic rate limits and temporarily free PRO beta, without new paid entitlements.

## Testing completed
- JavaScript syntax check passed for the updated PRO page.
- Checked all `$('id')` references have matching elements and there are no duplicate HTML IDs.
- Checked all toolbar controls are present in HTML.
- Confirmed no decorative star characters remain in PRO HTML and chooser HTML.
- **No end-to-end browser/real-device test has been performed on these new branch changes.**

## Important: not published
Do not merge this branch into `main`, deploy to Vercel, promote aliases, or enable payments until the project owner explicitly requests publication again.
No pull request was opened for this checkpoint. The existing public site remains on its current production deployment.

## After resuming
- Browser E2E tests: chat, photo/camera permissions, speech, tool prompts, local history and mobile layout.
- Reliability and model capability measurements with real prompts.
- Add verified paid entitlements + billing only after explicit approval.


## Added while parked (bilingual PRO Studio)
- PRO chat header lets visitors select `عربي + English` (Arabic-first, with natural English terminology) or `English`; selected language is passed to the PRO chat API and checked server-side.
- Clear, well-organized answers are requested by server-side guidance, including avoidance of ornamental stars.
- PRO Studio interface contains **Image AI** (professional prompting, several visual styles, browser-side Puter authentication and a premium-image model with fallback), **Platform Builder** (AI-assisted responsive single-file HTML frontends, preview, download), **Game Maker** (HTML5 single-file game generation), **Smart Tutor** (explanations/quiz), and **Design** (brief and image prompt).
- Platforms resembling ChatGPT are explicitly **frontend prototypes**. They do not have a live database, payments, authentication, or an AI backend unless separately implemented and tested.
- Generated website/game code is displayed in a sandboxed frame with an opaque origin and restrictive CSP. External network access from its preview is blocked.
- The public website was **not changed** and no Vercel deployment was requested for this work.

### Local offline visual preview
A standalone HTML mockup was generated for user review at the conversation's downloadable file `MADAR_PRO_Studio_Offline_Preview.html`. Its Platform Builder is a local **template demonstration**, and the game is a small local example; it does not call AI. The branch's online implementation uses server endpoints and external providers only after explicit future deployment/authorization.

### Validation
- PRO HTML and PRO Studio scripts: JavaScript syntax clean.
- No missing DOM element IDs accessed by PRO Studio, no duplicate DOM IDs, and no decorative star symbols in PRO HTML.
- Offline preview tested in Chromium: studio opens, local platform preview works, download is available, demo game runs, and English switch updates copy. No browser JS errors observed in this local test.
- **Real remote AI/image generation is untested in this paused branch. Do not claim otherwise.**
