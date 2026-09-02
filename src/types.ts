export interface Location {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  admin1?: string; // bölge/il
}

export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  pressure: number;
  weatherCode: number; // WMO kodu (WeatherAPI kodlarından çevrilir)
  isDay: boolean;
  sunrise: number; // unix ts
  sunset: number;  // unix ts
  popToday: number; // bugünkü maksimum yağış olasılığı (0-100)
  uvIndex: number;
}

export interface AirQuality {
  usEpaIndex: number; // 1 (İyi) — 6 (Tehlikeli)
  pm2_5: number;
  pm10: number;
  o3: number;
}

export interface Astronomy {
  sunrise: number; // unix ts
  sunset: number;  // unix ts
  moonrise: number | null; // unix ts
  moonset: number | null;  // unix ts
  moonPhase: string; // WeatherAPI'nin döndürdüğü ham metin (ör. "Waxing Gibbous")
  moonIllumination: number; // 0-100
}

export interface WeatherAlert {
  headline: string;
  event: string;
  severity: string;
  effect: string; // desc — API'den gelen resmi/ham uyarı metni
  language: string | null; // API'nin bu metni verdiği dil (varsa)
  expiresTs: number | null;
}

export interface HourlyForecast {
  dt: number; // unix ts
  temperature: number;
  feelsLike: number;
  weatherCode: number;
  pop: number; // yağış olasılığı (0-1)
  isDay: boolean;
  humidity?: number;
  pressure?: number;
  windSpeed?: number; // m/s
}

export interface DailyForecast {
  dt: number; // unix ts (öğlen referans saati)
  tempMin: number;
  tempMax: number;
  weatherCode: number;
  pop: number; // yağış olasılığı (0-1)
}

export interface WeatherBundle {
  current: CurrentWeather;
  hourly: HourlyForecast[]; // önümüzdeki 24 saat (ana sayfa)
  daily: DailyForecast[];   // günlük özet (şu an ücretsiz katmanda 3 gün)
  dailyHourly: HourlyForecast[][]; // her gün için TAM 24 saatlik döküm (daily.length ile aynı sırada)
  airQuality: AirQuality | null;
  astronomy: Astronomy | null;
  alerts: WeatherAlert[];
  fetchedAt: number;
}
