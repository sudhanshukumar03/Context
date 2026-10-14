# Test a shared workspace

A shared workspace is useful only if its members can see the right records and its controls respect their access. This guide follows a team from creation to investigation, then checks what happens when membership or an ingestion key changes.

Use a Clerk Development instance, the isolated local app, and synthetic data. Directory contacts uploaded for onboarding are separate from Clerk membership; adding a directory entry does not grant access.

## Begin with two accounts

Sign in with the first account and create an empty test organization. Its creator should be an Admin. Record what is already in the personal workspace, then select the new team and confirm that personal services, events, and keys are absent.

Invite a designated second test account as a Member. This sends a Clerk email and grants team access when accepted, so use an intended recipient and agree on the invitation before sending it.

Sign in to Context with that second account, select the team, and check its overview, graph, timeline, history, and AI. Changing Engineer/SRE/Manager views should change the investigation surface while leaving Member permissions in place.

## Check both the useful paths and the boundaries

| Check | Expected behavior |
| --- | --- |
| Personal → team → personal | Each workspace shows its own saved records. |
| Reload the team | Selected team and its data load correctly. |
| Member reads | Incident evidence and AI questions are available. |
| Member admin controls | Shared uploads, demo mutations, notification settings, and key management are unavailable. |
| Audience changes | Overview and new AI answers follow the audience; admin access is unchanged. |
| Crafted Member write | The API rejects it even if the request body claims an admin role. |
| Removed Member returns | After refreshing the sign-in state, team access is no longer available. |

Use an empty test team for Run demo because it replaces that team's incident records. Check that all nine synthetic steps complete, then return to the personal workspace and confirm its records remain intact.

## Exercise a disposable ingestion key

With the Admin account, agree on one synthetic event and create a short-lived test key. Send an informational event that does not change service health. Replay the same external event ID and confirm that the response identifies a duplicate and the timeline contains one record.

Revoke the key, then send a new delivery with it. The request should fail and add no records. Store secrets in a private local file while testing, and report only status codes, record counts, and the outcome.

A shared key also depends on its issuing user remaining a team Admin. Removing or demoting that issuing account should reject later deliveries. Provider failures must reject delivery rather than bypass the membership check. Plan this as a separate test with a remaining Admin and a clear restoration path.

## Remove and restore a test Member

Temporary removal changes that account's access, and restoration may send another invitation email. Agree on both actions before starting. Keep the original Admin in place, remove the test Member, verify lost access after refreshing sign-in, then restore the intended Member role and recheck restrictions.

## What has already been exercised

The local Context Test organization was created with an Admin and a second Member. Personal/team switching, the synthetic incident, reload behavior, Member investigation, and visible admin restrictions passed live checks.

An approved disposable-key test saved one informational event, recognized its replay, and rejected delivery after revocation. Temporary Member removal and restoration also passed. Both disposable team keys were revoked afterward.

Native AI generation later succeeded for the Member. Account/workspace notification isolation and issuing-admin membership transitions are covered by automated tests. Actual Slack delivery and an actual Clerk role transition for a key issuer remain separate live checks.

These results are local development evidence. The [verification record](VERIFICATION_2026-10-14.md) separates browser checks from HTTP and database tests; [remaining work](REMAINING_WORK.md) lists the external connections still needed.
