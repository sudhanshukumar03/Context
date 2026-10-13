# Shared-team verification

Use the isolated Context app at http://127.0.0.1:31800 with the configured Clerk
development instance. Keep credentials and sign-in codes out of reports/chat.
Uploaded directory contacts describe onboarding context; Clerk membership controls
actual access.

## Current baseline

The signed-in personal workspace contains five healthy demo services, 20 timeline
items and the existing Monitoring key. These records were preserved. The user
approved creation of Context Test; its creator is shown as Admin in Clerk's
switcher. It began empty, with no services, timeline or webhook keys.

## Live checks

| Check | Expected result | Status |
| --- | --- | --- |
| Create Context Test | Empty shared tenant; creator has admin access | Passed live |
| Personal → Context Test | Personal services, timeline and key metadata do not appear in the initially empty team | Passed live |
| Admin controls | Create-key and demo controls enabled for the team admin | Passed live; no key created |
| Team demo | Synthetic data persists only in Context Test; all nine steps complete | Passed live: 9/9, five healthy services |
| Context Test → Personal | Original five services, history and Monitoring key remain intact | Passed live |
| Return to Context Test | Only its own synthetic data reappears | Passed live; no personal key shown |
| Reload active team | Selected team and its own data load correctly | Passed live |
| Member invitation | Clerk sends the approved invitation with Member role | Passed live; listed under Invitations 1 |
| Second account joins | Membership belongs to the intended test organization | Awaiting acceptance and second-account sign-in |
| Member investigation | Member can read team overview, graph, timeline and AI | Awaiting second account |
| Member writes | Member cannot create/revoke team keys, replace shared uploads, reset/run demo or send shared Slack notifications | Awaiting second account |
| Role lenses | Engineer/SRE/Manager selection does not change member permissions | Awaiting second account |
| Membership revoked | Removed member loses access after session refresh; keys issued by that member cannot ingest | Requires separate authorization for membership change and a disposable test key |
| Slack destinations | Preferences remain account/workspace scoped | Automated coverage passed; distinct live destinations not configured |

Read-only checks of the generated local cluster found separate personal and team
service records, each with 14 events and six messages (20 timeline entries).
The original personal workspace has one active key; the test team has none.
No event, message or dependency crosses workspace boundaries. The inspection
validated the exact generated cluster directory and ran inside a read-only
transaction. Evidence stays in ignored `tmp/verification/shared-tenant-isolation.json`.
Team recovery and preserved personal-workspace screenshots are also under
`tmp/verification/`. No production database was contacted; no credentials or
document contents were reported.

Only use synthetic team data. Do not invite a real colleague, change membership,
create/revoke persistent credentials, send Slack messages, or delete original
personal data as part of an unapproved test. Ask for the specific recipient/action
when those checks are ready. No production migrations or deployment are needed.

## Automated coverage

Focused verification on 2026-10-13: 27 tests across four files passed:
signed Clerk HTTP sessions, verified tenant selection, organization permissions,
and webhook-key authorization/lifecycle. No external membership or invitation
was changed by these checks.

Existing signed Clerk SDK HTTP tests reject forged/expired sessions, trust signed
organization/role claims, reject member writes despite forged admin payloads, and
restore the original personal tenant when no team is selected. Disposable
PostgreSQL tests cover concurrent shared-tenant mapping and actual onboarding
user/workspace isolation. Webhook tests cover current membership rechecks and
revocation. These support the live checks above; they do not replace two-account
browser verification.

The user designated the second test account and explicitly approved its Member
invitation. Clerk displayed Invitations successfully sent and lists one pending
invitation with Member role. No additional invitations were sent. Delivery to
the inbox and acceptance require the user's check. Screenshot:
tmp/verification/context-member-invitation-sent.png. Personal email addresses
are excluded from repository notes.

The admin session was signed out after verification. The existing Brave tab is
at `/sign-in`, ready for the invited account. The user must accept the invitation
and complete sign-in before the remaining live Member checks can run.
