const AI = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${AI}/health`, { signal: AbortSignal.timeout(2500), cache: "no-store" });
    return Response.json({ up: res.ok });
  } catch {
    return Response.json({ up: false });
  }
}
