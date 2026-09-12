# Meccanen Hava Durumu

Meccanen Namaz Vakti'nin çerçevesi (tema sistemi, dil desteği, konum yönetimi)
korunarak oluşturulan hava durumu uygulaması.
Mevcut durum ve 3 günlük tahmin **WeatherAPI.com**'dan alınıyor (tek API çağrısı:
mevcut durum + saatlik/günlük tahmin + astronomi + hava kalitesi + uyarılar + UV).
API anahtarı `VITE_WEATHER_API_KEY` ortam değişkeniyle verilir — açık-kaynak
istemci derlendiğinde bu key pakete girer, bu yüzden ücretsiz katman limitlerine
dikkat edilmelidir (detaylar: `src/services/weatherService.ts`).

## Ortam değişkenleri (.env)

Geliştirmede kullanılan tüm değişkenler `.env.example` dosyasında açıklamalarıyla
birlikte listelenmiştir:

1. `.env.example` dosyasını kopyalayıp `.env` olarak kaydet: `cp .env.example .env`
2. Değerleri doldur (WeatherAPI anahtarı + AdMob birim ID'leri).
3. `npm run dev` ile başlat.

CI build'leri (GitHub Actions) bu değerleri `.env` dosyasından değil, repo
**Secrets**'larından okur (bkz. `.github/workflows/build-apk.yml`). Şu secret'lar
gerekli:

| Secret | Gerekli | Açıklama |
|---|---|---|
| `WEATHER_API_KEY` | zorunlu | WeatherAPI.com API anahtarı |
| `ADMOB_BANNER_ID` | zorunlu | AdMob banner birim ID |
| `ADMOB_REWARDED_INTERSTITIAL_ID` | zorunlu | AdMob ödüllü geçiş reklamı birim ID |
| `ADMOB_APP_ID` | zorunlu | AdMob uygulama ID (native Manifest'e enjekte edilir) |
| `ADMOB_TEST_DEVICE_IDS` | opsiyonel | virgülle ayrılmış test cihaz ID'leri |
| `KEYSTORE_BASE64` / `KEYSTORE_PASSWORD` / `KEY_ALIAS` / `KEY_PASSWORD` | opsiyonel (imzalı AAB için) | Release keystore |
| `DEBUG_KEYSTORE_BASE64` | opsiyonel | Sabit debug keystore (test cihaz ID'sinin build'ler arası değişmemesi için önerilir) |

Bunları repo **Settings → Secrets and variables → Actions** altına ekle.

## GitHub'a yükleme sırası

1. Bu klasördeki tüm dosya ve klasörleri repo köküne (`Reklamsiz_Hava_Durumu`) yükle,
   klasör yapısını birebir koru (`src/`, `local-plugins/`, `.github/workflows/`).
2. **public/meccanen-logo.png** dosyasını ekle (1024×1024 PNG, şeffaf zemin) —
   workflow ikon üretimi için bu dosyayı arıyor, yoksa build hata verir.
3. (İsteğe bağlı, imzalı AAB için) `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`,
   `KEY_ALIAS`, `KEY_PASSWORD` secret'larını repo Settings → Secrets and
   variables → Actions altına ekle.
4. **Actions** sekmesinden workflow'u tetikle (`workflow_dispatch`) veya `main`
   dalına push yaparak otomatik build'i başlat.

## Bilinçli olarak henüz eklenmedi

- Ana ekranın nihai görsel tasarımı (şu an fonksiyonel ama sade bir arayüz var,
  namaz vaktindeki gibi zenginleştirilecek)
- Play Console ürün ID'leri (`billingService.ts` içinde `SUPPORTER_PRODUCT_IDS`
  namaz vaktindeki ID'lerle aynı — yeni appId için Play Console'da yeni ürünler
  oluşturulup ID'ler burada güncellenmeli)
- App ikonu / feature graphic
- Gizlilik politikası sayfası (TR/EN)
