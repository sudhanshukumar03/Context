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
| Shared QA key creation/revocation | Admin can create and revoke the disposable team key | Passed live; first and approved replacement QA keys are revoked, zero active team keys |
| Shared QA ingestion/replay | One info event is stored; replay adds none | Passed live with approved replacement: HTTP 200, duplicate=false then duplicate=true, same event ID and one persisted event |
| Revoked QA delivery | A revoked key cannot ingest or change data | Passed live: HTTP 401, no count/health changes |
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

The original Admin account is signed in to Context Test after the completed
replacement-key test. Both approved disposable keys are revoked. Membership
removal needs its own specific authorization before an extended live check;
distinct Slack destinations remain unconfigured.

Follow-up: Gemini HTTP 429 now produces a safe HTTP 503 message explaining
provider rate/quota exhaustion and recommending a later retry. The real Member
browser shows this message. Twelve new HTTP regressions cover all nine AI routes,
private-error redaction, permanent failures and successful Member retry after
provider recovery; the focused AI suite passes 84 tests across five files.
API typecheck/build and restarted local smoke checks pass. Provider quota has not
been changed; a successful live answer remains unverified. Screenshot:
`tmp/verification/context-member-ai-rate-limit.png`.

## Prepared next live checks

The user approved steps 1–3 for one disposable key. The first attempt stopped
after its initial ingestion returned HTTP 401, and that key was revoked. The user
then specifically approved one replacement key, and all three steps passed live
after the issuer-filter fix. Step 4 remains unapproved. The plan uses only Context
Test and the generated local database; the original personal Monitoring key is
outside the test scope.

1. Using the original Admin account, create one key named `Context Test QA`.
   Keep its one-time secret private, use it only against the local ingestion route
   and retain no secret in screenshots, repository files or chat.
2. Submit one synthetic `info` event for the existing Payments API, with a unique
   `eventId` and no `status` change. Replay the same event and verify one persisted
   record plus a duplicate response. This adds one team timeline entry.
3. Revoke only `Context Test QA`. A subsequent delivery with a different event ID
   must fail with HTTP 401 and add no data. Verify personal data/key counts remain
   unchanged and the QA key has no active access.
4. Separately, after specific approval, temporarily remove the second test Member.
   Refresh that account's session and verify it cannot select/read Context Test.
   Restore access by sending one new Member invitation to the same user-designated
   account; the user accepts it and signs in. Do not promote either account or
   remove the creator. This does not test a removed admin's issued-key lifecycle;
   current issuer-membership checks remain covered by automated tests.

If an authorized check fails, stop before further writes, preserve safe failure
metadata and revoke the QA key if it was created. Restore the Member invitation
only if that restoration was explicitly authorized. Synthetic evidence is retained;
no deletion/reset is needed.

## First QA-key attempt and issuer-filter correction

The approved `Context Test QA` key was created by the original Admin through the
real application UI. Its initial info delivery returned HTTP 401 and persisted
no event; replay was not attempted. The key was immediately revoked through the
UI. A new delivery with that revoked key also returned 401, with no changes to
services, events, messages or personal key counts. The shared workspace still
has five healthy services, 14 events, six messages and zero active keys. The
one-time secret was kept out of outputs/screenshots and its temporary file was
removed after the rejected-delivery check.

Read-only Clerk verification reproduced the cause: `user_id[]` was ignored, so
`limit=1` returned the newer Member rather than the key's Admin issuer. The query
now uses `user_id`, consistent with the installed SDK's repeated-parameter
serialization and Clerk's documented issuer filter. Corrected live verification
returns exactly the matching Admin. The exact issuer ID and admin role are still
both required; other users, removed/demoted issuers and provider errors cannot
authorize a shared key. No role or membership change was made.

Two regressions cover a newer Member preceding the issuer and an unrelated Admin
being rejected. The focused signed-session/key/ingestion suite passes 39 tests
across six files. API typecheck/build and restarted local smoke checks pass.
Successful shared ingestion and replay remain pending a specifically approved
replacement key. Safe evidence: `tmp/verification/shared-key-first-attempt.json`,
`tmp/verification/qa-membership-inspection.json`,
`tmp/verification/qa-membership-filter-fixed.json` and
`tmp/verification/context-qa-key-revoked.png`.

## Approved replacement-key test completed

The user specifically approved one replacement `Context Test QA` key. It was
created through the signed-in Admin UI after the issuer-filter fix was activated.
The initial synthetic Payments API info event returned HTTP 200 with
`duplicate=false`; replay returned HTTP 200 with `duplicate=true` and the same
event ID. Shared event count increased exactly once, from 14 to 15. The five
services' statuses and update timestamps were unchanged, as were all personal
workspace service/event/message/active-key counts.

The replacement key was revoked through the real UI. Delivery with a different
event ID then returned HTTP 401 and changed no database state. The team has zero
active keys. Its dashboard refresh shows Timeline 21 (15 events and six messages)
and the key-revoked status. Read-only final checks confirm five healthy services,
unchanged personal data and no cross-workspace event/message/dependency links.
The private secret file was removed and in-memory test references discarded.

Safe evidence: `tmp/verification/shared-key-lifecycle.json`,
`tmp/verification/shared-tenant-isolation.json` and
`tmp/verification/context-qa-key-complete.png`. No further key, role change,
invitation, membership removal, Slack message or production mutation occurred.
Remaining live team checks are Member removal/restoration and distinct Slack
destinations; live AI answer generation still awaits Gemini quota/rate recovery.
