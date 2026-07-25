# Bug Fix Evaluation Criteria

Score the proposed fix 1–5 on each criterion.

## 1) Simplicity

Is the fix as small as possible? Penalise fixes that touch unrelated code.

## 2) Maintainability

Will the fix be readable and understandable six months from now?

## 3) YAGNI

Does the fix introduce any abstraction not required to correct the bug?

## 4) Separation of Concerns

Does the fix put logic in the right place (controller vs service vs guard vs lib)?

## 5) Performance

Does the fix introduce any performance regression (extra queries, re-renders, blocking calls)?

## 6) Correctness

Does the fix actually solve the root cause, or does it patch a symptom?
