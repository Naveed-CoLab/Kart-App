import { hasAnthropic } from "@/lib/config";
import InsightsClient from "./InsightsClient";

export const dynamic = "force-dynamic";

export default function InsightsPage() {
  // AG Studio licence (45-day trial from ag-grid.com); without one Studio still runs, with a watermark.
  return <InsightsClient licenseKey={process.env.AG_STUDIO_LICENSE_KEY || undefined} aiEnabled={hasAnthropic()} />;
}
