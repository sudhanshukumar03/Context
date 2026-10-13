# Connect an actual deployment workflow

Copy `context-deployment.yml` into `.github/workflows/` in the repository that
deploys your services. Add two Actions secrets there:

- `CONTEXT_INGEST_URL`: your HTTPS Context URL ending in `/api/ingest/github-actions`.
- `CONTEXT_WEBHOOK_KEY`: an active Context ingestion key created by the workspace Admin.

Add this job to the workflow that already contains your real `deploy` job:

```yaml
  context-report:
    needs: deploy
    if: ${{ always() && (needs.deploy.result == 'success' || needs.deploy.result == 'failure') }}
    uses: ./.github/workflows/context-deployment.yml
    with:
      service: payments-api
      environment: staging
      status: ${{ needs.deploy.result == 'success' && 'success' || 'failure' }}
    secrets:
      CONTEXT_INGEST_URL: ${{ secrets.CONTEXT_INGEST_URL }}
      CONTEXT_WEBHOOK_KEY: ${{ secrets.CONTEXT_WEBHOOK_KEY }}
```

Replace the service/environment and `deploy` job ID with actual values. Adding
the reusable workflow alone does not deploy anything or emit an event. Do not
claim successful deployment from a placeholder `echo` step. Cancelled/skipped
deployments are not reported as failures by this example.

Verify one actual staging deployment in Context's timeline. Delivery retries use
the same repository/run/attempt/service/environment/status identity, so replay
adds no event. Matrix services and reruns have distinct identities. Deployment
success is evidence; it never marks a service healthy. Revoke the disposable test
key after verification. Local tests cover payload validation, replay and key
authorization; an actual hosted delivery still requires the repository, HTTPS
destination and secrets. No repository secrets are printed or committed.
