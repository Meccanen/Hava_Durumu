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