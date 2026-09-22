# Intelligence implementation stages

## Stage 1 — Evidence-based analytics (implemented)

Flow → Checks is an admin-only, read-only review of active ledger records. No model or external AI service is called; no record is changed. Duplicate candidates match vendor ID, normalized invoice number, and base-currency amount within a 90-day window. Large expenses in the recent 30 days are compared against at least 10 positive records in the preceding 60 days; the threshold is the larger of INR 10,000 and three times the median. This general size rule does not infer fraud, causality, or category-specific expectations. Evidence lists show up to 10 records per signal and disclose the full match count. Upcoming payments are recurring ledger due dates in the next 30 days; subscription schedules remain separate.

Forecast baseline: average recorded expenses across the previous three completed calendar months, including zero months, without adding payroll or recurring expenses a second time. It is an uncalibrated arithmetic projection. Explicit zero scenario costs are honored and a surplus is represented by negative net burn. The overview attention score is a heuristic, not a probability. Stored workflow rules do not execute; activating one does not set lastRunAt.

Validation: npm run test:intelligence; npm run build. Review actual expense evidence before acting. No schema changes or model credentials required.

## Stage 2 — Vyom (implemented; model configuration required)

Flow → Vyom is an admin-only, read-only conversational interface. It uses a hybrid approach: verified workspace retrieval for business data, a short-lived cached workspace context for CAG-style multi-turn analysis, and Gemini's general reasoning for stable knowledge, writing, and brainstorming outside the workspace. Retrieval uses a consistent database transaction, includes all matching expense/deposit totals, and caps category/vendor rankings at 20 and largest expenses at 10. Coverage and retrieval timestamps are displayed. Citations open the corresponding workspace records.

Vyom also receives a server-authored feature map for Dashboard, Expenses, Deposits, Vendors, Subscriptions, Assets, People, Projects and Taskboard, Schedule, Analytics, Flow, and access settings. This lets it explain how a feature should be used without inventing current record values. Up to 30 open tasks are included with project, status, priority, assignee, and due date so task questions can be answered individually. Sensitive personal, compensation, payroll, authentication, banking, tax-identifier, credential, vendor-contact, and asset-serial data are excluded from model context.

For detailed questions, the API performs server-controlled, read-only retrieval from an allowlist of Assets, Subscriptions, Projects, People, Vendors, and Flow automation rules. Each module is limited to 40 records per question and explicitly selects safe fields. The model cannot submit SQL, choose arbitrary tables or columns, bypass tenant/user authorization, or call a write operation.

Every Vyom request creates an administrator-visible access audit containing the requesting user, conversation reference, datasets and structured filters used, record count, outcome, and whether a sensitive-field request was refused. The audit deliberately omits API keys, credentials, the full question text, and retrieved record contents.

General-knowledge and feature-help questions use a minimal context and do not read business records. Workspace summaries retrieve the summary dataset explicitly. Answers, conversation messages, proposal-preparation events, and access audits are committed together so a successful answer cannot be stored without its corresponding audit; failed attempts create a failure audit when the database remains available.

Vyom may draft one of three tightly validated actions: create a task, update an allowlisted set of subscription fields, or approve a pending leave request. Drafts expire after 24 hours and store an exact before/change preview. Execution requires a separate administrator approval request, revalidates the target version and business rules, atomically claims the pending proposal, and writes the executed change to the general audit log. A chat response alone never executes a proposal.

The server accepts a model proposal only when the latest user message contains an explicit action verb for the matching operation. Duplicate pending proposals with the same creator, target, action, and payload are reused instead of created again. Rejections, executions, expirations, stale-record failures, and preparation events have explicit lifecycle states and audit records.

The model selects relevant fact IDs using structured JSON. The server validates every ID and renders the original computed facts, not generated numbers, prose, or URLs. Requests have a 1,000-character question limit; model calls time out after 180 seconds by default and can be configured with `VYOM_TIMEOUT_MS` from 10,000 to 600,000 milliseconds; provider response bodies are capped at 64 KiB. No tool definitions, SQL generation, write operations, credentials, employee details, or arbitrary network targets are exposed to the model. Record text is untrusted data. Employees cannot access the Flow Vyom routes, even with a forged request body. This initial release does not provide employee self-service questions.

Workspace claims without evidence and questions requiring current web information return insufficient evidence. General answers are labeled separately and must not be presented as workspace facts. The schema and source validation guarantee that cited workspace facts exist; relevance and general reasoning still depend on the configured model. Record changes, external ERP records, and live web grounding remain outside this release. This uses structured record retrieval and cached context rather than embeddings or pgvector.

### Configure Gemini on the app server

- `GEMINI_API_KEY`: Gemini API key, stored only on the server, never in a Vite variable or Git.
- `VYOM_GEMINI_MODEL`: optional Gemini model supporting structured output; defaults to `gemini-2.5-flash`.
- `VYOM_TIMEOUT_MS`: optional model request timeout in milliseconds; defaults to 180,000.

Vyom sends each question, recent conversation history, and relevant workspace facts to Google's Gemini `generateContent` API over HTTPS. Usage billing and quotas follow the Google API project. No local model is required. Missing configuration disables questions while keeping available facts accessible. Test connection makes a real Gemini request; provider failures produce an error without exposing credentials or provider response details.

Validation: `npm run test:ask`, `npm run test:intelligence`, and `npm run build`. Run a real model acceptance test after configuration: ask about totals, category/vendor rankings, largest expenses, unsupported periods and actions, and injected instructions in record names. Check relevance and citation filters as well as exact totals. Provider tests in the repository mock model replies; they are not a live-model evaluation.

Reference: https://ai.google.dev/api/generate-content

## Stage 3 — Predictive models (not implemented)

Collect sufficient dated history and define each target before training. Begin with baseline cash-flow/spend models, use time-based holdouts, report measured error and data coverage, and deploy a more complex model only if it beats the baseline. No uncalibrated confidence percentages or risk predictions without suitable data. Inventory, CRM, and Odoo-specific predictions depend on integrations and records that this app does not currently have.

## Stage 4 — Agent proposals and approval (not implemented)

Agents may draft proposed actions with source evidence and an exact before/after preview. Store proposals with approval status, approver, timestamps, expiry, and audit history. Revalidate permissions and record versions at approval time; execute only the approved changes with idempotency and an audit trail. An insight, enabled rule, or chat response is never authorization to change ERP records. External ERP integration is a separate prerequisite.
