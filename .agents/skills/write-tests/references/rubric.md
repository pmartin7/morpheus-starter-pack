# Test Evaluation Criteria

Score the test suite 1–5 on each criterion.

## 1) Coverage of Specified Behaviours

Does the test suite cover all behaviours listed in the plan's test strategy?

## 2) AAA Structure

Are tests structured Arrange / Act / Assert with one assertion cluster per it-block?

## 3) Boundary Mocking

Are mocks placed only at true external boundaries (Firebase, AI SDK, EntityManager)?

## 4) Independence

Do tests pass in any order? No shared mutable state between tests?

## 5) Behaviour over Implementation

Do tests assert on outcomes (return values, HTTP responses, visible DOM) rather than internal calls?

## 6) Naming Clarity

Does each test name describe the behaviour being tested (not the function name)?

## 7) No Over-testing

Are trivial things (decorator wiring, static markup, Tailwind classes) excluded?

## 8) Completeness

Are error cases and edge cases covered, not just the happy path?
