import { onboard } from "../../lib/agent.js";
import { handler, requireFields } from "../../lib/http.js";

export const onRequest = handler("onboard", (client, body) => {
  requireFields(body, ["rubric", "candidate", "screen"]);
  return onboard(client, body);
});
