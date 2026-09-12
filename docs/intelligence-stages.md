# Intelligence implementation stages

## Stage 1 — Evidence-based analytics (implemented)

Flow → Checks is an admin-only, read-only review of active ledger records. No model or external AI service is called; no record is changed. Duplicate candidates match vendor ID, normalized invoice number, and base-currency amount within a 90-day window. Large expenses in the recent 30 days are compared against at least 10 positive records in the preceding 60 days; the threshold is the larger of INR 10,000 and three times the median. This general size rule does not infer fraud, causality, or category-specific expectations. Evidence lists show up to 10 records per signal and disclose the full match count. Upcoming payments are recurring ledger due dates in the next 30 days; subscription schedules remain separate.

Forecast baseline: average recorded expenses across the previous three completed calendar months, including zero months, without adding payroll or recurring expenses a second time. It is an uncalibrated arithmetic projection. Explicit zero scenario costs are honored and a surplus is represented by negative net burn. The overview attention score is a heuristic, not a probability. Stored workflow rules do not execute; activating one does not set lastRunAt.

Validation: npm run test:intelligence; npm run build. Review actual expense evidence before acting. No schema changes or model credentials required.

## Stage 2 — Vyom (implemented; model configuration required)

Flow → Vyom is an admin-only, read-only question interface for month-to-date, last completed month, and year-to-date ledger facts. Each question is independent. Retrieval uses a consistent database transaction, includes all matching expense/deposit totals, and caps category/vendor rankings at 20 and largest expenses at 10. Coverage and retrieval timestamps are displayed. Citations open the expense or deposit register with the period filter, or search for the individual expense ID.

The model selects relevant fact IDs using structured JSON. The server validates every ID and renders the original computed facts, not generated numbers, prose, or URLs. Requests have a 1,000-character question limit; model calls time out after 180 seconds by default and can be configured with `VYOM_TIMEOUT_MS` from 10,000 to 600,000 milliseconds; provider response bodies are capped at 64 KiB. No tool definitions, SQL generation, write operations, credentials, employee details, or arbitrary network targets are exposed to the model. Record text is untrusted data. Employees cannot access the Flow Vyom routes, even with a forged request body. This initial release does not provide employee self-service questions.

Unsupported questions should return insufficient evidence. The schema and source validation guarantee that displayed facts exist; relevance selection still depends on the configured model and must be tested against your business questions. Causes, forecasts, record changes, other date ranges, attachments, subscriptions, and external ERP records are outside this release. This uses structured record retrieval, not embeddings or pgvector.

### Configure Ollama on the app server

- `VYOM_OLLAMA_URL`: base URL of an Ollama server reachable from the Railway app, without `/api/chat`.
- `ASK_AI_MODEL`: exact installed model name that supports structured output.
- `VYOM_TIMEOUT_MS`: optional model request timeout in milliseconds; defaults to 180,000.
- `ASK_AI_API_KEY`: optional bearer token for an authenticated gateway. Store it only in server variables, never in a Vite variable or Git.

Use your approved private service or an authenticated HTTPS gateway. A localhost URL on Railway refers to that container, not your laptop. The operator must approve this service to receive the question and retrieved financial facts. This implementation uses Ollama's `/api/chat` structured-output API; Ollama Cloud does not currently support structured outputs. No model is downloaded or provisioned automatically. Missing configuration leaves the question button disabled, with View available facts still usable. Configured-but-unreachable services produce an explicit error; configuration presence is not a connectivity check.

Validation: `npm run test:ask`, `npm run test:intelligence`, and `npm run build`. Run a real model acceptance test after configuration: ask about totals, category/vendor rankings, largest expenses, unsupported periods and actions, and injected instructions in record names. Check relevance and citation filters as well as exact totals. Provider tests in the repository mock model replies; they are not a live-model evaluation.

References: https://docs.ollama.com/api/chat and https://docs.ollama.com/capabilities/structured-outputs

## Stage 3 — Predictive models (not implemented)

Collect sufficient dated history and define each target before training. Begin with baseline cash-flow/spend models, use time-based holdouts, report measured error and data coverage, and deploy a more complex model only if it beats the baseline. No uncalibrated confidence percentages or risk predictions without suitable data. Inventory, CRM, and Odoo-specific predictions depend on integrations and records that this app does not currently have.

## Stage 4 — Agent proposals and approval (not implemented)

Agents may draft proposed actions with source evidence and an exact before/after preview. Store proposals with approval status, approver, timestamps, expiry, and audit history. Revalidate permissions and record versions at approval time; execute only the approved changes with idempotency and an audit trail. An insight, enabled rule, or chat response is never authorization to change ERP records. External ERP integration is a separate prerequisite.
