# Make connection for call updates and Oliver's report

The app sends JSON to one Make custom webhook when `MAKE_WEBHOOK_URL` is set in the local `.env`. Keep the webhook URL and optional API key private. Make's Webhooks app supports the `x-make-apikey` header, which this sender uses when configured.

## Scenario

1. In Make, create **Webhooks → Custom webhook** and copy its URL into `MAKE_WEBHOOK_URL`. If using Make's API key authentication, put the key in `MAKE_WEBHOOK_KEY`.
2. Add a router on `type`. Store `eventId` in a Make Data Store so a retry cannot create a second HubSpot call or send Oliver the same report twice.
3. For `call.ended`, look up the HubSpot contact using `hubspotContactId` when present, otherwise a rep verified `contactEmail`. If neither identifies one existing contact, route the event to a review queue. Do not create a new contact from an unverified transcript. For a match, use HubSpot CRM **Create a Call** and save its Call ID against `callId` in the Data Store.
4. For `call.approved`, look up the saved Call ID, then use **Update a Call** with the rep approved issue, objection, outcome, and next step. If a follow up task is needed, use **Create a Task**. A meeting should be marked booked only when the rep confirms it actually is.
5. For `report.ready`, send the formatted daily report to Oliver through the team's approved Slack channel or email connection. The app does not know his address or channel and does not send to either directly.

Make lists **Search for Contacts**, **Create a Call**, **Update a Call**, and **Create a Task** in its HubSpot CRM connector. A HubSpot administrator must approve the Make connection and relevant scopes. The exact fields and owner assignment should be checked inside Bustem's HubSpot account.

## Payloads

The webhook receives a flat JSON object with `eventId` and `type`, followed by the fields below. Illustrative payloads are in [examples/events.json](../examples/events.json).

| Event | Important fields |
| --- | --- |
| `call.ended` | `callId`, `recordingId`, `source`, `account`, `rep`, `contactEmail`, `hubspotContactId`, `endedAt`, `durationMs` |
| `call.approved` | The same identity fields plus `outcome`, `issue`, `objection`, `decisionMaker`, `nextStep`, `reviewedAt` |
| `report.ready` | Johannesburg `date`, `capturedCalls`, `reviewedCalls`, `pendingReview`, `meetingsBooked`, `followUps`, `notFit`, `objections`, `handoffs` |

`call.ended` is sent as soon as a finished recording reaches the server. `call.approved` follows the rep's review. If Make is unavailable, the event remains in the local outbox as failed and can be retried at `POST /api/events/<eventId>/retry`.

The local server sends no raw transcript to Make. The report counts only calls captured by this tool; dial totals require a separate dialer connection.
