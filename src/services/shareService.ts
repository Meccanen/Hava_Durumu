import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { toPng } from "html-to-image";

/**
 * Hero kartının PNG görüntüsünü üretip yerel paylaşım penceresiyle
 * paylaştıran servis (WhatsApp, Instagram vb. — android:share intent).
 *
 * Web'de (vite dev/CI) @capacitor/share çalışmadığı için fallback olarak
 * görsel indirme tetikler — böylece hem masaüstünde hem CI'da akış test
 * edilebilir. Native'de (Android APK) görsel Cache klasörüne yazılır ve
 * Share plugin'iyle content:// URI üzerinden dışarı verilir.
 */
export async function shareWeatherCard(
  node: HTMLElement,
  opts: { title: string; text: string }
): Promise<void> {
  // Paylaşım görseli markalama: hero içindeki [data-share-brand] etiketi
  // normalde görünmez (opacity:0); yalnızca yakalama anında görünür yapılır.
  // [data-share-hide] elemanları (örn. paylaş butonu) ise görselde yer
  // almamalı — yakalama boyunca gizlenir. Markaya yer açmak için node'a
  // geçici alt boşluk eklenir (absolute bottom marka, içeriğin altına düşer).
  const brandEl = node.querySelector<HTMLElement>("[data-share-brand]");
  const hideEls = Array.from(node.querySelectorAll<HTMLElement>("[data-share-hide]"));
  const prevPaddingBottom = node.style.paddingBottom;
  if (brandEl) { brandEl.style.opacity = "1"; node.style.paddingBottom = "72px"; }
  hideEls.forEach((el) => { el.style.display = "none"; });
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const dataUrl = await toPng(node, {
      pixelRatio: 2,
      cacheBust: true,
    });

    if (Capacitor.isNativePlatform()) {
      const path = `meccanen-weather-${Date.now()}.png`;
      const base64 = dataUrl.split(",")[1];
      await Filesystem.writeFile({
        path,
        data: base64,
        directory: Directory.Cache,
      });
      const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
      await Share.share({ title: opts.title, text: opts.text, files: [uri] });
    } else {
      // Web fallback — @capacitor/share web desteklemez; indirme yap.
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `meccanen-weather-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  } finally {
    if (brandEl) { brandEl.style.opacity = ""; node.style.paddingBottom = prevPaddingBottom; }
    hideEls.forEach((el) => { el.style.display = ""; });
  }
}