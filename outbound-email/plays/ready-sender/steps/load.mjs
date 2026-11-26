import { loadCampaign } from "../../../lib/steps.mjs";
export default async (ctx) => ({ campaign: await loadCampaign(ctx) });
