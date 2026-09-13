## Scope

Describe one product vertical slice or one focused maintenance change. Do not combine unrelated feature families.

## Contract / ownership

- [ ] I changed the narrowest owner/module.
- [ ] I did not move CAD state into UI-only code or bypass `CadApplication` history.
- [ ] Desktop/mobile still share typed command/action contracts where applicable.
- [ ] Sketch interaction reuses the shared Sketch input substrate; no copied mouse/touch/pan/pinch policy.
- [ ] Changed hand-written files remain within `tests/process/file-budgets.mjs`; I did not raise a frozen ceiling to make CI pass.

## Review hygiene

- [ ] Review branch is based on current `main`.
- [ ] Review branch contains **6 commits or fewer**.
- [ ] One-shot codemod/review-fix scripts and workflows are removed from the final diff.
- [ ] Temporary debug output, artifacts and screenshots are absent unless intentional fixtures.
- [ ] If iterative repair created a noisy branch, I rebuilt/squashed a clean review branch before requesting review.

## Regression

List the exact checks run and their result.

- [ ] file-budget / PR-hygiene checks
- [ ] required shell/type checks
- [ ] affected unit/architecture tests
- [ ] affected browser tests
- [ ] Docker/release regression when runtime/UI behavior changed
- [ ] protected Part workflow remains green when applicable

## Status sync

- [ ] Active GitHub issue reflects what is actually done/next.
- [ ] `docs/STATUS.md` is updated **in this review change** when phase/gate/next action changes.
- [ ] Obsolete PRs/issues are closed or marked superseded rather than left as competing sources of truth.
