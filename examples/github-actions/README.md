# Report a deployment to Context

Your existing workflow deploys a service. This example adds a small reporting job afterward so Context can place that deployment beside alerts and response records.

## Before adding the job

You need an existing deployment workflow, a reachable HTTPS Context installation, and an Admin who can create an ingestion key for the intended workspace. Context's repository verification workflow is separate from this example; this job reports a deployment performed by your own repository.

## Add the reporting job

Copy [context-deployment.yml](context-deployment.yml) into the deployment repository's `.github/workflows/` directory. Add two Actions secrets:

- `CONTEXT_INGEST_URL`: the HTTPS Context endpoint ending in `/api/ingest/github-actions`.
- `CONTEXT_WEBHOOK_KEY`: an active key created by that workspace's Admin.

Add this job under `jobs` in the workflow that contains your real `deploy` job:

```yaml
context-report:
  needs: deploy
  if: ${{ always() && (needs.deploy.result == 'success' || needs.deploy.result == 'failure') }}
  uses: ./.github/workflows/context-deployment.yml
  with:
    service: payments-api
    environment: staging
    status: ${{ needs.deploy.result }}
  secrets:
    CONTEXT_INGEST_URL: ${{ secrets.CONTEXT_INGEST_URL }}
    CONTEXT_WEBHOOK_KEY: ${{ secrets.CONTEXT_WEBHOOK_KEY }}
```

Replace `payments-api`, `staging`, and the `deploy` job ID with the values from your workflow. The example caller reports only a successful or failed deployment. Copying the reusable workflow does not deploy a service or start a run by itself.

## Follow the record into the timeline

After you choose to test a real staging deployment, find its record in Context. Check the service, environment, repository, commit SHA, run ID, attempt, and status. Retrying that same identity should add no duplicate; reruns and matrix services have separate identities.

The record reports deployment evidence; it does not mark the service healthy. A successful reporting job proves that Context accepted the delivery, rather than that the deployed service is operating correctly. Cancelled or skipped deployment jobs are not reported by this caller.

Use a disposable key for the first check and revoke it afterward. Hosted delivery needs a reachable HTTPS installation. [Setup and deployment](../../DEPLOYMENT.md) covers that installation and the ingestion key lifecycle.
