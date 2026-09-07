# Intelligence implementation stages

## Stage 1 — Evidence-based analytics (implemented)

Flow → Checks is an admin-only, read-only review of active ledger records. No model or external AI service is called; no record is changed. Duplicate candidates match vendor ID, normalized invoice number, and base-currency amount within a 90-day window. Large expenses in the recent 30 days are compared against at least 10 positive records in the preceding 60 days; the threshold is the larger of INR 10,000 and three times the median. This general size rule does not infer fraud, causality, or category-specific expectations. Evidence lists show up to 10 records per signal and disclose the full match count. Upcoming payments are recurring ledger due dates in the next 30 days; subscription schedules remain separate.

Forecast baseline: average recorded expenses across the previous three completed calendar months, including zero months, without adding payroll or recurring expenses a second time. It is an uncalibrated arithmetic projection. Explicit zero scenario costs are honored and a surplus is represented by negative net burn. The overview attention score is a heuristic, not a probability. Stored workflow rules do not execute; activating one does not set lastRunAt.

Validation: npm run test:intelligence; npm run build. Review actual expense evidence before acting. No schema changes or model credentials required.

## Stage 2 — Ask AI (next; not implemented)

Add natural-language questions grounded in authorized records, with server-enforced permissions, source links, retrieval timestamps, insufficient-evidence responses, and read-only tools. Select a reachable LLM deployment (for example an independently hosted Ollama service) and configure server-side credentials/endpoints. Do not expose the database or provider credentials to the browser. Treat record content as untrusted data. Do not promise pgvector on the current MySQL database; choose a separate retrieval store only if necessary.

Acceptance: cited totals reconcile with deterministic analytics; employee requests cannot retrieve company-wide or other employees’ data; retrieved instructions cannot invoke writes; unsupported questions produce a clear limitation.

## Stage 3 — Predictive models (not implemented)

Collect sufficient dated history and define each target before training. Begin with baseline cash-flow/spend models, use time-based holdouts, report measured error and data coverage, and deploy a more complex model only if it beats the baseline. No uncalibrated confidence percentages or risk predictions without suitable data. Inventory, CRM, and Odoo-specific predictions depend on integrations and records that this app does not currently have.

## Stage 4 — Agent proposals and approval (not implemented)

Agents may draft proposed actions with source evidence and an exact before/after preview. Store proposals with approval status, approver, timestamps, expiry, and audit history. Revalidate permissions and record versions at approval time; execute only the approved changes with idempotency and an audit trail. An insight, enabled rule, or chat response is never authorization to change ERP records. External ERP integration is a separate prerequisite.
