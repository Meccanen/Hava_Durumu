import {
  CurrentWeather, DailyForecast, HourlyForecast, WeatherBundle,
  AirQuality, Astronomy, WeatherAlert,
} from "../types";

/**
 * WeatherAPI.com — tek API'den mevcut durum + saatlik/günlük tahmin +
 * astronomi + hava kalitesi + uyarılar + UV indeksini tek çağrıda çeker.
 * https://www.weatherapi.com/pricing.aspx
 *
 * ÖNEMLİ: Şu an ÜCRETSİZ (Free) katman kullanılıyor — test aşamasındayız.
 * Free katman kısıtları: 3 günlük tahmin, "limited" hava kalitesi/uyarı verisi,
 * 100K çağrı/ay. Üretime (gerçek kullanıcı trafiğine) geçmeden önce Starter
 * plana ($7/ay, 3M çağrı, 7 günlük tahmin) yükseltilmeli — bu durumda sadece
 * FORECAST_DAYS sabiti 7'ye çekilecek, başka kod değişikliği gerekmez.
 */
const BASE_URL = "https://api.weatherapi.com/v1/forecast.json";
const FORECAST_DAYS = 3; // Starter'a geçince: 7
const HOURLY_WINDOW = 24; // Ana sayfa saatlik şeridi — sadece önümüzdeki 24 saat

export class WeatherServiceError extends Error {
  constructor(message: string, public readonly code: "NETWORK" | "API_ERROR") {
    super(message);
  }
}

/**
 * WeatherAPI.com kod → WMO (Open-Meteo) kod eşlemesi.
 * Mevcut ikon/renk/5-dil çeviri sistemi (weatherHelper.ts, i18n.ts) WMO
 * kodları üzerine kurulu; bunu yeniden yazmak yerine WeatherAPI'nin ~49
 * koddan oluşan setini en yakın WMO karşılığına çeviriyoruz.
 * Kaynak: https://www.weatherapi.com/docs/weather_conditions.json
 */
const WEATHERAPI_TO_WMO: Record<number, number> = {
  1000: 0,   // Sunny / Clear
  1003: 2,   // Partly cloudy
  1006: 3,   // Cloudy
  1009: 3,   // Overcast
  1012: 45, 1015: 45, 1018: 45, 1021: 45, 1024: 45, 1027: 45,
  1030: 45,
  1033: 45, 1036: 45, 1039: 45, 1042: 45, 1045: 45, 1048: 45,
  1063: 61,
  1066: 71,
  1069: 66,
  1072: 56,
  1087: 95,
  1114: 75, 1117: 75,
  1135: 45, 1147: 45,
  1150: 51, 1153: 51,
  1168: 56,
  1171: 57,
  1180: 61, 1183: 61,
  1186: 63, 1189: 63,
  1192: 65, 1195: 65,
  1198: 66,
  1201: 67,
  1204: 66,
  1207: 67,
  1210: 71, 1213: 71,
  1216: 73, 1219: 73,
  1222: 75, 1225: 75,
  1237: 77, 1261: 77, 1264: 77,
  1240: 80,
  1243: 81,
  1246: 82,
  1249: 67, 1252: 67,
  1255: 85,
  1258: 86,
  1273: 95, 1279: 95,
  1276: 96, 1282: 96,
};

function toWmoCode(weatherApiCode: number): number {
  return WEATHERAPI_TO_WMO[weatherApiCode] ?? 3;
}

/** "2026-08-29 14:00" biçimindeki yerel saat metnini unix ts'e çevirir. */
function toUnix(localDateTime: string): number {
  return Math.floor(new Date(localDateTime.replace(" ", "T")).getTime() / 1000);
}

/** "06:32 AM" + "2026-08-29" → unix ts. WeatherAPI astro saatleri 12 saatlik formatta. */
function astroTimeToUnix(dateStr: string, time12h: string): number | null {
  const m = time12h.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  const isPM = m[3].toUpperCase() === "PM";
  if (isPM && hours !== 12) hours += 12;
  if (!isPM && hours === 12) hours = 0;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return toUnix(`${dateStr} ${hh}:${mm}`);
}

