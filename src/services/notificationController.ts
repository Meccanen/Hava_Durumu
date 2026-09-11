import { t, LangCode } from "../utils/i18n";
import type { WeatherBundle } from "../types";
import {
  hasNotificationPermission,
  scheduleDailySummaryNotification,
  cancelFutureChangeAlert,
  fireImmediateChangeAlert,
  scheduleFutureChangeAlert,
  FUTURE_CHANGE_ALERT_SLOT_COUNT,
} from "./notificationService";

/**
 * ============================================================================
 * BİLDİRİM İÇERİĞİ ÜRETİMİ + ZAMANLAMA KONTROLÜ
 * ============================================================================
 * Bildirim metinlerinin üretim mantığı App.tsx'te değil burada yaşar; hem
 * ön planda (App.tsx) hem arka planda (backgroundTaskService.ts) aynı kod
 * kullanılır. Böylece arka plan task'ı her 30 dk'da bir hava verisini
 * tazelediğinde, zamanlanmış bildirimlerin İÇERİĞİ de (günlük özet + değişim
 * uyarıları) canlı veriyle yeniden yazılır — bildirim artık bayat veriyle
 * ateşlenmez.
 *
 * Kullanım:
 * - App.tsx: kullanıcı tercihlerinin UI tetiklemelerinde buildNotificationContent /
 *   detectUpcomingChanges'ı doğrudan çağırır; weather/language değişimlerinde
 *   de syncScheduledNotifications(weather, lang) ile her şeyi senkronlar.
 * - backgroundTaskService.ts: yeni veri çektikten sonra
 *   syncScheduledNotifications(bundle, lang) çağırır.
 */

/**
 * Kullanıcının bildirim için seçtiği saate ("HH:MM") en yakın saatlik
 * tahmini `weather.hourly` içinden bulur. `dt` unix timestamp'i cihazın
 * kendi yerel saatine göre yorumlanır (Date.getHours() cihaz saat dilimini
 * kullanır) — bu, "seçtiğim saat = telefonumun gösterdiği saat" beklentisiyle
 * örtüşüyor (konum cihazın kendi saat diliminde ise doğru sonucu verir).
 */
function findHourlyIndexForTargetTime(hourly: WeatherBundle["hourly"], targetHour: number): number {
  if (!hourly || hourly.length === 0) return -1;
  let bestIdx = 0;
  let bestDiff = Infinity;
  hourly.forEach((h, idx) => {
    const localHour = new Date(h.dt * 1000).getHours();
    const diff = Math.abs(localHour - targetHour);
    if (diff < bestDiff) { bestDiff = diff; bestIdx = idx; }
  });
  return bestIdx;
}

