import { screenCandidate } from "../../lib/agent.js";
import { handler, requireFields } from "../../lib/http.js";

export const onRequest = handler("screen", (client, body) => {
  requireFields(body, ["jd", "rubric", "candidate"]);
  return screenCandidate(client, body);
});
