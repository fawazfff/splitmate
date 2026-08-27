# Splitmate Agent evaluation

## Result

Production run on August 27, 2026:

| Metric | Result |
| --- | ---: |
| Passed | 26/26 |
| Pass rate | 100% |
| Categories | 9 |
| Average latency | 7.98 seconds |
| P50 latency | 8.38 seconds |
| P95 latency | 12.07 seconds |

Target: `https://splitmate-weld.vercel.app/api/chat`

These are black-box production measurements. They include network and serverless runtime latency and should not be interpreted as model-only latency.

## Method

The evaluator sends the same request shape as the browser application to the deployed Agent API. Every case has a machine-checkable expectation for the returned structured action and important fields such as amount, payer, split members, or safety behavior.

Run it yourself:

```bash
npm run test:agent
```

Run against another deployment:

```bash
node scripts/agent-eval.mjs --url=https://your-deployment.example
```

The process exits with a failure status if any scenario fails.

## Coverage

| Category | Passed | Examples |
| --- | ---: | --- |
| Expense capture | 7/7 | Equal splits, explicit splits, decimals, bought phrasing, multiple expenses |
| Identity | 2/2 | Resolving “I” and “we” from the selected member |
| Clarification | 4/4 | Missing payer, amount, or description |
| Memory | 2/2 | Short follow-up answers and draft corrections |
| Reasoning | 4/4 | Settlement, who owes whom, balance explanation, spending analysis |
| Scope safety | 1/1 | Unrelated request does not become a financial action |
| Payment safety | 1/1 | Agent does not claim it sent funds |
| Data actions | 3/3 | Edit, delete, and add-member proposals |
| Input safety | 2/2 | Negative and zero amounts rejected |

## Bugs found by the evaluation

The first production run passed 23/26. It revealed that the deterministic parser accepted negative and zero amounts. Both were fixed by rejecting invalid numeric inputs during parsing and by running deterministic actions through the same sanitizer used for model output.

The second run passed 25/26. It revealed a mismatch where the Agent verbally rejected an unrelated request but attached a settlement action. Model responses that identify a request as out of scope now have their action cleared.

The final run passed 26/26.

## What this result does not claim

- It is not proof that every possible human sentence will succeed.
- It does not test wallet-provider uptime or guarantee blockchain confirmation.
- It does not replace a small real-payment rehearsal before recording the submission demo.
- It does not hide production latency. Serverless and network time is included in the published metrics.

## Next evaluation expansion

- Add multilingual expense phrasing.
- Add fuzzed punctuation and speech-to-text transcripts.
- Add wallet rejection, chain-switch failure, reverted transfer, and delayed-receipt browser scenarios.
- Run the suite from multiple regions and publish warm and cold latency separately.

