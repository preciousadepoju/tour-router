import { TourApp } from "@/components/TourApp";
import { debugEnabled } from "@/lib/agent";
import { llmAvailable } from "@/lib/llm";
import { qlooMode } from "@/lib/qloo/client";

export const dynamic = "force-dynamic";

export default function Page() {
  return <TourApp mode={qlooMode()} llm={llmAvailable()} debug={debugEnabled()} />;
}
