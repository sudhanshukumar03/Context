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
| Second account joins | Membership belongs to the intended test organization | Passed live; invitation accepted, Context Test selected, Member role confirmed |
| Member investigation | Member can read team overview, graph, timeline, history and AI | Views and automatic AI insights passed; question reached Gemini but exhausted retries with provider HTTP 429 |
| Member controls | Key creation/revocation unavailable; demo and shared Slack controls disabled | Passed live for visible controls; shared upload/reset writes covered by automated permission tests |
| Clerk member management | Member cannot invite, change roles, edit or delete the organization | Passed live; two members correctly listed, no admin actions exposed |
| Role lenses | Engineer/SRE/Manager selection does not change member permissions | Passed live in all three lenses; restored SRE |
| Membership revoked | Removed member loses access after session refresh; keys issued by that member cannot ingest | Requires separate authorization for membership change and a disposable test key |
| Slack destinations | Preferences remain account/workspace scoped | Automated coverage passed; distinct live destinations not configured |

Read-only checks of the generated local cluster found separate personal and team
service records, each with 14 events and six messages (20 timeline entries).
The original personal workspace has one active key; the test team has none.
After the second account joined, its personal workspace remained empty, with
zero services, events, messages and keys. Team counts remained unchanged.
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

The user designated the second test account, explicitly approved its Member
invitation and completed sign-in in Brave. The approved invitation was accepted
and Context Test selected. Clerk confirms the signed-in account is Member and
the creator remains Admin. No additional invitations were sent. Personal email
addresses are excluded from repository notes.

Live verification found a clipped organization-management dialog: it inherited
the compact 420px authentication-card width. Its separate Clerk appearance now
allows 960px, bounded to the viewport. At the tested desktop size the members
table's client and scroll widths both measured 649px, with no page overflow.
The disabled shared demo control is also visibly dimmed. Dashboard typecheck and
production build passed. Smaller viewport rendering was not verified in this pass.
Screenshots: `tmp/verification/context-member-manager.png`,
`tmp/verification/context-member-graph.png` and
`tmp/verification/context-member-dashboard.png`.

The live incident question reached the selected team's backend and the configured
Gemini model, which returned HTTP 429 after three attempts. Key/model availability
was confirmed separately, but successful Member answer generation remains
unverified until provider quota/rate limits permit it. No provider settings changed.
Direct browser navigation to a protected API was blocked by the client; crafted
live Member mutation requests were not performed or bypassed. Server enforcement
is supported by the focused signed-session tests, separately from UI verification.

The Member dashboard remains signed in to Context Test. Membership removal and
the disposable credential lifecycle need their own specific authorization before
those extended live checks; distinct Slack destinations remain unconfigured.
