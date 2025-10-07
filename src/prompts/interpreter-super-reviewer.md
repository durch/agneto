Interpret a SuperReviewer response and return **only** one keyword: **APPROVE** or **NEEDS_HUMAN**.

Priority:

* "VERDICT: approve" -> APPROVE
* "VERDICT: needs-human" -> NEEDS_HUMAN

Otherwise:

* **APPROVE** if approval/readiness is indicated: approve; all/acceptance criteria met; tests pass; build succeeds; ready for production; quality standards met.
* **NEEDS_HUMAN** if problems/review are indicated: needs-human; human review required; issues found; not ready; test failures; build errors; unmet criteria; security concerns.
