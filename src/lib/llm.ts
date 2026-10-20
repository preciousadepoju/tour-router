import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Thin, swappable LLM wrapper. The rest of the app only sees `LLM.json()`, so moving to a
 * different provider means re-implementing this one function.
 */
export interface LLM {
  readonly model: string;
  json<T>(opts: { system: string; prompt: string; schema: Record<string, unknown>; maxTokens?: number }): Promise<T>;
}

export class LLMUnavailableError extends Error {}

export function llmAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | undefined;

export function getLLM(): LLM {
  if (!llmAvailable()) throw new LLMUnavailableError("ANTHROPIC_API_KEY is not set");
  client ??= new Anthropic();
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

  return {
    model,
    async json<T>({ system, prompt, schema, maxTokens = 16000 }: {
      system: string;
      prompt: string;
      schema: Record<string, unknown>;
      maxTokens?: number;
    }): Promise<T> {
      const response = await client!.beta.messages.create({
        model,
        max_tokens: maxTokens,
        // Short, explain-only writing: low effort keeps latency and cost down.
        output_config: { effort: "low", format: { type: "json_schema", schema } },
        // If a safety classifier declines, the API retries on a suitable model in the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        messages: [{ role: "user", content: prompt }],
      });

      if (response.stop_reason === "refusal") throw new Error("The model declined this request");
      if (response.stop_reason === "max_tokens") throw new Error("The model response was cut off");
      const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      return JSON.parse(text) as T;
    },
  };
}