export async function fetchWeatherBundle(
  latitude: number,
  longitude: number,
  lang: string = "tr"
): Promise<WeatherBundle> {
  const apiKey = import.meta.env.VITE_WEATHER_API_KEY;
  const params = new URLSearchParams({
    key: apiKey,
    q: `${latitude},${longitude}`,
    days: String(FORECAST_DAYS),
    aqi: "yes",
    alerts: "yes",
    lang,
  });

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}?${params.toString()}`);
  } catch {
    throw new WeatherServiceError("Hava durumu servisine ulaşılamadı.", "NETWORK");
  }

  const data = await res.json();

  if (!res.ok || data.error) {
    throw new WeatherServiceError(
      data?.error?.message ?? `Hava durumu servisi hata döndürdü (${res.status}).`,
      "API_ERROR"
    );
  }

  const today = data.forecast.forecastday[0];
  const astroToday = today.astro;

  const sunriseToday = astroTimeToUnix(today.date, astroToday.sunrise) ?? toUnix(`${today.date} 06:00`);
  const sunsetToday = astroTimeToUnix(today.date, astroToday.sunset) ?? toUnix(`${today.date} 19:00`);

  const current: CurrentWeather = {
    temperature: Math.round(data.current.temp_c),
    apparentTemperature: Math.round(data.current.feelslike_c),
    humidity: data.current.humidity,
    windSpeed: Math.round((data.current.wind_kph / 3.6) * 10) / 10,
    pressure: Math.round(data.current.pressure_mb),
    weatherCode: toWmoCode(data.current.condition.code),
    isDay: data.current.is_day === 1,
    sunrise: sunriseToday,
    sunset: sunsetToday,
    popToday: today.day.daily_chance_of_rain ?? 0,
    uvIndex: Math.round(data.current.uv),
  };

  const allHours: any[] = data.forecast.forecastday.flatMap((d: any) => d.hour);
  const nowTs = Date.now() / 1000;
  let startIdx = allHours.findIndex((h) => toUnix(h.time) >= nowTs);
  if (startIdx === -1) startIdx = 0;

  const hourly: HourlyForecast[] = allHours
    .slice(startIdx, startIdx + HOURLY_WINDOW)
    .map((h) => ({
      dt: toUnix(h.time),
      temperature: Math.round(h.temp_c),
      feelsLike: Math.round(h.feelslike_c),
      weatherCode: toWmoCode(h.condition.code),
      pop: (h.chance_of_rain ?? 0) / 100,
      isDay: h.is_day === 1,
    }));

  const daily: DailyForecast[] = data.forecast.forecastday.map((d: any) => ({
    dt: toUnix(`${d.date} 12:00`),
    tempMin: Math.round(d.day.mintemp_c),
    tempMax: Math.round(d.day.maxtemp_c),
    weatherCode: toWmoCode(d.day.condition.code),
    pop: (d.day.daily_chance_of_rain ?? 0) / 100,
  }));

  // Her gün için TAM 24 saatlik döküm (nem/basınç/rüzgar dahil) —
  // "Günlük Tahmin" listesinde bir güne tıklayınca açılan detay ekranı için.
  const dailyHourly: HourlyForecast[][] = data.forecast.forecastday.map((d: any) =>
    d.hour.map((h: any) => ({
      dt: toUnix(h.time),
      temperature: Math.round(h.temp_c),
      feelsLike: Math.round(h.feelslike_c),
      weatherCode: toWmoCode(h.condition.code),
      pop: (h.chance_of_rain ?? 0) / 100,
      isDay: h.is_day === 1,
      humidity: h.humidity,
      pressure: Math.round(h.pressure_mb),
      windSpeed: Math.round((h.wind_kph / 3.6) * 10) / 10,
    }))
  );

  const aq = data.current.air_quality;
  const airQuality: AirQuality | null = aq
    ? {
        usEpaIndex: aq["us-epa-index"] ?? 0,
        pm2_5: Math.round(aq.pm2_5 * 10) / 10,
        pm10: Math.round(aq.pm10 * 10) / 10,
        o3: Math.round(aq.o3 * 10) / 10,
      }
    : null;

  const astronomy: Astronomy = {
    sunrise: sunriseToday,
    sunset: sunsetToday,
    moonrise: astroTimeToUnix(today.date, astroToday.moonrise),
    moonset: astroTimeToUnix(today.date, astroToday.moonset),
    moonPhase: astroToday.moon_phase,
    moonIllumination: Number(astroToday.moon_illumination) || 0,
  };

  const alerts: WeatherAlert[] = (data.alerts?.alert ?? []).map((a: any) => ({
    headline: a.headline || a.event,
    event: a.event,
    severity: a.severity,
    effect: a.desc,
    expiresTs: a.expires ? toUnix(a.expires.slice(0, 16)) : null,
  }));

  return { current, hourly, daily, dailyHourly, airQuality, astronomy, alerts, fetchedAt: Date.now() };
}
