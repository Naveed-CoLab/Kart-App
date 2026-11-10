"use client";
import dynamic from "next/dynamic";

// AG Studio runs in the browser only.
const InsightsDashboard = dynamic(() => import("@/components/insights/InsightsDashboard"), {
  ssr: false,
  loading: () => <div className="shimmer m-4 h-64 rounded-[14px]" />,
});

export default function InsightsClient(props: { licenseKey?: string; aiEnabled: boolean }) {
  return (
    <div className="min-h-0 flex-1">
      <InsightsDashboard {...props} />
    </div>
  );
}
