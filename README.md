# Bustem GTM 2: BDR call desk demo

This is a demo of a proposed call workflow for Bustem's South Africa BDR team. It shows how a rep could review a completed call, prepare a CRM update, and give Oliver a current daily summary. Bustem has not connected a dialer, Parley, Make, HubSpot, or a reporting destination to this repository. The browser walkthrough uses a fictional call.

## What the demo shows

| Step | What works here | What is simulated or missing |
| --- | --- | --- |
| Call walkthrough | The browser reveals a scripted conversation and fixed prompts one line at a time. | This is not a live call, live transcription, or AI coaching. It does not listen to the BDR's dialer. |
| Call record | The local server can store a call, avoid importing the same source recording twice, and create a `call.ended` event. | The sample call is fictional. No Bustem calls have been imported. |
| Parley import | A local adapter is written to poll Parley's MCP endpoint for completed recordings and import those with a `Bustem` title or a chosen folder. | It has not been tested with Bustem's actual dialer, recording setup, or Parley account. It does not record audio itself or provide prompts during a live call. |
| Rep review | The rep can check the account, issue, objection, outcome, and next step. Approval creates a `call.approved` event. | Sample answers are prefilled only for the fictional call. Real outcomes and identities must be checked by the rep. |
| Make and HubSpot | The local server has a webhook sender with a retryable event outbox. The [Make guide](docs/MAKE.md) describes how to match a verified contact, create or update a HubSpot call, and create a task. | No Make scenario or HubSpot connection has been created in Bustem's accounts. These steps are instructions for a future setup, not actions the demo currently performs. |
| Oliver's report | The local server calculates counts from calls stored in this tool and creates `report.ready` on request or at 18:00 Johannesburg time while the server is running. | The report is not sent to Oliver unless an authorized Make webhook and destination are configured. It cannot show total dial volume without the dialer's activity feed. |

The [browser preview](https://mazza-dev.github.io/bustem-bdr-call-desk/) runs entirely in browser storage. It has no Parley, Make, HubSpot, or Bustem connection. The local server demonstrates the event and report logic separately.

## Run the local demo

1. Install Node 22.13 or later. Copy `.env.example` to `.env`.
2. Run `npm start` and open `http://127.0.0.1:8787`.
3. Walk through the fictional call, end it, and approve the sample notes. The server creates `call.ended` and `call.approved` events in its outbox.
4. Choose **Send current report** to create `report.ready`. Without a Make webhook, the events remain local. Demo events remain previews even with a webhook unless `ALLOW_DEMO_WEBHOOK=true` is explicitly set.

The [workflow template](workflow-template.json) defines the three event types. The [integration map](docs/INTEGRATIONS.md) shows which connections need team access and which can be configured in Make. The [Make guide](docs/MAKE.md) gives the proposed HubSpot actions. The included [Claude skill](.claude/skills/bustem-bdr-call-ops/SKILL.md) helps adapt the workflow; it is not a live integration.

## Before using actual calls

Test whether the approved dialer audio can be captured by Parley on the BDR's operating system. If it cannot, connect the dialer's own completed recording feed instead. Confirm the rep's consent and recording process, obtain authorized HubSpot and Make access, decide where Oliver's report should go, and test field matching with real but approved records. Unmatched contacts should stay in review. A recording count must never be presented as a dial count.

The local server listens on localhost by default. It must keep running for the scheduled report event. It is not ready to be exposed to a team without access controls, monitoring, and an agreed policy for retaining call data. Do not put recordings, customer data, webhook URLs, or credentials in this public repository.

Run `npm test` to check the event, duplicate, and report logic.
