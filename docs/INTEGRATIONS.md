# Where each connection belongs

This repo works with fictional calls before any Bustem account is connected. The table separates Make setup from the pieces that need a small adapter or team access.

| Step | Connection in Make | Code or access needed |
| --- | --- | --- |
| Finished call | Receive the `call.ended` webhook. | Parley must capture the actual dialer audio. If it cannot, connect the approved dialer's recording feed instead. |
| Contact match | Search HubSpot by a BDR verified contact ID or email. | The recording source must provide that verified field. Unmatched calls need a person to resolve them. |
| Call activity | Create a HubSpot call and store the call ID in a Make Data Store. | An authorized HubSpot connection and field mapping are required. |
| Reviewed outcome | Receive `call.approved`, look up the saved call ID, update the call, and create a task when needed. | The BDR must approve the outcome and next step. |
| Oliver's report | Receive `report.ready` and send the formatted message using the team's email or chat connection. | Confirm Oliver's destination. Keep the local server running at report time or move scheduling to an approved hosted runner. |
| Dial volume | Add the dialer's call activity feed to the report. | The dialer and its access method are unknown. Do not substitute the number of recordings. |

The [workflow template](../workflow-template.json) is the event contract. The [Make guide](MAKE.md) gives the router and HubSpot actions. The server has a retryable outbox, but a production connection also needs authentication, monitoring, and an agreed retention policy for call notes.
