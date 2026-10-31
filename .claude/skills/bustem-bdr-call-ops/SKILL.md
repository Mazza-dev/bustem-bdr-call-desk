---
name: bustem-bdr-call-ops
description: Review and adapt the Bustem BDR call workflow, Parley import, Make handoff, HubSpot call updates, and Oliver's daily report.
---

# Bustem BDR call operations

Use this repo's [README](../../../README.md), [workflow template](../../../workflow-template.json), and [integration map](../../../docs/INTEGRATIONS.md) before proposing a live connection. Treat Parley, Make, HubSpot, and Oliver's report destination as unconnected until the operator confirms access.

When reviewing a call, distinguish a completed recording from a dial, and a transcript claim from a BDR approved outcome. Ask the BDR to verify the account, contact, issue, objection, decision maker, and next step. Never mark a meeting booked without a confirmed next step. Do not invent a contact or create a HubSpot record from an unverified transcript.

For Make setup, use `eventId` to prevent duplicate actions. Match a verified HubSpot contact, save the created call ID against `callId`, and update that call after `call.approved`. Leave unmatched calls for review. Keep raw transcripts out of Make unless Bustem explicitly approves another handling policy.

For Oliver's report, count only calls captured by this workflow. Show reviewed and pending calls separately. State that dial totals are unavailable until the dialer feed is connected. The scheduled event is at 18:00 Johannesburg time while the server runs. Do not send a report or message to Oliver without the user's direct authorization and the chosen destination.
