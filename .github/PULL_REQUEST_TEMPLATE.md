## Scope

Describe one product vertical slice or one focused maintenance change. Do not combine unrelated feature families.

## Contract / ownership

- [ ] I changed the narrowest owner/module.
- [ ] I did not move CAD state into UI-only code or bypass `CadApplication` history.
- [ ] Desktop/mobile still share typed command/action contracts where applicable.
- [ ] Sketch interaction reuses the shared Sketch input substrate; no copied mouse/touch/pan/pinch policy.
- [ ] Changed hand-written files remain within `spec/process/repository-health.v1.json`; I did not raise a frozen ceiling to make CI pass.

## Slice Quality Gate

Result: **GREEN / YELLOW / RED**

- [ ] Repository-hygiene and file-budget checks are green.
- [ ] No new god-object, duplicate implementation path or temporary/generated artifact remains.
- [ ] Any file above target is non-growing or was split in this change.
- [ ] If YELLOW, the debt is explicit, frozen and linked to a cleanup owner before the next milestone boundary.
- [ ] RED findings are resolved before merge.
- [ ] If this is the third accepted slice since the last full audit or a milestone boundary, the Full Repository Health Audit was performed.

## Review hygiene

- [ ] Review branch is based on current `main`.
- [ ] Review branch contains **6 commits or fewer**.
- [ ] One-shot codemod/review-fix scripts and workflows are removed from the final diff.
- [ ] Temporary debug output, artifacts and screenshots are absent unless intentional fixtures.
- [ ] If iterative repair created a noisy branch, I rebuilt/squashed a clean review branch before requesting review.

## Regression

List the exact checks run and their result.

- [ ] `npm run test:process`
- [ ] required shell/type checks
- [ ] affected unit/architecture tests
- [ ] affected browser tests
- [ ] Docker/release regression when runtime/UI behavior changed
- [ ] protected Part workflow remains green when applicable
- [ ] ASA Lab shared contract fixtures remain green when the host/persistence boundary changed

## Status sync

- [ ] Active GitHub issue reflects what is actually done/next.
- [ ] `docs/STATUS.md` is updated **in this review change** when phase/gate/next action changes.
- [ ] Obsolete PRs/issues are closed or marked superseded rather than left as competing sources of truth.
