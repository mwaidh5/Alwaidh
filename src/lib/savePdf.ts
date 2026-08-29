/** True when running inside the Capacitor native app. */
function isNativeApp(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export type SaveResult = 'saved' | 'shared' | 'opened' | 'failed';

/**
 * Hand a generated file to the person, wherever they are running.
 *
 * A browser downloads it. The app can't: `pdf.save()` and every other
 * download is an invisible <a download> click, and a web view has no
 * download manager to catch it — the button simply did nothing.
 *
 * There, the file is written to the app's own storage and handed to the
 * system share sheet, which is what "save" means on a phone: send it to
 * WhatsApp, or into Files. Older builds of the app don't carry those
 * plugins, so that path can fail; the file is then opened in the web view
 * instead, which at least puts it on screen.
 */
export async function saveFile(blob: Blob, filename: string): Promise<SaveResult> {
  if (!isNativeApp()) {
    const url = URL.createObjectURL(blob);
    // On a phone browser a silent download disappears into a folder nobody
    // opens — a new tab shows the PDF right away, with the browser's own
    // share/save on it. Falls back to the download when pop-ups are blocked.
    if (window.matchMedia('(pointer: coarse)').matches) {
      const opened = window.open(url, '_blank');
      if (opened) {
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return 'opened';
      }
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoked late: Safari cancels the download if the URL dies too soon.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return 'saved';
  }

  try {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const data = await toBase64(blob);
    // Cache, not Documents: this is a copy to pass on, not something the
    // person asked us to keep, and the system can reclaim it.
    const written = await Filesystem.writeFile({
      path: filename,
      data,
      directory: Directory.Cache,
    });
    await Share.share({ title: filename, url: written.uri });
    return 'shared';
  } catch (e) {
    console.warn('Native save unavailable, opening instead:', e);
  }

  try {
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    if (opened) return 'opened';
  } catch {
    /* fall through */
  }
  return 'failed';
}

/** Filesystem takes base64, not a Blob. */
function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      // "data:application/pdf;base64,XXXX" → "XXXX"
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}
