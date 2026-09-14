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
}