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
