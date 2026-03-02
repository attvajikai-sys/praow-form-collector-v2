import { NextResponse } from "next/server";

type IncomingPayload = {
  type?: string; // accept both English/Thai
  name?: string;
  phone?: string; // can be digits or formatted
  address?: string;
  location?: string;
  source?: string;
  createdAt?: string;
};

function normalizeType(typeRaw: string): "ซื้อดื่มเอง" | "จำหน่าย" | null {
  const t = (typeRaw || "").trim().toLowerCase();

  if (t === "personal" || t === "ซื้อดื่มเอง") return "ซื้อดื่มเอง";
  if (t === "reseller" || t === "จำหน่าย") return "จำหน่าย";
  return null;
}

/** Add leading 0 if missing and return 10 digits max */
function normalizeThaiPhoneDigits(phoneRaw: string) {
  let digits = (phoneRaw || "").replace(/\D/g, "");
  if (digits.length === 9) digits = "0" + digits; // auto add leading 0
  return digits.slice(0, 10);
}

/** Return 0xx-xxx-xxxx */
function formatThaiPhone(phoneRaw: string) {
  const digits = normalizeThaiPhoneDigits(phoneRaw);
  if (digits.length !== 10) return digits; // fallback if user typed weird number
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
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

    const typeThai = normalizeType(body?.type ?? "");
    if (!typeThai) {
      return NextResponse.json(
        { ok: false, error: `Invalid type: ${body?.type ?? ""}` },
        { status: 400 }
      );
    }

    const name = (body.name ?? "").trim();
    const phoneRaw = (body.phone ?? "").trim();
    const source = (body.source ?? "praow-form-web").trim();
    const createdAt = (body.createdAt ?? "").trim();

    if (!name) return NextResponse.json({ ok: false, error: "กรุณากรอกชื่อ" }, { status: 400 });
    if (!phoneRaw) return NextResponse.json({ ok: false, error: "กรุณากรอกเบอร์โทร" }, { status: 400 });

    // ✅ Always format for sheet
    const phone = formatThaiPhone(phoneRaw);

    // Optional strict validation (recommended): must become 10 digits starting with 0
    const digits = normalizeThaiPhoneDigits(phoneRaw);
    if (!/^0\d{9}$/.test(digits)) {
      return NextResponse.json(
        { ok: false, error: "กรุณากรอกเบอร์โทรให้ถูกต้อง" },
        { status: 400 }
      );
    }

    if (typeThai === "ซื้อดื่มเอง") {
      const address = (body.address ?? "").trim();
      if (!address) return NextResponse.json({ ok: false, error: "กรุณากรอกที่อยู่" }, { status: 400 });
    } else {
      const location = (body.location ?? "").trim();
      if (!location) return NextResponse.json({ ok: false, error: "กรุณากรอกพิกัดร้านค้า" }, { status: 400 });
    }

    const forwardPayload = {
      type: typeThai, // ✅ Thai only
      name,
      phone, // ✅ 065-998-2835
      address: (body.address ?? "").trim(),
      location: (body.location ?? "").trim(),
      source,
      createdAt: createdAt || new Date().toISOString().slice(0, 10),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(forwardPayload),
        signal: controller.signal,
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
    const msg = err instanceof Error ? err.message : "ส่งข้อมูลไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}