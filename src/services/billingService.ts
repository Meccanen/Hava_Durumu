import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { Capacitor } from '@capacitor/core';

/**
 * Meccanen Hava Durumu — Google Play Billing abonelik servisi.
 *
 * Ürün yapısı (Google Play Console ile BİREBİR eşleşmelidir):
 *   - Abonelik ürünü: `premium`
 *   - Base plan (aylık €0.99): `monthly`
 *   - Base plan (yıllık €6.99): `yearly`
 *
 * Premium: reklamları kaldırır (banner + tüm ödüllü reklamla açılan
 * detaylar). Durum, uygulama açılışında restorePurchases() ile Google'dan
 * doğrulanır; localStorage önbelleği yalnızca hızlı ilk render içindir.
 */

export const PREMIUM_PRODUCT_ID = "premium";
export const MONTHLY_PLAN_ID = "monthly";
export const YEARLY_PLAN_ID = "yearly";

const PREMIUM_CACHE_KEY = "mhd_premium";

// npm run build (web/dev) ortamında native plugin çağrıları çalışmaz; bu
// bayrak web/yerel geliştirmede gerçek akışları test etmek içindir.
// Örnek: localStorage.setItem("mhd_premium", "true") → tüm reklamlar kalkar.
function isWeb(): boolean {
  return Capacitor.getPlatform() === "web";
}

function readCache(): boolean {
  try { return localStorage.getItem(PREMIUM_CACHE_KEY) === "true"; }
  catch { return false; }
}

function writeCache(val: boolean): void {
  try { localStorage.setItem(PREMIUM_CACHE_KEY, String(val)); }
  catch { /* sessiz geç */ }
}

/** Senkron önbellek değeri (ilk render için — hızlı, doğrulanmamış). */
export function isPremiumCached(): boolean {
  return readCache();
}

/**
 * Google'ın abonelik durumunu doğrular. Açılışta ve satın alma sonrasında
 * çağrılır. `premium` ürününden aktif bir abonelik varsa true döner ve
 * önbelleği günceller.
 */
export async function refreshPremiumStatus(): Promise<boolean> {
  if (isWeb()) return readCache();
  try {
    const { customerInfo } = await NativePurchases.restorePurchases();
    const active = ((customerInfo.activeSubscriptions as unknown as string[]) || []).includes(PREMIUM_PRODUCT_ID);
    writeCache(active);
    return active;
  } catch (e) {
    console.error("[billingService] Premium durumu alınamadı, önbellek kullanılıyor:", e);
    return readCache();
  }
}

/**
 * Aylık planı (€0.99) satın alır; başarılıysa önbelleği günceller.
 */
export async function purchaseMonthly(): Promise<boolean> {
  return purchasePlan(MONTHLY_PLAN_ID);
}

/** Yıllık planı (€6.99) satın alır; başarılıysa önbelleği günceller. */
export async function purchaseYearly(): Promise<boolean> {
  return purchasePlan(YEARLY_PLAN_ID);
}

async function purchasePlan(planIdentifier: string): Promise<boolean> {
  if (isWeb()) {
    writeCache(true);
    return true;
  }
  try {
    await NativePurchases.purchaseProduct({
      productIdentifier: PREMIUM_PRODUCT_ID,
      planIdentifier,
      productType: PURCHASE_TYPE.SUBS,
    });
    writeCache(true);
    return true;
  } catch (e) {
    // Kullanıcı satın alma diyaloğunu iptal ettiyse veya ödeme başarısızsa
    // buraya düşer; premium aktifleşmez.
    console.error("[billingService] Satın alma tamamlanamadı:", e);
    return false;
  }
}

/** (Debug) Önbellek değerini manuel olarak ayarlar — web testleri için. */
export function setPremiumForTesting(val: boolean): void {
  writeCache(val);
}