import React, { useState } from "react";
import { X, Crown, Check, RefreshCw } from "lucide-react";
import { THEMES, ThemeKey, themeBgToOpaqueRgba } from "../theme";
import { t, LangCode } from "../utils/i18n";
import {
  purchaseMonthly, purchaseYearly, refreshPremiumStatus,
} from "../services/billingService";

interface PremiumModalProps {
  isPremium: boolean;
  onStatusChange: (val: boolean) => void;
  onClose: () => void;
  th: typeof THEMES[ThemeKey];
  lang: LangCode;
}

const MONTHLY_PRICE = "€0.99";
const YEARLY_PRICE = "€6.99";

export default function PremiumModal({
  isPremium, onStatusChange, onClose, th, lang,
}: PremiumModalProps) {
  const [busy, setBusy] = useState<"monthly" | "yearly" | "restore" | null>(null);

  const handlePurchase = async (plan: "monthly" | "yearly") => {
    setBusy(plan);
    const ok = plan === "monthly" ? await purchaseMonthly() : await purchaseYearly();
    if (ok) onStatusChange(true);
    setBusy(null);
  };

  const handleRestore = async () => {
    setBusy("restore");
    const ok = await refreshPremiumStatus();
    if (ok) onStatusChange(true);
    setBusy(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: themeBgToOpaqueRgba(th.bg, 0.94) }}
        className={`w-full max-w-sm rounded-3xl border p-6 space-y-4 max-h-[80vh] overflow-y-auto backdrop-blur-xl ${th.card.replace(/bg-\S+/g, "")}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown size={20} className="text-amber-500" />
            <h3 className={`font-semibold text-base ${th.textPrimary}`}>{t("premiumTitle", lang)}</h3>
          </div>
          <button onClick={onClose} className={th.textMuted}>
            <X size={20} />
          </button>
        </div>

        {isPremium ? (
          <div className="space-y-4">
            <div className={`rounded-2xl border p-3.5 flex items-center gap-3 ${th.header}`}>
              <Crown size={24} className="text-amber-500 shrink-0" />
              <p className={`text-sm font-semibold ${th.textPrimary}`}>{t("premiumActive", lang)}</p>
            </div>
            <button onClick={onClose} className={`w-full px-4 py-2.5 rounded-full border text-sm font-bold ${th.card} ${th.accent}`}>
              {t("close", lang)}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className={`text-sm leading-relaxed ${th.textSecondary}`}>{t("premiumDescription", lang)}</p>

            <div className="space-y-2">
              {[
                "premiumBenefit1", "premiumBenefit2", "premiumBenefit3",
              ].map((key) => (
                <div key={key} className="flex items-center gap-2.5">
                  <Check size={16} className="text-green-500 shrink-0" />
                  <span className={`text-sm ${th.textPrimary}`}>{t(key, lang)}</span>
                </div>
              ))}
            </div>

            <button onClick={() => handlePurchase("monthly")} disabled={busy !== null}
              className={`w-full px-4 py-3 rounded-2xl border flex items-center justify-between transition-all cursor-pointer disabled:opacity-50 ${th.header}`}>
              <span className={`text-sm font-bold ${th.textPrimary}`}>{t("premiumMonthly", lang)}</span>
              <span className={`text-sm font-extrabold ${th.accent}`}>
                {busy === "monthly" ? "…" : MONTHLY_PRICE}
              </span>
            </button>
            <button onClick={() => handlePurchase("yearly")} disabled={busy !== null}
              className={`w-full px-4 py-3 rounded-2xl border flex items-center justify-between transition-all cursor-pointer disabled:opacity-50 ${th.header}`}>
              <span className={`text-sm font-bold ${th.textPrimary}`}>{t("premiumYearly", lang)}</span>
              <span className={`text-sm font-extrabold ${th.accent}`}>
                {busy === "yearly" ? "…" : YEARLY_PRICE}
              </span>
            </button>

            <button onClick={handleRestore} disabled={busy !== null}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border text-sm font-bold transition-all cursor-pointer disabled:opacity-50 ${th.card} ${th.textSecondary}`}>
              <RefreshCw size={15} className={busy === "restore" ? "animate-spin" : ""} />
              {t("premiumRestore", lang)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}