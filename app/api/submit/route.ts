import { NextResponse } from "next/server";

type IncomingPayload = {
  type?: string;
  name?: string;
  phone?: string;
  address?: string;
  location?: string;
  contactName?: string;
  order?: string;
  source?: string;
  createdAt?: string;
};

function normalizeType(typeRaw: string): "ซื้อดื่มเอง" | "จำหน่าย" | null {
  const t = (typeRaw || "").trim().toLowerCase();
  if (t === "personal" || t === "ซื้อดื่มเอง") return "ซื้อดื่มเอง";
  if (t === "reseller" || t === "จำหน่าย") return "จำหน่าย";
  return null;
}

function normalizeThaiPhoneDigits(phoneRaw: string) {
  let digits = (phoneRaw || "").replace(/\D/g, "");
  if (digits.length === 9) digits = "0" + digits;
  return digits.slice(0, 10);
}

function formatThaiPhone(phoneRaw: string) {
  const digits = normalizeThaiPhoneDigits(phoneRaw);
  if (digits.length !== 10) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

async function forwardToAppsScript(scriptUrl: string, payload: any) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await res.text();
    if (!res.ok) {
      console.error("Apps Script error:", res.status, text);
    }
  } catch (e: any) {
    console.error("Apps Script forward failed:", e?.name || e, e?.message || "");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IncomingPayload;
    const scriptUrl = process.env.GOOGLE_SCRIPT_WEBAPP_URL;

    if (!scriptUrl) {
      return NextResponse.json({ ok: false, error: "Missing GOOGLE_SCRIPT_WEBAPP_URL" }, { status: 500 });
    }

    const typeThai = normalizeType(body?.type ?? "");
    if (!typeThai) return NextResponse.json({ ok: false, error: "Invalid type" }, { status: 400 });

    const name = (body.name ?? "").trim();
    const phoneRaw = (body.phone ?? "").trim();
    const createdAt = (body.createdAt ?? "").trim();

    if (!name) return NextResponse.json({ ok: false, error: "กรุณากรอกชื่อ" }, { status: 400 });
    if (!phoneRaw) return NextResponse.json({ ok: false, error: "กรุณากรอกเบอร์โทร" }, { status: 400 });

    const digits = normalizeThaiPhoneDigits(phoneRaw);
    if (!/^0\d{9}$/.test(digits)) {
      return NextResponse.json({ ok: false, error: "กรุณากรอกเบอร์โทรให้ถูกต้อง" }, { status: 400 });
    }

    if (typeThai === "ซื้อดื่มเอง") {
      const address = (body.address ?? "").trim();
      if (!address) return NextResponse.json({ ok: false, error: "กรุณากรอกที่อยู่" }, { status: 400 });
    } else {
      const location = (body.location ?? "").trim();
      if (!location) return NextResponse.json({ ok: false, error: "กรุณากรอกพิกัดร้านค้า" }, { status: 400 });
    }

    // ✅ Forward ALL fields — do not reconstruct manually
    const forwardPayload = {
      type: typeThai,
      name,
      phone: formatThaiPhone(phoneRaw),
      address: (body.address ?? "").trim(),
      location: (body.location ?? "").trim(),
      contactName: (body.contactName ?? "").trim(),
      order: (body.order ?? "").trim(),
      source: (body.source ?? "praow-form-web").trim(),
      createdAt: createdAt || new Date().toISOString().slice(0, 10),
    };

    await forwardToAppsScript(scriptUrl, forwardPayload);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Submit route error:", err);
    return NextResponse.json({ ok: false, error: "ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}