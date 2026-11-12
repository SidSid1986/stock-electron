const { contextBridge, ipcRenderer } = require("electron");

// 安全检查 - 确保只暴露需要的API
try {
  contextBridge.exposeInMainWorld("electronAPI", {
    // 窗口控制方法
    minimizeWindow: () => {
      try {
        ipcRenderer.send("window-minimize");
      } catch (error) {
        console.error("Minimize window error:", error);
      }
    },
    maximizeWindow: () => {
      try {
        ipcRenderer.send("window-maximize");
      } catch (error) {
        console.error("Maximize window error:", error);
      }
    },
    closeWindow: () => {
      try {
        ipcRenderer.send("window-close");
      } catch (error) {
        console.error("Close window error:", error);
      }
    },

    // =====================  通用invoke方法 =====================
    invoke: (channel, ...args) => {
      try {
        const validChannels = [
          "get-music-files",
          "serial-list",
          "serial-open",
          "serial-close",
          "serial-send-hex",
          "modbus-read-holding",
          "modbus-write-single",
          "modbus-write-multi",
        ];

        if (validChannels.includes(channel)) {
          return ipcRenderer.invoke(channel, ...args);
        } else {
          console.error(`Invalid channel: ${channel} (not in whitelist)`);
          return Promise.reject(new Error(`Invalid channel: ${channel}`));
        }
      } catch (error) {
        console.error(`Invoke error for channel ${channel}:`, error);
        return Promise.reject(error);
      }
    },

    // 内存使用监听
    onMemoryUsage: (callback) => {
      if (typeof callback === "function") {
        const listener = (_, data) => {
          try {
            const safeData = data || { used: "0", total: "0" };
            callback(safeData);
          } catch (error) {
            console.error("Memory usage listener error:", error);
          }
        };
        ipcRenderer.on("memory-usage", listener);
        return () => ipcRenderer.off("memory-usage", listener);
      }
    },

    // 全屏状态监听
    onFullScreenStatus: (callback) => {
      if (typeof callback === "function") {
        const listener = (_, data) => {
          try {
            const safeData = data || { isFullScreen: false };
            callback(safeData);
          } catch (error) {
            console.error("Fullscreen status listener error:", error);
          }
        };
        ipcRenderer.on("fullscreen-status", listener);
        return () => ipcRenderer.off("fullscreen-status", listener);
      }
    },

    // 移除所有监听
    removeAllListeners: () => {
      try {
        ipcRenderer.removeAllListeners("memory-usage");
        ipcRenderer.removeAllListeners("fullscreen-status");
        ipcRenderer.removeAllListeners("serial-receive");
      } catch (error) {
        console.error("Remove listeners error:", error);
      }
    },

    // ===================== 【串口 + Modbus 完整API】 =====================
    serialList: () => ipcRenderer.invoke("serial-list"),
    serialOpen: (options) => ipcRenderer.invoke("serial-open", options),
    serialClose: () => ipcRenderer.invoke("serial-close"),
    serialSendHex: (hex) => ipcRenderer.invoke("serial-send-hex", hex),

    modbusReadHolding: (opts) =>
      ipcRenderer.invoke("modbus-read-holding", opts),
    modbusWriteSingle: (opts) =>
      ipcRenderer.invoke("modbus-write-single", opts),
    modbusWriteMulti: (opts) => ipcRenderer.invoke("modbus-write-multi", opts),

    onSerialReceive: (callback) => {
      const listener = (_, data) => callback(data);
      ipcRenderer.on("serial-receive", listener);
      return () => ipcRenderer.off("serial-receive", listener);
    },

    // 错误监听
    onSerialError: (callback) => {
      const listener = (_, msg) => callback(msg);
      ipcRenderer.on("serial-error", listener);
      return () => ipcRenderer.off("serial-error", listener);
    },
  });

  console.log("Electron API exposed successfully");
} catch (error) {
  console.error("Failed to expose Electron API:", error);
}
