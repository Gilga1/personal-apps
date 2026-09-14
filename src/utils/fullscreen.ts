import { isWebMode } from "../api/stacks";

export async function toggleFullscreen(): Promise<boolean> {
  if (isWebMode()) {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return false;
    }
    await document.documentElement.requestFullscreen();
    return true;
  }

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  const next = !(await win.isFullscreen());
  await win.setFullscreen(next);
  return next;
}

export async function isFullscreen(): Promise<boolean> {
  if (isWebMode()) {
    return !!document.fullscreenElement;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return await getCurrentWindow().isFullscreen();
}
