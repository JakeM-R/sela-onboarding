import { buildRubric } from "../../lib/agent.js";
import { handler, requireFields } from "../../lib/http.js";

export const onRequest = handler("rubric", (client, body) => {
  requireFields(body, ["jd"]);
  return buildRubric(client, body);
});
