import { isSlackWebhookUrl } from "./workspace-preferences";

export type SlackApiRequest = (path: string, token: string | null, options?: RequestInit) => Promise<unknown>;

/** A token lookup must not transfer a notification to a later workspace/session. */
export async function sendWorkspaceSlack(
  webhookUrl: string,
  text: string,
  getToken: () => Promise<string | null>,
  isCurrent: () => boolean,
  request: SlackApiRequest,
): Promise<boolean> {
  if (!isCurrent()) return false;
  if (!isSlackWebhookUrl(webhookUrl)) throw new Error("A valid Slack incoming webhook URL is required");
  const token = await getToken();
  if (!isCurrent()) return false;
  await request("/notify/slack", token, { method: "POST", body: JSON.stringify({ webhookUrl, text }) });
  return isCurrent();
}
