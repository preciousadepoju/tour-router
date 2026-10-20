import { parsePlanRequest, planBaseline } from "@/lib/agent";
import { llmAvailable } from "@/lib/llm";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** "Without Qloo": the LLM plans the same tour from general knowledge alone. */
export async function POST(req: Request) {
  if (!llmAvailable()) {
    return Response.json(
      { error: "The LLM-only comparison needs ANTHROPIC_API_KEY on the server." },
      { status: 503 },
    );
  }
  const limited = rateLimit(`baseline:${clientIp(req)}`, 8, 10 * 60_000);
  if (!limited.ok) {
    return Response.json(
      { error: `Too many requests. Try again in ${limited.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  try {
    const input = parsePlanRequest(await req.json());
    return Response.json(await planBaseline(input));
  } catch (err) {
    console.error("planBaseline failed:", err);
    return Response.json({ error: (err as Error).message || "Baseline failed." }, { status: 500 });
  }
}
