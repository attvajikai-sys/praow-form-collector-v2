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
};

type ResellerForm = {
  shopName: string;
  location: string;
  phone: string; // digits only (max 10)
};

const LOCATION_CHIPS = ["ปากน้ำชุมพร", "ปังหวาน", "นาสัก", "ท่ายาง", "ในเมือง"];

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

  const [personal, setPersonal] = useState<PersonalForm>({ name: "", phone: "", address: "" });
  const [reseller, setReseller] = useState<ResellerForm>({ shopName: "", location: "", phone: "" });

  // anti-spam
  const [websiteField, setWebsiteField] = useState(""); // honeypot
  const lastSubmitRef = useRef<number>(0);

  const title = useMemo(() => {
    if (step === "personal") return "ซื้อดื่มเอง";
    if (step === "reseller") return "จำหน่าย";
    if (step === "success") return "ส่งข้อมูลสำเร็จ";
    return "น้ำพราวยินดีรับใช้ค่ะ";
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
    setPersonal({ name: "", phone: "", address: "" });
    setReseller({ shopName: "", location: "", phone: "" });
    setWebsiteField("");
  };

  const sendSubmit = async (payload: Record<string, unknown>) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || `ส่งข้อมูลไม่สำเร็จ (${res.status})`);
      }
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

      setLoading(true);

      const payload = {
        type: "ซื้อดื่มเอง",
        name: personal.name.trim(),
        phone: personal.phone.replace(/\D/g, ""), // digits only (API can format)
        address: personal.address.trim(),
        source: "praow-form-web",
        createdAt: new Date().toISOString().slice(0, 10),
      };

      await sendSubmit(payload);

      setSuccessText("ขอบคุณค่ะ 💙 ทีมงานจะติดต่อกลับเพื่อยืนยันออเดอร์โดยเร็วที่สุด");
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
      if (!reseller.location.trim()) throw new Error("กรุณากรอกพิกัดร้านค้า");
      if (!validateThaiPhone(reseller.phone)) throw new Error("กรุณากรอกเบอร์โทร 10 หลัก (ขึ้นต้นด้วย 0)");

      setLoading(true);

      const payload = {
        type: "จำหน่าย",
        name: reseller.shopName.trim(),
        location: reseller.location.trim(),
        phone: reseller.phone.replace(/\D/g, ""), // digits only (API can format)
        source: "praow-form-web",
        createdAt: new Date().toISOString().slice(0, 10),
      };

      await sendSubmit(payload);

      setSuccessText("ขอบคุณค่ะ 💙 ฝ่ายขายจะติดต่อกลับเพื่อประเมินพื้นที่และเงื่อนไขการจำหน่าย");
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
          <p className="text-sm text-slate-500 mt-2">เลือกประเภทการติดต่อและกรอกข้อมูลได้เลยค่ะ</p>
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
                <div className="font-semibold text-lg">ซื้อดื่มเอง</div>
                <div className="text-blue-100 text-sm mt-0.5">สำหรับลูกค้าที่ต้องการสั่งซื้อใช้งานเอง</div>
              </button>

              <button
                onClick={() => {
                  setMode("reseller");
                  setStep("reseller");
                  setError("");
                }}
                className="group w-full rounded-2xl border-2 border-praow-600 hover:bg-praow-50 active:scale-[0.99] transition p-4 text-left"
              >
                <div className="font-semibold text-lg text-praow-700">จำหน่าย</div>
                <div className="text-slate-500 text-sm mt-0.5">สำหรับร้านค้า/ตัวแทนจำหน่ายที่สนใจร่วมงาน</div>
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
                  placeholder="กรอกที่อยู่สำหรับจัดส่ง"
                />
              </Field>

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

              <Field label="พิกัดร้านค้า">
                <input
                  required
                  value={reseller.location}
                  onChange={(e) => setReseller({ ...reseller, location: e.target.value })}
                  className={inputClass}
                  placeholder="เช่น ปากน้ำชุมพร / ปังหวาน / นาสัก"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {LOCATION_CHIPS.map((chip) => (
                    <button
                      type="button"
                      key={chip}
                      onClick={() => setReseller({ ...reseller, location: chip })}
                      className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-praow-700 hover:bg-blue-100 transition"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
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
                  className="flex-1 rounded-xl border border-blue-200 py-3 text-praow-700 font-medium hover:bg-blue-50"
                >
                  กลับหน้าแรก
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (mode === "reseller") setStep("reseller");
                    else setStep("personal");
                    setError("");
                  }}
                  className="flex-1 rounded-xl bg-praow-600 text-white py-3 font-semibold hover:bg-praow-700"
                >
                  กรอกเพิ่มอีก
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