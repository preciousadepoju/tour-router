import { parsePlanRequest, planTour } from "@/lib/agent";
import type { AgentEvent } from "@/lib/plan-types";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Streams agent progress as newline-delimited JSON, ending with a `plan` or `error` event. */
export async function POST(req: Request) {
  const limited = rateLimit(`plan:${clientIp(req)}`, 12, 10 * 60_000);
  if (!limited.ok) {
    return Response.json(
      { error: `Too many tours planned. Try again in ${limited.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  let input;
  try {
    input = parsePlanRequest(await req.json());
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: AgentEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        send({ type: "plan", plan: await planTour(input, send) });
      } catch (err) {
        console.error("planTour failed:", err);
        send({ type: "error", message: (err as Error).message || "Planning failed." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
