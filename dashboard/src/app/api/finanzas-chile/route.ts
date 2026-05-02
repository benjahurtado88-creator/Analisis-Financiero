import { NextResponse } from "next/server";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "public", "data", "finanzas-chile");

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const list = searchParams.get("list");

  try {
    if (list === "1") {
      const files = await readdir(DATA_DIR).catch(() => [] as string[]);
      const dates = files
        .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
        .map((f) => f.replace(/\.json$/, ""))
        .sort()
        .reverse();
      return NextResponse.json({ dates });
    }

    const file = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}.json` : "latest.json";
    const fullPath = path.join(DATA_DIR, file);
    const raw = await readFile(fullPath, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch (err) {
    return NextResponse.json(
      { error: "no_report", message: (err as Error).message },
      { status: 404 },
    );
  }
}
