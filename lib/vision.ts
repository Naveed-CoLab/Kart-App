import Anthropic from "@anthropic-ai/sdk";
import { readUpload } from "./files";
import { config, hasAnthropic } from "./config";
import type { VisionResult } from "./types";

export function anthropic() {
  return new Anthropic({ apiKey: config.anthropicKey });
}

/** Ask Claude to judge a damage photo against the ordered product. */
export async function inspectDamagePhoto(opts: {
  imagePath: string;
  mediaType: string;
  productTitle: string;
  productImage?: string | null;
  reason: string;
}): Promise<VisionResult> {
  if (!hasAnthropic()) throw new Error("Claude isn't set up: add ANTHROPIC_API_KEY to .env.local and restart.");
  const buf = await readUpload(opts.imagePath);
  if (!buf) throw new Error("The claim photo is missing. Attach it again.");
  const data = buf.toString("base64");
  const content: Anthropic.ContentBlockParam[] = [
    { type: "text", text: `Ordered product: "${opts.productTitle}". Shopper's complaint: "${opts.reason}".\nImage 1 is the shopper's photo of what arrived.` },
    { type: "image", source: { type: "base64", media_type: opts.mediaType as "image/jpeg", data } },
  ];
  if (opts.productImage?.startsWith("http")) {
    content.push({ type: "text", text: "Image 2 is the store's product photo for reference." });
    content.push({ type: "image", source: { type: "url", url: opts.productImage } });
  }
  content.push({
    type: "text",
    text: `You are a damage-claim inspector. Reply with ONLY a JSON object:
{"damage_visible": boolean, "matches_product": boolean, "confidence": number 0-1 (how sure you are of BOTH judgments), "summary": "one short sentence describing what you see"}
matches_product = the photo plausibly shows the same type of product as ordered (exact model match not required).`,
  });
  const ask = async (blocks: Anthropic.ContentBlockParam[]) => {
    const r = await anthropic().messages.create({ model: config.model, max_tokens: 300, messages: [{ role: "user", content: blocks }] });
    const text = r.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("vision: no JSON in reply");
    const j = JSON.parse(m[0]);
    return {
      damage_visible: !!j.damage_visible,
      matches_product: !!j.matches_product,
      confidence: Math.max(0, Math.min(1, Number(j.confidence) || 0)),
      summary: String(j.summary || "").slice(0, 240),
    } satisfies VisionResult;
  };
  try {
    return await ask(content);
  } catch (e) {
    // Reference image URL may be unreachable for the API; retry with the shopper photo only.
    console.warn("[vision] retrying without reference image:", (e as Error).message);
    return ask(content.filter((b) => !(b.type === "image" && b.source.type === "url")).filter((b) => !(b.type === "text" && b.text.startsWith("Image 2"))));
  }
}
