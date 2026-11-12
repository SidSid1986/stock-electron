const { ipcMain } = require("electron");

const { getMainWindow } = require("./windowManager");

function registerIPC() {
  // 窗口控制
  ipcMain.on("window-minimize", () => getMainWindow()?.minimize());
  ipcMain.on("window-maximize", () => {
    const win = getMainWindow();
    if (win) win.isMaximized() ? win.unmaximize() : win.maximize();
  });
  ipcMain.on("window-close", () => getMainWindow()?.close());
}

module.exports = { registerIPC };
