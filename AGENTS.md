# Hava — Proje Notları (Kritik: bu dosyayı oku!)

Capacitor Android uygulaması. Remote: `https://github.com/Meccanen/Hava_Durumu.git` (branch `main`).
Workflow: `.github/workflows/build-apk.yml`.

## ÇÖZÜLMÜŞ KRİTİK BUG (12 Eyl 2026 — GERİ GETİRME)

**Belirti:** APK açılışta `NoClassDefFoundError: ReportFragment` ile çöküyordu.

**Kök neden:** AndroidX Lifecycle **2.8.x = KMP (multiplatform)**. `debugRuntimeClasspath`'te
desktop/jvm KMP varyantları (`lifecycle-runtime-desktop`, `lifecycle-viewmodel-desktop`,
`lifecycle-common-jvm` ± 2.8.5) resolve ediliyor ve APK'ya giriyordu. `ReportFragment`
yalnızca `-android` AAR'ında bulunur; desktop sınıfları APK'ya girince runtime'da bulunamıyor.

**ÇALIŞAN ÇÖZÜM (`6353497`):** Workflow'un FIX adımında, root `android/build.gradle`'a
`allprojects { configurations.all { resolutionStrategy { force 'androidx.lifecycle:*:2.6.2' } } }`
eklendi. **Lifecycle 2.6.2 = KMP-öncesi tek-varyant** → desktop/jvm koordinatları *yok* →
KMP attribute selection devre dışı. App'e `lifecycle-process:2.6.2`, `lifecycle-runtime:2.6.2`,
`lifecycle-common:2.6.2` explicit eklendi. **SONUÇ: Çöktü → çalışıyor ✓**

## DENENDİ VE BAŞARISIZ OLANLAR (tekrar deneme!)

1. **`dependencySubstitution`** (`substitute(module(...)).using(module(...))`):
   - Sözdizimsel form Groovy DSL hatası (`DefaultDependencySubstitutions.using()`);
   - Doğru parantezli form da derleme hatası (`LifecycleOwner not found`) — KMP attribute
     selection'ı substitution yakalayamıyor. **KULLANMA.**
2. **Proje geneli `exclude group: 'androidx.lifecycle', module: '...-desktop'/-jvm'`:**
   - 2.8.5 graph'ında desktop/jvm yine geliyor + `MainActivity.java:5` `class file for
     androidx.lifecycle.LifecycleOwner not found` compile hatası bırakıyor. **KULLANMA.**
3. **Workflow içinde `working-directory: android`'un altında relative `android/build.gradle`
   path'i:** `android/android/build.gradle` çözümlenip "No such file or directory" → CI kırmızı.
   Gradle dosyalarını yazan adımda her zaman `${GITHUB_WORKSPACE}`-absolute path kullan.

## SESLENME KURALLARI (workflow desenleri)

- FIX/TESPİT adımlarında build'den önce önce graph dök (`./gradlew :app:dependencies
  --configuration debugRuntimeClasspath | grep lifecycle | sort -u`).
- Exclude/substitution yerine **force 2.6.2** yaklaşımı kalıcıdır; lifecycle'ı yükseltme
  (2.8+) CSR gerektirir (KMP geri döner).
- YAML edit'inde heredoc'u bash'e gömmeyin; önce `/tmp`'ye ayrı script dosyası (`write`) yazıp
  `python3` ile koşun. YAML'ı her zaman `yaml.safe_load` ile doğrula.

## GOOGLE PLAY BILLING (ABONELİK — 15 Eyl 2026)

**Amaç:** Reklamları kaldırma (banner + ödüllü kilitler) — abonelikle.
- Aylık €0.99 / Yıllık €6.99.

**Play Console ürün yapısı:**
- Ürün: `premium` (subscription), base plan'lar: `monthly` / `yearly`.
- Kodda sabit: `PREMIUM_PRODUCT_ID="premium"`, `MONTHLY_PLAN_ID="monthly"`, `YEARLY_PLAN_ID="yearly"`.

**Plugin:** `@capgo/native-purchases@6.0.42` (Capacitor 6).
- Manifest'i BOŞ → `com.android.vending.BILLING` izni CI'da Python ile eklenir (workflow satır ~319 civarı).
- `restorePurchases()` → `customerInfo.activeSubscriptions` içinde `premium` aranır.
- `purchaseProduct({ productIdentifier: 'premium', planIdentifier: 'monthly'|'yearly', productType: 'subs' })`.

**UI:** Header'da Crown butonu → PremiumModal (aylık/yıllık kart + restore).
- Premiumdurumu: `src/services/billingService.ts` — `isPremiumCached()`, `refreshPremiumStatus()`.
- `App.tsx`: `isPremium` state; banner effect koşullu; `handleOpenDetail/Map/Share` premium'da direkt açılır.
- `WeatherDashboard`: `mapLocked` etiketi → premium'da `premiumUnlocked` gösterilir.

**Denendi/başarısız:** native-purchases ile plan başına fiyat ayrımı (Product.priceString) yapılamıyor — fallback statik €0.99/€6.99 kullanılır.

**CI Notları:**
- Web build (`npm run build`) native billing desteklemez; `isWeb()` kontrolü ile localStorage fallback.
- test ederken: `localStorage.setItem("mhd_premium","true")` → tüm reklamlar/ kilitler açılır.