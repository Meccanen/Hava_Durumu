import React from "react";
import { Navigation, Bell, AlertTriangle, X, Search } from "lucide-react";
import { THEMES, ThemeKey } from "../theme";
import { t, LangCode } from "../utils/i18n";

export function LocationPrompt({
  th, lang, isDetectingLocation, onDenied, onAllowed,
}: {
  th: typeof THEMES[ThemeKey]; lang: LangCode;
  isDetectingLocation: boolean;
  onDenied: () => void; onAllowed: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
      <div className={`w-full max-w-sm rounded-3xl border p-6 text-center space-y-4 ${th.settingsCard}`}>
        <Navigation size={32} className={`mx-auto ${th.accent}`} />
        <h3 className="font-semibold">{t("locationPermission", lang)}</h3>
        <p className={`text-sm ${th.textSecondary}`}>{t("findMyLocation", lang)}?</p>
        <div className="flex gap-2">
          <button onClick={onDenied} className={`flex-1 py-2.5 rounded-xl border text-sm ${th.card} ${th.textMuted}`}>
            {t("change", lang)}
          </button>
          <button onClick={onAllowed} disabled={isDetectingLocation}
            className={`flex-1 py-2.5 rounded-xl border text-sm font-medium ${th.card} ${th.accent}`}>
            {isDetectingLocation ? "…" : t("findMyLocation", lang)}
          </button>
        </div>
      </div>
    </div>
  );
}

export function NotificationPrompt({
  th, lang, onDenied, onAllowed,
}: {
  th: typeof THEMES[ThemeKey]; lang: LangCode;
  onDenied: () => void; onAllowed: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
      <div className={`w-full max-w-sm rounded-3xl border p-6 text-center space-y-4 ${th.settingsCard}`}>
        <Bell size={32} className={`mx-auto ${th.accent}`} />
        <h3 className="font-semibold">{t("notifOnboardTitle", lang)}</h3>
        <p className={`text-sm ${th.textSecondary}`}>{t("notifOnboardBody", lang)}</p>
        <div className="flex gap-2">
          <button onClick={onDenied} className={`flex-1 py-2.5 rounded-xl border text-sm ${th.card} ${th.textMuted}`}>
            {t("notifOnboardLater", lang)}
          </button>
          <button onClick={onAllowed}
            className={`flex-1 py-2.5 rounded-xl border text-sm font-medium ${th.card} ${th.accent}`}>
            {t("notifOnboardAllow", lang)}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LocationErrorBanner({
  th, lang, isDenied, onSearchCity, onRetry, onDismiss,
}: {
  th: typeof THEMES[ThemeKey]; lang: LangCode;
  isDenied: boolean;
  onSearchCity: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="w-full rounded-2xl border p-4 flex items-start gap-3 animate-fadeIn">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${th.card}`}>
        <AlertTriangle size={18} className={th.accent} />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-sm leading-snug">{isDenied ? t("locationDenied", lang) : t("locationFailed", lang)}</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onRetry}
            className={`flex-1 min-w-[120px] py-2 rounded-xl border text-xs font-medium ${th.card} ${th.accent}`}>
            {t("locationRetry", lang)}
          </button>
          <button
            onClick={onSearchCity}
            className={`flex-1 min-w-[120px] py-2 rounded-xl border text-xs font-medium ${th.settingsCard} ${th.accent}`}>
            {t("locationSearchCity", lang)}
          </button>
        </div>
      </div>
      <button
        onClick={onDismiss}
        className={`p-1.5 rounded-full shrink-0 cursor-pointer hover:opacity-75 transition-opacity ${th.textMuted}`}
        aria-label="Close">
        <X size={16} />
      </button>
    </div>
  );
}