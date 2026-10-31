# Bustem GTM 2: BDR call operations

A working repo by Tolani Lambe for Bustem's South Africa BDR team. It contains the call workflow, a Parley recording adapter, a Make webhook sender, a daily report, and the handoff material needed to adapt it to Bustem's tools. It uses fictional data by default.

## What happens

1. A BDR keeps discovery questions and next steps in view during a call. The sample walks through a fictional call.
2. When a completed `Bustem` recording appears in Parley, the local adapter imports it and creates `call.ended`. The webhook sender can pass this event to Make immediately.
3. Make can match a verified contact in HubSpot and create a call activity. Unmatched calls go to review instead of creating an unverified contact.
4. The BDR checks the account, objection, outcome, and next step. Approval creates `call.approved`, which Make can use to update the HubSpot call and create a follow up task.
5. Oliver's report updates from reviewed calls throughout the day. At 18:00 Johannesburg time, the running server creates `report.ready` for Make to deliver through the team's chosen channel.

The [workflow template](workflow-template.json) names the events, required fields, and decisions. The [integration map](docs/INTEGRATIONS.md) shows what can be connected in Make and what needs a small adapter or a confirmed Bustem setup. The [Make setup](docs/MAKE.md) gives the routing steps. A [Claude skill](.claude/skills/bustem-bdr-call-ops/SKILL.md) is included for operators adapting this repo.

## Run the connected version locally

1. Install Node 22.13 or later. Copy `.env.example` to `.env`.
2. Run `npm start` and open `http://127.0.0.1:8787`.
3. Walk through the sample call and approve its notes. The local server creates `call.ended` and `call.approved` in its outbox. Use **Send current report** to create `report.ready` before the scheduled time.
4. To send events to Make, add a private custom webhook URL to `MAKE_WEBHOOK_URL`. Add `MAKE_WEBHOOK_KEY` if the Make webhook requires an API key. Demo events remain previews unless `ALLOW_DEMO_WEBHOOK=true`.
5. To import completed calls from Parley, leave Parley open and run `npm run parley` in a second terminal. The watcher reads its local MCP endpoint and imports recordings whose titles begin with `Bustem`. Name them `Bustem | Brand name`. You can instead set `PARLEY_FOLDER_ID`. If the rep has verified them, Parley's meeting context can include `Contact email: buyer@brand.com` and `HubSpot contact ID: 12345`, each on its own line. Those fields allow the immediate Make event to attach to the right HubSpot record.

The watcher does not record audio itself. It reads Parley's finished recordings through `list_recordings` and `get_recording`. Parley remains a separate app. The browser example is scripted because no customer calls belong in a public demo.

The [browser preview](https://mazza-dev.github.io/bustem-bdr-call-desk/) runs the fictional call flow in browser storage. It does not connect to Parley, Make, HubSpot, or Bustem. The repo and local server are the integration sample.

## What the three events do

| Event | When it is created | Suggested Make action |
| --- | --- | --- |
| `call.ended` | A completed Parley recording is imported | Match an existing HubSpot contact, then create a call record. Hold unmatched records for review. |
| `call.approved` | The rep checks the account and outcome | Update that call and add the confirmed next step. |
| `report.ready` | 18:00 Johannesburg time, or when the operator sends the current report | Deliver Oliver's daily summary through the team's chosen channel. The scheduled report is separate from any earlier manual send. |

The [Make setup guide](docs/MAKE.md) gives the event fields, HubSpot routing, and duplicate rules. The local server must be running at 18:00 for the scheduled send. It computes the report on every page load, so the current view is available throughout the day.

## Limits before using real calls

- Bustem has not supplied a dialer, Parley installation, Make account, HubSpot connection, or real BDR data. The adapter and webhook sender are implemented but have not been connected to those accounts.
- A recording count is not a dial count. Add the dialer's activity feed before reporting dial volume.
- Parley's computer audio capture needs a test with the actual BDR dialer and operating system. Calls on a separate handset may not be captured.
- The rep must verify prospect identity, outcome, and follow up. The app does not infer those from a transcript.
- The server binds to localhost by default. Use approved access controls, recording consent, and secure hosting before team use. Do not put customer data or credentials in the public repository.

Run `npm test` for event, duplicate, and report checks.
