# Feature Research Evaluation Criteria

Score each option 1–5 on each criterion.

## 1) Simplicity

Does the option solve the problem with the least moving parts? Penalise extra abstractions, extra files, extra concepts.

## 2) YAGNI

Does the option build only what the spec requires? Penalise anything added "for the future."

## 3) Spec Correctness

Does the option actually solve the stated problem? Penalise options that solve a related but different problem.

## 4) System Design

Does the option fit cleanly into the existing architecture (modules, entities, data flow)? Penalise options that require architectural changes not justified by the spec.

## 5) Separation of Concerns

Does each part do one thing? Controllers thin, services own logic, lib owns utilities.

## 6) Performance

Does the option avoid obvious N+1 queries, unnecessary re-renders, or blocking operations?
