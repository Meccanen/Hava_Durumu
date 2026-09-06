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
 * - Sabit bildirim ID'si kullanıyoruz (çoklama/yığılma olmasın diye) —
 *   Namaz Vakti'nin "6 sabit ID" pratiğiyle aynı mantık.
 *
 * Şu an SADECE tek bir "günlük özet" bildirimi destekleniyor: sabit saatte
 * her gün TETİKLENMESİ garanti (native repeating alarm — Namaz Vakti'nin
 * kanıtlanmış deseni), ama İÇERİĞİ (sıcaklık/açıklama/yağış) App.tsx
 * tarafında her hava verisi yenilendiğinde (uygulama her açıldığında) canlı
 * veriyle üzerine yazılıyor — aynı ID ile tekrar schedule() çağrısı, bir
 * sonraki tetiklenmede kullanılacak metni günceller. Yani içerik en son ne
 * zaman uygulama açıldıysa o kadar taze olur; VPS/n8n devreye girene kadarki
 * geçici/en-iyi-çaba çözüm bu. Sunucu taraflı "ani hava değişikliği" push
 * bildirimi (VPS/n8n + FCM) ayrı ve daha sonraki bir adım — bu dosyanın
 * kapsamında değil.
 */

const DAILY_SUMMARY_NOTIFICATION_ID = 9001;

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
 * değiştirdiğinde) öncekinin üzerine yazar, çoklamaz.
 */
export async function scheduleDailySummaryNotification(
  hour: number,
  minute: number,
  title: string,
  body: string
): Promise<void> {
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: DAILY_SUMMARY_NOTIFICATION_ID,
          title,
          body,
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
