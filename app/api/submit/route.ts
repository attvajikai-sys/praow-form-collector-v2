import { NextResponse } from "next/server";

type IncomingPayload = {
  type: "personal" | "reseller";
  name?: string;
  phone?: string;
  address?: string;
  location?: string;
  source?: string;
};

function normalizePhone(phoneRaw: string) {
  return (phoneRaw || "").replace(/\D/g, "");
}

function isThaiPhone(phoneRaw: string) {
  return /^0\d{9}$/.test(normalizePhone(phoneRaw));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IncomingPayload;
    const scriptUrl = process.env.GOOGLE_SCRIPT_WEBAPP_URL;

    if (!scriptUrl) {
      return NextResponse.json(
        { ok: false, error: "Missing GOOGLE_SCRIPT_WEBAPP_URL" },
        { status: 500 }
      );
    }

    if (!body?.type || !["personal", "reseller"].includes(body.type)) {
      return NextResponse.json({ ok: false, error: "Invalid request type" }, { status: 400 });
    }

    const name = (body.name ?? "").trim();
    const phone = normalizePhone(body.phone ?? "");
    const source = (body.source ?? "praow-form-web-v2").trim();

    if (!name) {
      return NextResponse.json({ ok: false, error: "กรุณากรอกชื่อ" }, { status: 400 });
    }

    if (!isThaiPhone(phone)) {
      return NextResponse.json(
        { ok: false, error: "กรุณากรอกเบอร์โทร 10 หลัก (ขึ้นต้นด้วย 0)" },
        { status: 400 }
      );
    }

    let address = "";
    let location = "";

    if (body.type === "personal") {
      address = (body.address ?? "").trim();
      if (!address) {
        return NextResponse.json({ ok: false, error: "กรุณากรอกที่อยู่" }, { status: 400 });
      }
    }

    if (body.type === "reseller") {
      location = (body.location ?? "").trim();
      if (!location) {
        return NextResponse.json({ ok: false, error: "กรุณากรอกพิกัดร้านค้า" }, { status: 400 });
      }
    }

    const forwardPayload = {
      type: body.type,
      name,
      phone,
      address,
      location,
      source,
      createdAt: new Date().toISOString(),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(forwardPayload),
        signal: controller.signal,
        cache: "no-store",
      });

      const text = await res.text();

      if (!res.ok) {
        console.error("Apps Script HTTP error:", res.status, text);
        return NextResponse.json(
          { ok: false, error: `Apps Script error (${res.status})` },
          { status: 502 }
        );
      }

      return NextResponse.json({ ok: true, upstream: text });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    console.error("Submit route error:", err);
    const message = err instanceof Error ? err.message : "ส่งข้อมูลไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