/** Unix saniyeyi cihazın yerel saatine göre "HH:MM" olarak biçimlendirir. */
function formatLocalHour(dt: number): string {
  const d = new Date(dt * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Sıcaklığı, sayı vermeden, "hissedilen" bir kategoriye çevirir. Bildirim
 * içeriğinde kesin derece göstermiyoruz çünkü sıcaklık saat saat değişiyor —
 * kullanıcı bildirime baktığında o kesin rakam çoktan geçersiz olabiliyor.
 */
function getTempFeelKey(temp: number): string {
  if (temp <= 0) return "notifFeelFreezing";
  if (temp <= 8) return "notifFeelCold";
  if (temp <= 15) return "notifFeelCool";
  if (temp <= 22) return "notifFeelMild";
  if (temp <= 29) return "notifFeelWarm";
  return "notifFeelHot";
}

/** Aynı sıcaklık kategorilerinin KISA/sıfat hâli — "ortalama X" gibi cümle kalıplarında kullanılır. */
function getTempBucketKey(temp: number): string {
  if (temp <= 0) return "notifBucketFreezing";
  if (temp <= 8) return "notifBucketCold";
  if (temp <= 15) return "notifBucketCool";
  if (temp <= 22) return "notifBucketMild";
  if (temp <= 29) return "notifBucketWarm";
  return "notifBucketHot";
}

/** WMO kodunu geniş bir kategoriye indirger, pratik/ilgi çekici bir öneri cümlesi için. */
function getConditionTipKey(weatherCode: number, isDay: boolean, feelsLike: number): string {
  if (weatherCode === 0 || weatherCode === 1) {
    if (!isDay) return "notifTipClearNight";
    return feelsLike >= 16 ? "notifTipClear" : "notifTipClearCool"; // hissedilen serin/soğukken güneş gözlüğü mantıksız
  }
  if (weatherCode === 2 || weatherCode === 3) return "notifTipCloudy";
  if (weatherCode === 45 || weatherCode === 48) return "notifTipFog";
  if ([51, 53, 55].includes(weatherCode)) return "notifTipDrizzle";
  if ([61, 63, 65, 80, 81, 82].includes(weatherCode)) return "notifTipRain";
  if ([56, 57, 66, 67, 71, 73, 75, 77, 85, 86].includes(weatherCode)) return "notifTipSnow";
  if ([95, 96, 99].includes(weatherCode)) return "notifTipStorm";
  return "notifTipCloudy"; // güvenli/nötr varsayılan
}

/** Sadece "belirtilmeye değer" (yağış/kar/fırtına/sis) kategoriler için kısa isim döner; açık/bulutlu için null (aralık belirtmeye gerek yok). */
function getNotableCategoryKey(weatherCode: number): string | null {
  if (weatherCode === 45 || weatherCode === 48) return "notifCategoryNameFog";
  if ([51, 53, 55].includes(weatherCode)) return "notifCategoryNameDrizzle";
  if ([61, 63, 65, 80, 81, 82].includes(weatherCode)) return "notifCategoryNameRain";
  if ([56, 57, 66, 67, 71, 73, 75, 77, 85, 86].includes(weatherCode)) return "notifCategoryNameSnow";
  if ([95, 96, 99].includes(weatherCode)) return "notifCategoryNameStorm";
  return null;
}

/**
 * Zamanlanmış günlük bildirimin içeriğini üretir. İki bölümden oluşur:
 * 1) "Önümüzdeki 2 saat": seçilen saatin (T) hissedilen sıcaklığı + öneri
 * 2) "T ile T+6 saat arası": o pencerenin ortalama sıcaklık kategorisi +
 *    içinde yağış/kar/fırtına/sis gibi belirgin bir durum varsa hangi saat
 *    aralığında olduğu
 * `body` (collapsed görünüm) sadece 1. bölümü taşır, `largeBody`
 * (genişletilmiş görünüm) ikisini birden — bildirim uzun olabiliyor.
 */
export function buildNotificationContent(
  weather: WeatherBundle | null,
  timeStr: string,
  lang: LangCode
): { title: string; body: string; largeBody?: string } {
  const title = t("notifScheduledTitle", lang);
  if (!weather) return { title, body: t("notifScheduledBody", lang) };

  const [hh] = timeStr.split(":").map(Number);
  const targetHour = Number.isFinite(hh) ? hh : 8;
  const anchorIdx = findHourlyIndexForTargetTime(weather.hourly, targetHour);
  if (anchorIdx === -1) return { title, body: t("notifScheduledBody", lang) };

  const anchor = weather.hourly[anchorIdx];
  const feel = t(getTempFeelKey(anchor.temperature), lang);
  const tip = t(getConditionTipKey(anchor.weatherCode, anchor.isDay, anchor.feelsLike), lang);
  const segmentA = `${t("notifNext2hLabel", lang)} ${feel} ${tip}`;

  const window = weather.hourly.slice(anchorIdx, anchorIdx + 6); // T, T+1, ..., T+5 (6 nokta = 6 saatlik pencere)
  let segmentB = "";
  const rangeLines: string[] = [];

  if (window.length >= 2) {
    const avgTemp = window.reduce((sum, h) => sum + h.temperature, 0) / window.length;
    const bucket = t(getTempBucketKey(avgTemp), lang);
    const startStr = formatLocalHour(window[0].dt);
    const endStr = formatLocalHour(window[window.length - 1].dt + 3600);
    segmentB = t("notifAvgTemplate", lang, { start: startStr, end: endStr, bucket });

    let i = 0;
    while (i < window.length) {
      const cat = getNotableCategoryKey(window[i].weatherCode);
      if (!cat) { i++; continue; }
      let j = i;
      while (j + 1 < window.length && getNotableCategoryKey(window[j + 1].weatherCode) === cat) j++;
      const rangeStart = formatLocalHour(window[i].dt);
      const rangeEnd = formatLocalHour(window[j].dt + 3600);
      rangeLines.push(t("notifRangeTemplate", lang, { start: rangeStart, end: rangeEnd, category: t(cat, lang) }));
      i = j + 1;
    }
  }

  const largeBody = [segmentA, segmentB, ...rangeLines].filter(Boolean).join("\n");
  return { title, body: segmentA, largeBody };
}

const CHANGE_ALERT_TEMP_THRESHOLD = 5; // °C
const CHANGE_ALERT_POP_THRESHOLD = 0.25; // yağış olasılığında 25 puanlık fark (iki yönde de)

interface UpcomingChangeAlert {
  slotIndex: number; // hourly[] içindeki i (saat[i] -> saat[i+1] geçişi)
  fireAt: Date; // saat[i]'nin başlangıcı ("bir önceki saat diliminin başı")
  isImmediate: boolean; // fireAt şimdi veya geçmişteyse true
  title: string;
  body: string;
}

/**
 * `weather.hourly` içindeki HER ARDIŞIK SAAT ÇİFTİNİ (i, i+1) karşılaştırır
 * (yaklaşık 23 karşılaştırma). Önemli bir fark bulunan her çift için AYRI
 * bir uyarı üretir — birden fazla uyarı aynı anda dönebilir. Uyarı, değişimin
 * gerçekleştiği saatten (i+1) TAM 1 SAAT ÖNCESİ (saat[i]'nin başlangıcı) için
 * hesaplanır; bu an geçmişte kaldıysa `isImmediate: true` ile işaretlenir.
 */
export function detectUpcomingChanges(weather: WeatherBundle, lang: LangCode): UpcomingChangeAlert[] {
  const hourly = weather.hourly;
  if (!hourly || hourly.length < 2) return [];

  const now = Date.now();
  const results: UpcomingChangeAlert[] = [];

  for (let i = 0; i < hourly.length - 1; i++) {
    const h0 = hourly[i];
    const h1 = hourly[i + 1];
    const tempDiff = h1.temperature - h0.temperature;
    const popDiff = h1.pop - h0.pop;

    let kind: "warmer" | "cooler" | "rainUp" | "rainDown" | null = null;
    let severity = 0;

    if (Math.abs(tempDiff) >= CHANGE_ALERT_TEMP_THRESHOLD) {
      severity = Math.abs(tempDiff) / CHANGE_ALERT_TEMP_THRESHOLD;
      kind = tempDiff > 0 ? "warmer" : "cooler";
    }
    if (Math.abs(popDiff) >= CHANGE_ALERT_POP_THRESHOLD) {
      const popSeverity = Math.abs(popDiff) / CHANGE_ALERT_POP_THRESHOLD;
      if (popSeverity > severity) {
        severity = popSeverity;
        kind = popDiff > 0 ? "rainUp" : "rainDown";
      }
    }
    if (!kind) continue;

    const titleKey =
      kind === "warmer" ? "notifChangeTitleWarmer" :
      kind === "cooler" ? "notifChangeTitleCooler" :
      kind === "rainUp" ? "notifChangeTitleRainUp" : "notifChangeTitleRainDown";

    const feel = t(getTempFeelKey(h1.temperature), lang);
    const tip = t(getConditionTipKey(h1.weatherCode, h1.isDay, h1.feelsLike), lang);
    const fireAt = new Date(h0.dt * 1000);

    results.push({
      slotIndex: i,
      fireAt,
      isImmediate: fireAt.getTime() <= now,
      title: t(titleKey, lang),
      body: `${t("notifChangeUpcomingLabel", lang)} ${feel} ${tip}`,
    });
  }

  return results;
}

/** "HH:MM" dizesini { hour, minute }'a çevirir; bozuk değerde güvenli varsayılan (08:00) döner. */
export function parseNotificationTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(":").map(Number);
  return { hour: Number.isFinite(h) ? h : 8, minute: Number.isFinite(m) ? m : 0 };
}

/**
 * Kullanıcının kayıtlı tercihlerine göre tüm zamanlanmış bildirimleri
 * (günlük özet + saat-başı değişim uyarıları) yeniden senkronlar:
 * - Günlük özet açıksa: sabit repeating alarmın İÇERİĞİ canlı veriyle yazılır.
 * - Değişim uyarıları açıksa: 23 saatlik slot yeniden değerlendirilir
 *   (geçerliyse zamanlanır/güncellenir, anlıksa HEMEN gösterilir, çürükse iptal).
 * - Değişim uyarıları kapalıysa tüm slotlar iptal edilir.
 * Bildirim izni yoksa hiçbir şey yapmaz.
 *
 * Hem App.tsx (weather/language/toggle değişiminde) hem de arka plan task'ı
 * (yeni veri çektikten sonra) bu fonksiyonu çağırır.
 */
export async function syncScheduledNotifications(
  weather: WeatherBundle | null,
  lang: LangCode
): Promise<void> {
  if (!(await hasNotificationPermission())) return;

  const dailyEnabled = localStorage.getItem("mhd_notif_daily_enabled") === "true";
  const changeEnabled = localStorage.getItem("mhd_notif_change_enabled") === "true";

  // --- Günlük özet: açıksa içeriği canlı veriyle yeniden yaz ---
  if (dailyEnabled && weather) {
    const notifTime = localStorage.getItem("mhd_notif_time") || "08:00";
    const { hour, minute } = parseNotificationTime(notifTime);
    const { title, body, largeBody } = buildNotificationContent(weather, notifTime, lang);
    await scheduleDailySummaryNotification(hour, minute, title, body, largeBody);
  }

  // --- Ani değişim uyarıları ---
  if (!changeEnabled) {
    for (let i = 0; i < FUTURE_CHANGE_ALERT_SLOT_COUNT; i++) {
      await cancelFutureChangeAlert(i);
    }
    return;
  }
  if (!weather) return;

  const changes = detectUpcomingChanges(weather, lang);
  const bySlot = new Map(changes.map((c) => [c.slotIndex, c]));

  for (let i = 0; i < FUTURE_CHANGE_ALERT_SLOT_COUNT; i++) {
    const change = bySlot.get(i);
    if (!change) {
      await cancelFutureChangeAlert(i);
      continue;
    }
    if (change.isImmediate) {
      const dedupeKey = `${new Date().toDateString()}:${i}:${change.title}`;
      const lastKey = localStorage.getItem("mhd_last_immediate_change_key");
      if (lastKey !== dedupeKey) {
        localStorage.setItem("mhd_last_immediate_change_key", dedupeKey);
        await fireImmediateChangeAlert(change.title, change.body);
      }
      await cancelFutureChangeAlert(i);
    } else {
      await scheduleFutureChangeAlert(i, change.fireAt, change.title, change.body);
    }
  }
}