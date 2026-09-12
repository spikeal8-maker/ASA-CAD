## Scope

Describe one product vertical slice or one focused maintenance change. Do not combine unrelated feature families.

## Contract / ownership

- [ ] I changed the narrowest owner/module.
- [ ] I did not move CAD state into UI-only code or bypass `CadApplication` history.
- [ ] Desktop/mobile still share typed command/action contracts where applicable.
- [ ] Sketch interaction reuses the shared Sketch input substrate; no copied mouse/touch/pan/pinch policy.

## Review hygiene

- [ ] Review branch is based on current `main`.
- [ ] Target is <= 6 commits; hard limit is 12 commits.
- [ ] One-shot codemod/review-fix scripts and workflows are removed from the final diff.
- [ ] Temporary debug output, artifacts and screenshots are not committed unless they are intentional fixtures.
- [ ] If iterative repair created a noisy branch, I rebuilt/squashed a clean review branch before requesting review.

## Regression

List the exact checks run and their result.

- [ ] required shell/type checks
- [ ] affected unit/architecture tests
- [ ] affected browser tests
- [ ] Docker/release regression when runtime/UI behavior changed
- [ ] protected Part workflow remains green when applicable

## Status sync

- [ ] Active GitHub issue reflects what is actually done/next.
- [ ] `docs/STATUS.md` is updated if the current phase/next action changed.
- [ ] Obsolete PRs/issues are closed or marked superseded rather than left as competing sources of truth.
