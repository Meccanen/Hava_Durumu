/**
 * WeatherAPI.com (forecast.json) ham yanıt tipleri.
 * Yalnızca bu projede KULLANILAN alanları taşır — eksiksiz API dokümanı değil,
 * bilinçli olarak minimum kümedir. Yeni bir alan kullanılmaya başlanırsa buraya
 * ekleyin (böylece tip, kod ile API'nin gerçek kullanımı arasında senkron kalır).
 * Kaynak: https://www.weatherapi.com/docs/
 */

export interface WeatherApiAstro {
  sunrise: string; // "06:32 AM"
  sunset: string;
  moonrise: string;
  moonset: string;
  moon_phase: string; // "Waxing Gibbous"
  moon_illumination: string; // "87" (metin olarak gelir)
}

export interface WeatherApiDay {
  maxtemp_c: number;
  mintemp_c: number;
  condition: { code: number; text: string };
  daily_chance_of_rain: number;
  daily_chance_of_snow: number;
  totalprecip_mm: number;
  totalsnow_cm: number;
  maxwind_kph: number;
  avgvis_km: number;
  uv: number;
}

export interface WeatherApiHour {
  time: string; // "2026-08-29 14:00"
  temp_c: number;
  feelslike_c: number;
  condition: { code: number; text: string };
  chance_of_rain: number;
  chance_of_snow: number;
  precip_mm: number;
  humidity: number;
  pressure_mb: number;
  wind_kph: number;
  gust_kph: number;
  vis_km: number;
  cloud: number;
  uv: number;
  is_day: number; // 1|0
}

export interface WeatherApiForecastDay {
  date: string; // "2026-08-29"
  astro: WeatherApiAstro;
  day: WeatherApiDay;
  hour: WeatherApiHour[];
}

export interface WeatherApiAirQuality {
  // İndeks 1-6 (bkz. types.ts AirQuality.usEpaIndex)
  "us-epa-index"?: number;
  pm2_5: number;
  pm10: number;
  o3: number;
}

export interface WeatherApiCurrent {
  temp_c: number;
  feelslike_c: number;
  humidity: number;
  wind_kph: number;
  pressure_mb: number;
  condition: { code: number; text: string };
  is_day: number; // 1|0
  uv: number;
  gust_kph: number;
  vis_km: number;
  cloud: number;
  precip_mm: number;
  air_quality?: WeatherApiAirQuality;
}

export interface WeatherApiAlert {
  headline?: string;
  event?: string;
  severity?: string;
  urgency?: string;
  category?: string;
  areas?: string;
  desc?: string;
  instruction?: string;
  language?: string;
  expires?: string; // "2026-08-30 15:00"
}

export interface WeatherApiError {
  message?: string;
}

export interface WeatherApiResponse {
  current: WeatherApiCurrent;
  forecast: {
    forecastday: WeatherApiForecastDay[];
  };
  alerts?: {
    alert: WeatherApiAlert[];
  };
  error?: WeatherApiError;
}