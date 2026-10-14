# Report a deployment to Context

Your existing workflow deploys a service. This example adds a small reporting job afterward so Context can place that deployment beside alerts and response records.

## Connect the reporting job

Copy `context-deployment.yml` into the deployment repository's `.github/workflows/` directory. Add two Actions secrets:

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

Replace the service, environment, and job ID with the values from your deployment. Copying the example does not deploy a service or start a workflow by itself.

## Follow the record into the timeline

Run an actual staging deployment and find its record in Context. Retrying the same repository/run/attempt/service/environment/status identity should add no duplicate. Reruns and matrix services have separate identities.

The record reports deployment evidence; it does not mark the service healthy. Cancelled or skipped deployment jobs are not reported by this caller.

Use a disposable key for the first check and revoke it afterward. Hosted delivery needs a reachable HTTPS installation. [Setup and deployment](../../DEPLOYMENT.md) covers that installation and the ingestion key lifecycle.
