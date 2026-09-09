import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * ============================================================================
 * BİLDİRİM ALTYAPISI (yerel/zamanlanmış bildirimler)
 * ============================================================================
 * Namaz Vakti'de yaşanan derslerden kaçınıyoruz:
 * - smallIcon MUTLAKA gerçekten var olan bir kaynağa işaret etmeli (aksi
 *   halde bildirimler SESSİZCE hiç ateşlenmiyor). Bkz. capacitor.config.json
 *   → plugins.LocalNotifications.smallIcon = "ic_stat_notify" ve
 *   build-apk.yml'deki ikon üretim script'i (drawable klasörlerindeki
 *   ic_stat_notify.png dosyaları).
 * - `checkExactNotificationSetting` gibi native, cihazda çökmeye sebep olan
 *   deneysel API'ler KULLANILMIYOR.
 * - Sabit bildirim ID'leri kullanıyoruz (çoklama/yığılma olmasın diye) —
 *   Namaz Vakti'nin "6 sabit ID" pratiğiyle aynı mantık.
 *
 * Şu an İKİ tür bildirim destekleniyor:
 *
 * 1) "Günlük özet": sabit saatte her gün TETİKLENMESİ garanti (native
 *    repeating alarm), İÇERİĞİ App.tsx tarafında her hava verisi
 *    yenilendiğinde (uygulama her açıldığında) canlı veriyle üzerine
 *    yazılıyor. `body` kısa/collapsed görünüm, `largeBody` genişletilmiş
 *    (BigTextStyle) tam içerik — Android bildirimi açılınca tam metni
 *    gösterir.
 *
 * 2) "Ani değişim uyarısı": uygulama her açıldığında önümüzdeki ~23 saatlik
 *    tahmindeki HER ARDIŞIK SAAT ÇİFTİ karşılaştırılır (saat[i] vs
 *    saat[i+1]). Önemli bir fark (≥5°C sıcaklık veya ≥25 puan yağış
 *    ihtimali, iki yönde de) tespit edilirse:
 *    - Değişim "şu an" veya geçmişte kalan bir saate denk geliyorsa HEMEN
 *      gösterilir (fireImmediateChangeAlert)
 *    - Gelecekteki bir saate denk geliyorsa, o saatten TAM 1 SAAT ÖNCESİNE
 *      (saat[i]'nin başlangıcına) zamanlanır (scheduleFutureChangeAlert) —
 *      "gelecek bir saat içinde X olacak" şeklinde önceden haber verir.
 *    Her olası saat dilimi (0-22 arası, ~23 slot) için SABİT bir ID
 *    ayrılmıştır; her yeniden hesaplamada slot ya güncellenir ya da (artık
 *    geçerli değilse) iptal edilir — çoklama/eskimiş bildirim kalmaz.
 *    Bu app-open tetiklemeli, en-iyi-çaba bir çözüm — sürekli arka plan
 *    izleme gerektiren gerçek "ani hava değişikliği" tespiti VPS/n8n + FCM
 *    push ile gelecek (ayrı ve daha sonraki bir adım, bu dosyanın kapsamında
 *    değil).
 */

const DAILY_SUMMARY_NOTIFICATION_ID = 9001;
const IMMEDIATE_CHANGE_ALERT_ID = 9002;
const FUTURE_CHANGE_ALERT_BASE_ID = 9200; // 9200..9222 arası, saat slotu başına 1 ID
export const FUTURE_CHANGE_ALERT_SLOT_COUNT = 23;

export async function hasNotificationPermission(): Promise<boolean> {
  try {
    const { display } = await LocalNotifications.checkPermissions();
    return display === 'granted';
  } catch (error) {
    console.error('[notificationService] İzin kontrolü başarısız:', error);
    return false;
  }
}

/** İzin iste. Kullanıcı reddederse false döner — çağıran taraf buna göre UI göstermeli. */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted';
  } catch (error) {
    console.error('[notificationService] İzin isteme başarısız:', error);
    return false;
  }
}

/**
 * Her gün belirtilen saatte tekrarlayan tek bir yerel bildirim kurar.
 * Sabit ID kullanıldığı için tekrar çağrılması (ör. kullanıcı saati
 * değiştirdiğinde) öncekinin üzerine yazar, çoklamaz. `largeBody` verilirse
 * Android'de bildirim genişletildiğinde (BigTextStyle) tam metin gösterilir;
 * `body` her zaman kısa/collapsed görünümde kalır.
 */
export async function scheduleDailySummaryNotification(
  hour: number,
  minute: number,
  title: string,
  body: string,
  largeBody?: string
): Promise<void> {
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: DAILY_SUMMARY_NOTIFICATION_ID,
          title,
          body,
          ...(largeBody ? { largeBody } : {}),
          schedule: {
            on: { hour, minute },
            repeats: true,
            allowWhileIdle: true,
          },
        },
      ],
    });
  } catch (error) {
    console.error('[notificationService] Günlük bildirim zamanlanamadı:', error);
  }
}

export async function cancelDailySummaryNotification(): Promise<void> {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: DAILY_SUMMARY_NOTIFICATION_ID }] });
  } catch (error) {
    console.error('[notificationService] Günlük bildirim iptal edilemedi:', error);
  }
}

/**
 * Şu anki veya geçmişte kalmış bir değişim için HEMEN (schedule verilmeden)
 * tek seferlik bir bildirim gösterir. Sabit ID kullanıldığı için art arda
 * tetiklenirse yığılmaz.
 */
export async function fireImmediateChangeAlert(title: string, body: string): Promise<void> {
  try {
    await LocalNotifications.schedule({
      notifications: [{ id: IMMEDIATE_CHANGE_ALERT_ID, title, body }],
    });
  } catch (error) {
    console.error('[notificationService] Ani değişim bildirimi gösterilemedi:', error);
  }
}

/**
 * Gelecekteki belirli bir ana (fireAt) zamanlanan tek seferlik bir değişim
 * uyarısı. `slotIndex` (0-22), bu saat dilimine ayrılmış sabit ID'yi seçer —
 * aynı slotun tekrar çağrılması öncekini günceller, çoklamaz.
 */
export async function scheduleFutureChangeAlert(
  slotIndex: number,
  fireAt: Date,
  title: string,
  body: string
): Promise<void> {
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: FUTURE_CHANGE_ALERT_BASE_ID + slotIndex,
          title,
          body,
          schedule: { at: fireAt, allowWhileIdle: true },
        },
      ],
    });
  } catch (error) {
    console.error(`[notificationService] Gelecek değişim uyarısı (slot ${slotIndex}) zamanlanamadı:`, error);
  }
}

export async function cancelFutureChangeAlert(slotIndex: number): Promise<void> {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: FUTURE_CHANGE_ALERT_BASE_ID + slotIndex }] });
  } catch (error) {
    console.error(`[notificationService] Gelecek değişim uyarısı (slot ${slotIndex}) iptal edilemedi:`, error);
  }
}
