"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Step = "home" | "personal" | "reseller" | "success";
type FormMode = "personal" | "reseller" | null;

type PersonalForm = {
  name: string;
  phone: string; // digits only (max 10)
  address: string;
  qtySmall: number;   // 350ml
  qtyMedium: number;  // 600ml
  qtyLarge: number;   // 1500ml
};

type ResellerForm = {
  shopName: string;
  contactName: string;
  location: string;
  phone: string; // digits only (max 10)
  qtySmall: number;
  qtyMedium: number;
  qtyLarge: number;
};



const maskedPhone = (value: string) => {
  const digits = (value || "").replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export default function Page() {
  const [step, setStep] = useState<Step>("home");
  const [mode, setMode] = useState<FormMode>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successText, setSuccessText] = useState("");

  const [personal, setPersonal] = useState<PersonalForm>({ name: "", phone: "", address: "", qtySmall: 0, qtyMedium: 0, qtyLarge: 0 });
  const [reseller, setReseller] = useState<ResellerForm>({ shopName: "", contactName: "", location: "", phone: "", qtySmall: 0, qtyMedium: 0, qtyLarge: 0 });

  // anti-spam
  const [websiteField, setWebsiteField] = useState(""); // honeypot
  const lastSubmitRef = useRef<number>(0);

  const title = useMemo(() => {
    if (step === "personal") return "ที่อยู่อาศัย (สำหรับดื่ม)";
    if (step === "reseller") return "ร้านค้า (จำหน่าย)";
    if (step === "success") return "ส่งข้อมูลสำเร็จ";
    return "น้ำพราว";
  }, [step]);

  const validateThaiPhone = (phoneRaw: string) => {
    const phone = (phoneRaw || "").replace(/\D/g, "");
    return /^0\d{9}$/.test(phone); // 10 digits, starts with 0
  };

  const checkAntiSpam = () => {
    if (websiteField.trim()) throw new Error("Spam detected");
    const now = Date.now();
    const cooldownMs = 4000;
    if (now - lastSubmitRef.current < cooldownMs) {
      throw new Error("กรุณารอสักครู่ก่อนส่งข้อมูลอีกครั้ง");
    }
    lastSubmitRef.current = now;
  };

  const resetForms = () => {
    setPersonal({ name: "", phone: "", address: "", qtySmall: 0, qtyMedium: 0, qtyLarge: 0 });
    setReseller({ shopName: "", contactName: "", location: "", phone: "", qtySmall: 0, qtyMedium: 0, qtyLarge: 0 });
    setWebsiteField("");
  };

  // ✅ Key fix: If request aborts (timeout) but sheet still receives data,
  // treat it as likely-success and show success UI to avoid duplicates.
  const sendSubmit = async (payload: Record<string, unknown>) => {
    const controller = new AbortController();
    const timeoutMs = 45000; // Apps Script can be slow, give more time
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok || !data.ok) {
        return { ok: false as const, uncertain: false as const, error: data?.error || `ส่งข้อมูลไม่สำเร็จ (${res.status})` };
      }

      return { ok: true as const, uncertain: false as const };
    } catch (err: any) {
      if (err?.name === "AbortError") {
        // likely succeeded server-side even though client timed out
        return { ok: true as const, uncertain: true as const };
      }
      return { ok: false as const, uncertain: false as const, error: err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่" };
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const onSubmitPersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      checkAntiSpam();

      if (!personal.name.trim()) throw new Error("กรุณากรอกชื่อ");
      if (!validateThaiPhone(personal.phone)) throw new Error("กรุณากรอกเบอร์โทร 10 หลัก (ขึ้นต้นด้วย 0)");
      if (!personal.address.trim()) throw new Error("กรุณากรอกที่อยู่");
      if (personal.qtySmall + personal.qtyMedium + personal.qtyLarge === 0) throw new Error("กรุณาเลือกสินค้าอย่างน้อย 1 รายการ");

      setLoading(true);

      const orderParts = [];
      if (personal.qtySmall > 0) orderParts.push(`เล็ก 350ml x${personal.qtySmall} แพ็ค`);
      if (personal.qtyMedium > 0) orderParts.push(`กลาง 600ml x${personal.qtyMedium} แพ็ค`);
      if (personal.qtyLarge > 0) orderParts.push(`ใหญ่ 1500ml x${personal.qtyLarge} แพ็ค`);

      const payload = {
        type: "ซื้อดื่มเอง",
        name: personal.name.trim(),
        phone: personal.phone.replace(/\D/g, ""), // digits; API formats for sheet
        address: personal.address.trim(),
        order: orderParts.join(", "),
        source: "praow-form-web",
        createdAt: new Date().toISOString().slice(0, 10),
      };

      const result = await sendSubmit(payload);

      if (!result.ok) throw new Error(result.error);

      setSuccessText(
        result.uncertain
          ? "รับข้อมูลแล้วค่ะ 💙 (ระบบอาจตอบกลับช้า) ถ้าไม่มั่นใจ กรุณารอสักครู่ก่อนกดส่งซ้ำ เพื่อป้องกันข้อมูลซ้ำ"
          : "ขอบคุณค่ะ 💙 พนักงานขายจะติดต่อกลับด้วยหมายเลข 096-303-0616"
      );

      setMode("personal");
      setStep("success");
      resetForms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  const onSubmitReseller = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      checkAntiSpam();

      if (!reseller.shopName.trim()) throw new Error("กรุณากรอกชื่อร้านค้า");
      if (!reseller.contactName.trim()) throw new Error("กรุณากรอกชื่อผู้ติดต่อ");
      if (!reseller.location.trim()) throw new Error("กรุณากรอกพิกัดร้านค้า");
      if (!validateThaiPhone(reseller.phone)) throw new Error("กรุณากรอกเบอร์โทร 10 หลัก (ขึ้นต้นด้วย 0)");
      if (reseller.qtySmall + reseller.qtyMedium + reseller.qtyLarge === 0) throw new Error("กรุณาเลือกสินค้าอย่างน้อย 1 รายการ");

      setLoading(true);

      const resellerOrderParts = [];
      if (reseller.qtySmall > 0) resellerOrderParts.push(`เล็ก 350ml x${reseller.qtySmall} แพ็ค`);
      if (reseller.qtyMedium > 0) resellerOrderParts.push(`กลาง 600ml x${reseller.qtyMedium} แพ็ค`);
      if (reseller.qtyLarge > 0) resellerOrderParts.push(`ใหญ่ 1500ml x${reseller.qtyLarge} แพ็ค`);

      const payload = {
        type: "จำหน่าย",
        name: reseller.shopName.trim(),
        contactName: reseller.contactName.trim(),
        location: reseller.location.trim(),
        phone: reseller.phone.replace(/\D/g, ""),
        order: resellerOrderParts.join(", "),
        source: "praow-form-web",
        createdAt: new Date().toISOString().slice(0, 10),
      };

      const result = await sendSubmit(payload);

      if (!result.ok) throw new Error(result.error);

      setSuccessText(
        result.uncertain
          ? "รับข้อมูลแล้วค่ะ 💙 (ระบบอาจตอบกลับช้า) ถ้าไม่มั่นใจ กรุณารอสักครู่ก่อนกดส่งซ้ำ เพื่อป้องกันข้อมูลซ้ำ"
          : "ขอบคุณค่ะ 💙 ฝ่ายขายจะติดต่อกลับเพื่อประเมินพื้นที่และเงื่อนไขการจำหน่าย"
      );

      setMode("reseller");
      setStep("success");
      resetForms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-praow-50 via-white to-white p-4 md:p-8 flex items-center justify-center">
      <div className="absolute inset-0 pointer-events-none opacity-70">
        <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-blue-200 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-100 blur-3xl" />
      </div>

      <section className="relative w-full max-w-xl rounded-[28px] border border-blue-100 bg-white/95 shadow-soft p-5 md:p-8">
        <header className="text-center mb-5">
          <div className="mx-auto mb-3 h-20 w-20 rounded-2xl bg-white border border-blue-100 shadow-lg overflow-hidden flex items-center justify-center">
            <Image src="/praow-logo.png" alt="PRAOW" width={80} height={80} className="object-contain" priority />
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-praow-700">{title}</h1>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="hidden" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            tabIndex={-1}
            autoComplete="off"
            value={websiteField}
            onChange={(e) => setWebsiteField(e.target.value)}
          />
        </div>

        <AnimatePresence mode="wait">
          {step === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <button
                onClick={() => {
                  setMode("personal");
                  setStep("personal");
                  setError("");
                }}
                className="group w-full rounded-2xl bg-praow-600 hover:bg-praow-700 active:scale-[0.99] transition text-white p-4 text-left"
              >
                <div className="font-semibold text-lg">ที่อยู่อาศัย (สำหรับดื่ม)</div>
              </button>

              <button
                onClick={() => {
                  setMode("reseller");
                  setStep("reseller");
                  setError("");
                }}
                className="group w-full rounded-2xl border-2 border-praow-600 hover:bg-praow-50 active:scale-[0.99] transition p-4 text-left"
              >
                <div className="font-semibold text-lg text-praow-700">ร้านค้า (จำหน่าย)</div>
              </button>
            </motion.div>
          )}

          {step === "personal" && (
            <motion.form
              key="personal"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              onSubmit={onSubmitPersonal}
              className="space-y-4"
            >
              <Field label="ชื่อ">
                <input
                  required
                  value={personal.name}
                  onChange={(e) => setPersonal({ ...personal, name: e.target.value })}
                  className={inputClass}
                  placeholder="กรอกชื่อ"
                />
              </Field>

              <Field label="เบอร์โทร">
                <input
                  required
                  inputMode="numeric"
                  value={maskedPhone(personal.phone)}
                  onChange={(e) =>
                    setPersonal({
                      ...personal,
                      phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                    })
                  }
                  className={inputClass}
                  placeholder="0xx-xxx-xxxx"
                />
                <p className="mt-1 text-xs text-slate-500">ตัวอย่าง 081-234-5678</p>
              </Field>

              <Field label="ที่อยู่">
                <textarea
                  required
                  value={personal.address}
                  onChange={(e) => setPersonal({ ...personal, address: e.target.value })}
                  className={`${inputClass} min-h-[92px] resize-y`}
                  placeholder="กรุณาระบุ ตำบล/อำเภอ/จังหวัด"
                />
              </Field>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">จำนวนสินค้า</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: "qtySmall" as const, label: "เล็ก", ml: "350 ml", pack: "12 ขวด/แพ็ค" },
                    { key: "qtyMedium" as const, label: "กลาง", ml: "600 ml", pack: "12 ขวด/แพ็ค" },
                    { key: "qtyLarge" as const, label: "ใหญ่", ml: "1500 ml", pack: "6 ขวด/แพ็ค" },
                  ].map(({ key, label, ml, pack }) => (
                    <div key={key} className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 flex flex-col items-center gap-2">
                      <div className="text-center">
                        <div className="font-semibold text-praow-700 text-sm">{label}</div>
                        <div className="text-xs text-slate-500">{ml}</div>
                        <div className="text-xs text-slate-400">{pack}</div>
                      </div>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={personal[key] === 0 ? "" : personal[key]}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setPersonal((p) => ({ ...p, [key]: Math.max(0, val) }));
                        }}
                        placeholder="0"
                        className="w-full rounded-lg border border-blue-200 px-2 py-1.5 text-center text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 bg-white"
                      />
                    </div>
                  ))}
                </div>
                {personal.qtySmall + personal.qtyMedium + personal.qtyLarge > 0 && (
                  <p className="mt-2 text-xs text-praow-700 font-medium">
                    รวม: {[
                      personal.qtySmall > 0 && `เล็ก ×${personal.qtySmall}`,
                      personal.qtyMedium > 0 && `กลาง ×${personal.qtyMedium}`,
                      personal.qtyLarge > 0 && `ใหญ่ ×${personal.qtyLarge}`,
                    ].filter(Boolean).join("  •  ")} แพ็ค
                  </p>
                )}
              </div>

              <ActionButtons loading={loading} onBack={() => { setStep("home"); setError(""); }} />
            </motion.form>
          )}

          {step === "reseller" && (
            <motion.form
              key="reseller"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              onSubmit={onSubmitReseller}
              className="space-y-4"
            >
              <Field label="ชื่อร้านค้า">
                <input
                  required
                  value={reseller.shopName}
                  onChange={(e) => setReseller({ ...reseller, shopName: e.target.value })}
                  className={inputClass}
                  placeholder="เช่น ร้านพราวชุมพร"
                />
              </Field>

              <Field label="ชื่อผู้ติดต่อ">
                <input
                  required
                  value={reseller.contactName}
                  onChange={(e) => setReseller({ ...reseller, contactName: e.target.value })}
                  className={inputClass}
                  placeholder="กรอกชื่อผู้ติดต่อ"
                />
              </Field>

              <Field label="พิกัดร้านค้า">
                <input
                  required
                  value={reseller.location}
                  onChange={(e) => setReseller({ ...reseller, location: e.target.value })}
                  className={inputClass}
                  placeholder="เช่น ปากน้ำชุมพร / ปังหวาน / นาสัก"
                />
              </Field>

              <Field label="เบอร์โทร">
                <input
                  required
                  inputMode="numeric"
                  value={maskedPhone(reseller.phone)}
                  onChange={(e) =>
                    setReseller({
                      ...reseller,
                      phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                    })
                  }
                  className={inputClass}
                  placeholder="0xx-xxx-xxxx"
                />
                <p className="mt-1 text-xs text-slate-500">ตัวอย่าง 081-234-5678</p>
              </Field>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">จำนวนสินค้า</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: "qtySmall" as const, label: "เล็ก", ml: "350 ml", pack: "12 ขวด/แพ็ค" },
                    { key: "qtyMedium" as const, label: "กลาง", ml: "600 ml", pack: "12 ขวด/แพ็ค" },
                    { key: "qtyLarge" as const, label: "ใหญ่", ml: "1500 ml", pack: "6 ขวด/แพ็ค" },
                  ].map(({ key, label, ml, pack }) => (
                    <div key={key} className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 flex flex-col items-center gap-2">
                      <div className="text-center">
                        <div className="font-semibold text-praow-700 text-sm">{label}</div>
                        <div className="text-xs text-slate-500">{ml}</div>
                        <div className="text-xs text-slate-400">{pack}</div>
                      </div>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={reseller[key] === 0 ? "" : reseller[key]}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setReseller((p) => ({ ...p, [key]: Math.max(0, val) }));
                        }}
                        placeholder="0"
                        className="w-full rounded-lg border border-blue-200 px-2 py-1.5 text-center text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 bg-white"
                      />
                    </div>
                  ))}
                </div>
                {reseller.qtySmall + reseller.qtyMedium + reseller.qtyLarge > 0 && (
                  <p className="mt-2 text-xs text-praow-700 font-medium">
                    รวม: {[
                      reseller.qtySmall > 0 && `เล็ก ×${reseller.qtySmall}`,
                      reseller.qtyMedium > 0 && `กลาง ×${reseller.qtyMedium}`,
                      reseller.qtyLarge > 0 && `ใหญ่ ×${reseller.qtyLarge}`,
                    ].filter(Boolean).join("  •  ")} แพ็ค
                  </p>
                )}
              </div>

              <ActionButtons loading={loading} onBack={() => { setStep("home"); setError(""); }} />
            </motion.form>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 text-center"
            >
              <div className="mx-auto h-16 w-16 rounded-full bg-blue-100 grid place-items-center text-2xl">✅</div>
              <p className="text-slate-700">{successText}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep("home");
                    setMode(null);
                    setError("");
                  }}
                  className="w-full rounded-xl border border-blue-200 py-3 text-praow-700 font-medium hover:bg-blue-50"
                >
                  กลับหน้าแรก
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-6 text-center text-xs text-slate-400">
          PRAOW • Customer intake form (Google Sheet + Vercel)
        </footer>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function ActionButtons({ loading, onBack }: { loading: boolean; onBack: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 pt-2">
      <button
        type="button"
        onClick={onBack}
        className="rounded-xl border border-blue-200 py-3 font-medium text-praow-700 hover:bg-blue-50 transition"
      >
        ย้อนกลับ
      </button>
      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-praow-600 py-3 font-semibold text-white hover:bg-praow-700 transition disabled:opacity-60"
      >
        {loading ? "กำลังส่ง..." : "ส่งข้อมูล"}
      </button>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-blue-200 px-4 py-3 outline-none transition focus:ring-2 focus:ring-blue-300 focus:border-blue-300 bg-white";