import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const scriptUrl = process.env.GOOGLE_SCRIPT_WEBAPP_URL;

    if (!scriptUrl) {
      return NextResponse.json({ ok: false, error: "Missing GOOGLE_SCRIPT_WEBAPP_URL" }, { status: 500 });
    }

    const res = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store"
    });

    const text = await res.text();

    return NextResponse.json({ ok: true, sheetResponse: text });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Sync failed" }, { status: 500 });
  }
}
