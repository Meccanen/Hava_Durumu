import { t, LangCode } from "./i18n";
import type { WeatherBundle } from "../types";

/**
 * Hava uyarısı kaynağının (ör. DWD/MeteoAlarm) kendi encoding/çeviri
 * pipeline'ı zaman zaman metni bozup yerine "?" placeholder karakterleri
 * koyabiliyor — bu bizim istemcimizin kontrolünde değil (lang parametresini
 * kaldırmamıza rağmen aralıklı olarak devam edebiliyor). Böyle bir metni
 * olduğu gibi kullanıcıya göstermek yerine burada tespit edip nazik bir
 * "şu an okunamıyor" mesajına düşüyoruz.
 */
export function isLikelyCorruptedAlertText(text: string): boolean {
  const meaningful = text.replace(/\s/g, "");
  if (meaningful.length === 0) return true;
  const questionMarks = (meaningful.match(/\?/g) ?? []).length;
  return questionMarks / meaningful.length > 0.3;
}

/**
 * Kullanıcının bildirim için seçtiği saate ("HH:MM") en yakın saatlik
 * tahmini `weather.hourly` içinden bulur. `dt` unix timestamp'i cihazın
 * kendi yerel saatine göre yorumlanır (Date.getHours() cihaz saat dilimini
 * kullanır) — bu, "seçtiğim saat = telefonumun gösterdiği saat" beklentisiyle
 * örtüşüyor (konum cihazın kendi saat diliminde ise doğru sonucu verir).
 */
