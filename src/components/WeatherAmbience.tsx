import { useMemo } from "react";

/**
 * Hero kartındaki hava durumu ambiyans katmanı.
 * WMO koduna göre yağmur/kar/tane, süzülen bulutlar, yıldızlar ve şimşek
 * flaşı çizer. Gün/Ay parlaması ayrıca WeatherDashboard'da ikonun
 * etrafına eklenir (bu bileşen kartın arka planına odaklanır).
 *
 * Tüm görsel kurallar src/index.css içinde ham CSS keyframe'li (Tailwind JIT
 * runtime'da üretilen sınıfları derlemez). Burada yalnızca pozisyon/zaman
 * inline style ile verilir.
 */
interface WeatherAmbienceProps {
  code: number;
  isDay: boolean;
}

/** Deterministik pseudo-random üreteç — her render'da aynı partikül dizisi. */
function seeded(i: number): number {
  const x = Math.sin(i * 999.7) * 10000;
  return x - Math.floor(x);
}

function isRain(code: number): boolean {
  return [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code);
}
function isSnow(code: number): boolean {
  return [71, 73, 75, 77, 85, 86].includes(code);
}
function isThunder(code: number): boolean {
  return [95, 96, 99].includes(code);
}
function isCloudy(code: number): boolean {
  return [1, 2, 3, 45, 48].includes(code);
}
function isClear(code: number): boolean {
  return code === 0;
}

export default function WeatherAmbience({ code, isDay }: WeatherAmbienceProps) {
  const rain = isRain(code);
  const snow = isSnow(code);
  const thunder = isThunder(code);
  const clouds = isCloudy(code);
  const clear = isClear(code);
  const showPrecip = rain || snow || thunder;
  const showStars = (clear) && !isDay;
  const showClouds = clouds || (rain && !thunder && !snow); // yağmurlu ama şimşeksiz günlerde hafif bulut

  const drops = useMemo(() => {
    if (!showPrecip) return [];
    const count = 14;
    return Array.from({ length: count }, (_, i) => ({
      left: `${seeded(i * 1.31 + code) * 100}%`,
      duration: `${(0.9 + seeded(i * 2.7) * 0.9).toFixed(2)}s`,
      delay: `${(seeded(i * 3.3) * 1.8).toFixed(2)}s`,
      height: `${12 + Math.round(seeded(i * 5.1) * 14)}px`,
      width: snow ? "5px" : "2px",
      className: snow ? "w-snow" : "w-drop",
    }));
  }, [showPrecip, snow, code]);

  const starPositions = useMemo(() => {
    if (!showStars) return [];
    return Array.from({ length: 10 }, (_, i) => ({
      left: `${(sixteenth(seeded(i * 7.7 + 1)) * 90 + 5).toFixed(1)}%`,
      top: `${(seeded(i * 3.1 + 2) * 42).toFixed(1)}%`,
      duration: `${(1.8 + seeded(i * 4.4) * 2.2).toFixed(2)}s`,
      delay: `${(seeded(i * 6.2) * 3).toFixed(2)}s`,
    }));
  }, [showStars]);

  const cloudPositions = useMemo(() => {
    if (!showClouds) return [];
    const count = code === 3 || code === 45 || code === 48 ? 4 : 2;
    return Array.from({ length: count }, (_, i) => ({
      top: `${(8 + seeded(i * 2.3 + 3) * 55).toFixed(0)}%`,
      width: `${(55 + seeded(i * 4.1) * 35).toFixed(0)}px`,
      height: `${(22 + seeded(i * 1.7) * 18).toFixed(0)}px`,
      duration: `${(18 + seeded(i * 5.5) * 22).toFixed(1)}s`,
      delay: `${(seeded(i * 7.9) * 20).toFixed(1)}s`,
      opacity: `${(0.5 + seeded(i * 3.9) * 0.5).toFixed(2)}`,
    }));
  }, [showClouds, code]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {thunder && <div className="w-flash" />}
      {showClouds && (
        <div className="absolute inset-0">
          {cloudPositions.map((c, i) => (
            <span
              key={`c${i}`}
              className="w-cloud"
              style={{
                top: c.top, width: c.width, height: c.height,
                animationDuration: c.duration, animationDelay: c.delay, opacity: c.opacity,
              }}
            />
          ))}
        </div>
      )}
      {showStars && (
        <div className="absolute inset-0">
          {starPositions.map((s, i) => (
            <span
              key={`s${i}`}
              className="w-star"
              style={{
                left: s.left, top: s.top,
                animationDuration: s.duration, animationDelay: s.delay,
              }}
            />
          ))}
        </div>
      )}
      {showPrecip && (
        <div className="absolute inset-0">
          {drops.map((d, i) => (
            <span
              key={`p${i}`}
              className={d.className}
              style={{
                left: d.left, height: d.height, width: d.width,
                animationDuration: d.duration, animationDelay: d.delay,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** seeded()'i [0,1) dışına dağıtan minik yardımcı — key'lerin her render'da stabil kalması için 0.04 alt sınırı. */
function sixteenth(v: number): number {
  return Math.min(Math.max(v, 0.04), 0.96);
}