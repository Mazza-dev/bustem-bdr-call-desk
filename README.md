# Bustem Call Desk

A working GTM demo by Tolani Lambe for the South Africa BDR team. It shows a call prompt during a fictional brand protection conversation, records a finished call, gives the rep a short review form, and keeps Oliver's daily report current. The page opens directly to the tool.

**[Try the browser demo](https://mazza-dev.github.io/bustem-bdr-call-desk/)**

The public demo uses a fictional brand and browser storage. It never sends data to Bustem, Make, or HubSpot.

## Run the connected version locally

1. Install Node 22 or later. Copy `.env.example` to `.env`.
2. Run `npm start` and open `http://127.0.0.1:8787`.
3. Walk through the sample call. The local server creates `call.ended`, `call.approved`, and `report.ready` events in its outbox.
4. To send events to Make, add a private custom webhook URL to `MAKE_WEBHOOK_URL`. Add `MAKE_WEBHOOK_KEY` if the Make webhook requires an API key. Demo events remain previews unless `ALLOW_DEMO_WEBHOOK=true`.
5. To import completed calls from Parley, leave Parley open and run `npm run parley` in a second terminal. The watcher reads its local MCP endpoint and imports recordings whose titles begin with `Bustem`. Name them `Bustem | Brand name`. You can instead set `PARLEY_FOLDER_ID`. If the rep has verified them, Parley's meeting context can include `Contact email: buyer@brand.com` and `HubSpot contact ID: 12345`, each on its own line. Those fields allow the immediate Make event to attach to the right HubSpot record.

The watcher does not record audio itself. It reads Parley's finished recordings through `list_recordings` and `get_recording`. Parley remains a separate app. The browser example is scripted because no customer calls belong in a public demo.

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