/** `hourly` içinde, verilen saat-of-day'e (targetHour) en yakın elemanın INDEX'ini döner (-1: veri yok). */
export function findHourlyIndexForTargetTime(hourly: WeatherBundle["hourly"], targetHour: number): number {
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
export function formatLocalHour(dt: number): string {
  const d = new Date(dt * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Sıcaklığı, sayı vermeden, "hissedilen" bir kategoriye çevirir. Bildirim
 * içeriğinde kesin derece göstermiyoruz çünkü sıcaklık saat saat değişiyor —
 * kullanıcı bildirime baktığında o kesin rakam çoktan geçersiz olabiliyor.
 */
export function getTempFeelKey(temp: number): string {
  if (temp <= 0) return "notifFeelFreezing";
  if (temp <= 8) return "notifFeelCold";
  if (temp <= 15) return "notifFeelCool";
  if (temp <= 22) return "notifFeelMild";
  if (temp <= 29) return "notifFeelWarm";
  return "notifFeelHot";
}

/** Aynı sıcaklık kategorilerinin KISA/sıfat hâli — "ortalama X" gibi cümle kalıplarında kullanılır. */
export function getTempBucketKey(temp: number): string {
  if (temp <= 0) return "notifBucketFreezing";
  if (temp <= 8) return "notifBucketCold";
  if (temp <= 15) return "notifBucketCool";
  if (temp <= 22) return "notifBucketMild";
  if (temp <= 29) return "notifBucketWarm";
  return "notifBucketHot";
}

/** WMO kodunu geniş bir kategoriye indirger, pratik/ilgi çekici bir öneri cümlesi için. */
export function getConditionTipKey(weatherCode: number, isDay: boolean, feelsLike: number): string {
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
export function getNotableCategoryKey(weatherCode: number): string | null {
  if (weatherCode === 45 || weatherCode === 48) return "notifCategoryNameFog";
  if ([51, 53, 55].includes(weatherCode)) return "notifCategoryNameDrizzle";
  if ([61, 63, 65, 80, 81, 82].includes(weatherCode)) return "notifCategoryNameRain";
  if ([56, 57, 66, 67, 71, 73, 75, 77, 85, 86].includes(weatherCode)) return "notifCategoryNameSnow";
  if ([95, 96, 99].includes(weatherCode)) return "notifCategoryNameStorm";
  return null;
}

/** WMO/WeatherAPI kodunu başlıkta gösterilecek bir emojiye çevirir. */
export function weatherEmoji(weatherCode: number, isDay: boolean): string {
  if (weatherCode === 0 || weatherCode === 1) return isDay ? "☀️" : "🌙";
  if (weatherCode === 2 || weatherCode === 3) return "⛅";
  if (weatherCode === 45 || weatherCode === 48) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(weatherCode)) return "🌦️";
  if ([61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weatherCode)) return "🌧️";
  if ([66, 67, 71, 73, 75, 77, 85, 86].includes(weatherCode)) return "🌨️";
  return "🌡️";
}

/**
 * Zamanlanmış günlük bildirimin içeriğini üretir. İçerik dört bölümden oluşur:
 * 0) Başlık: günün ana durum emojisi + konum adı + soru ("☀️ İstanbul: Bugün nasıl geçecek?")
 * 1) "Bugünün min/max sıcaklığı": günün bilançosu (sayı = ilk bakışta cazibe)
 * 2) Seçilen saatin 2SAATLİK penceresi: hissedilen + öneri (etiket dinamik saat —
 *    "Önümüzdeki 2 saat" değil, gerçek aralık gösterilir)
 * 3) "T ile T+6 saat arası": o pencerenin ortalama sıcaklık kategorisi +
 *    içinde yağış/kar/fırtına/sis gibi belirgin bir durum varsa hangi saat
 *    aralığında olduğu
 * `body` (collapsed görünüm) sadece 1. bölümü (min/max) taşır — bildirim
 * çekmecesinde ilk satır sayı içerir; `largeBody` (genişletilmiş görünüm)
 * 1+2+3 bölümlerini bir arada verir.
 */
export function buildNotificationContent(
  weather: WeatherBundle | null,
  timeStr: string,
  lang: LangCode,
  locationName?: string
): { title: string; body: string; largeBody?: string } {
  if (!weather) return { title: t("notifScheduledTitle", lang), body: t("notifScheduledBody", lang) };

  const [hh] = timeStr.split(":").map(Number);
  const targetHour = Number.isFinite(hh) ? hh : 8;
  const anchorIdx = findHourlyIndexForTargetTime(weather.hourly, targetHour);
  if (anchorIdx === -1) return { title: t("notifScheduledTitle", lang), body: t("notifScheduledBody", lang) };

  const anchor = weather.hourly[anchorIdx];
  const titleEmoji = weatherEmoji(anchor.weatherCode, anchor.isDay);
  const title = locationName
    ? `${titleEmoji} ${locationName}: ${t("notifScheduledTitle", lang)}`
    : `${titleEmoji} ${t("notifScheduledTitle", lang)}`;

  // ---- Bölüm 2: seçilen saatin 2 saatlik penceresi (hissedilen + öneri) ----
  const window2 = weather.hourly.slice(anchorIdx, anchorIdx + 2);
  let window2Label = "";
  if (window2.length >= 2) {
    const startStr = formatLocalHour(window2[0].dt);
    const endStr = formatLocalHour(window2[1].dt + 3600);
    const feel = t(getTempFeelKey(anchor.feelsLike ?? anchor.temperature), lang);
    const tip = t(getConditionTipKey(anchor.weatherCode, anchor.isDay, anchor.feelsLike), lang);
    window2Label = t("notifTimeWindowTemplate", lang, {
      start: startStr,
      end: endStr,
      feel,
      tip,
    });
  } else if (anchorIdx >= 0) {
    const feel = t(getTempFeelKey(anchor.feelsLike ?? anchor.temperature), lang);
    const tip = t(getConditionTipKey(anchor.weatherCode, anchor.isDay, anchor.feelsLike), lang);
    window2Label = `${feel} ${tip}`;
  }

  // ---- Bölüm 3: 6 saatlik pencere ortalaması + belirgin aralıklar ----
  const window6 = weather.hourly.slice(anchorIdx, anchorIdx + 6);
  let segmentB = "";
  const rangeLines: string[] = [];

  if (window6.length >= 2) {
    const avgTemp = window6.reduce((sum, h) => sum + h.temperature, 0) / window6.length;
    const bucket = t(getTempBucketKey(avgTemp), lang);
    const startStr = formatLocalHour(window6[0].dt);
    const endStr = formatLocalHour(window6[window6.length - 1].dt + 3600);
    segmentB = t("notifAvgTemplate", lang, { start: startStr, end: endStr, bucket });

    let i = 0;
    while (i < window6.length) {
      const cat = getNotableCategoryKey(window6[i].weatherCode);
      if (!cat) { i++; continue; }
      let j = i;
      while (j + 1 < window6.length && getNotableCategoryKey(window6[j + 1].weatherCode) === cat) j++;
      const rangeStart = formatLocalHour(window6[i].dt);
      const rangeEnd = formatLocalHour(window6[j].dt + 3600);
      rangeLines.push(t("notifRangeTemplate", lang, { start: rangeStart, end: rangeEnd, category: t(cat, lang) }));
      i = j + 1;
    }
  }

  // ---- Bölüm 1: günün min/max'ı (İLK izlenim = sayı) ----
  const daily0 = weather.daily && weather.daily.length > 0 ? weather.daily[0] : null;
  const highLow = daily0
    ? t("notifDayHighLowTemplate", lang, { max: String(Math.round(daily0.tempMax)), min: String(Math.round(daily0.tempMin)) })
    : "";

  const largeBody = [highLow, window2Label, segmentB, ...rangeLines].filter(Boolean).join("\n");
  // Collapsed görünüm kısa ve sayısal kalsın — merak uyandırıp genişletmeye/uygulamaya iter.
  return { title, body: highLow || window2Label, largeBody };
}

export const CHANGE_ALERT_TEMP_THRESHOLD = 5; // °C
export const CHANGE_ALERT_POP_THRESHOLD = 0.25; // yağış olasılığında 25 puanlık fark (iki yönde de)

export interface UpcomingChangeAlert {
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