// electron/ipc.js
const { ipcMain } = require("electron");
const { getMainWindow } = require("./windowManager");
const path = require("path");
const fs = require("fs");

// ============================================================
// 原有功能
// ============================================================

function registerIPC() {
  // 窗口控制
  ipcMain.on("window-minimize", () => getMainWindow()?.minimize());
  ipcMain.on("window-maximize", () => {
    const win = getMainWindow();
    if (win) win.isMaximized() ? win.unmaximize() : win.maximize();
  });
  ipcMain.on("window-close", () => getMainWindow()?.close());
}

// ============================================================
// 🆕 Trio 控制器功能
// ============================================================

let trionapi = null;
let trioContext = null;
let isConnected = false;
const TRIO_IP = "192.168.0.250";

// 加载 Trio Addon
function loadTrioAddon() {
  try {
    // 设置 DLL 搜索路径
    const dllDir = path.join(__dirname, "dll");
    if (fs.existsSync(dllDir)) {
      process.env.PATH = dllDir + ";" + process.env.PATH;
      console.log("✅ DLL 搜索路径已设置:", dllDir);
    }

    // 开发环境路径
    const addonPath = path.join(
      __dirname,
      "addons/trio-napi/build/Release/trionapi.node",
    );

    if (!fs.existsSync(addonPath)) {
      console.error("❌ 找不到 trionapi.node:", addonPath);
      return false;
    }

    trionapi = require(addonPath);
    console.log("✅ Trio Addon 加载成功");
    console.log("📦 导出函数:", Object.keys(trionapi));
    return true;
  } catch (err) {
    console.error("❌ Trio Addon 加载失败:", err.message);
    return false;
  }
}

// 连接控制器
function connectToTrio(ip = TRIO_IP) {
  if (!trionapi) {
    if (!loadTrioAddon()) {
      return { success: false, error: "Addon 未加载" };
    }
  }

  try {
    const ret = trionapi.createTcpContext(ip);
    if (!ret.ok) {
      return { success: false, error: `创建上下文失败: ${ret.code}` };
    }

    const ctx = ret.ctx;
    const openErr = trionapi.openConnection(ctx);
    if (openErr !== 0n) {
      trionapi.destroyContext(ctx);
      return { success: false, error: `连接失败: ${openErr}` };
    }

    trioContext = ctx;
    isConnected = true;
    console.log(`✅ 已连接到 Trio 控制器: ${ip}`);
    return { success: true, ip };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 断开连接
function disconnectFromTrio() {
  if (trioContext && trionapi) {
    try {
      trionapi.closeConnection(trioContext);
      trionapi.destroyContext(trioContext);
    } catch (err) {
      console.error("断开连接错误:", err);
    }
    trioContext = null;
    isConnected = false;
    console.log("🔌 已断开 Trio 连接");
    return { success: true };
  }
  return { success: false, error: "未连接" };
}

// 获取连接状态
function getTrioStatus() {
  return { connected: isConnected };
}

// 读取 VR
function getVrValue(index) {
  if (!isConnected || !trioContext || !trionapi) {
    return { success: false, error: "未连接" };
  }
  try {
    const res = trionapi.getVrValue(trioContext, index);
    if (res.err === 0n) {
      return { success: true, value: res.value };
    }
    return { success: false, error: `读取失败: ${res.err}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 写入 VR
function setVrValue(index, value) {
  if (!isConnected || !trioContext || !trionapi) {
    return { success: false, error: "未连接" };
  }
  try {
    const err = trionapi.setVrValue(trioContext, index, value);
    if (err === 0n) {
      return { success: true };
    }
    return { success: false, error: `写入失败: ${err}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// 🆕 执行命令（带响应）
// ============================================================
function executeTrioCommand(command) {
  if (!isConnected || !trioContext || !trionapi) {
    return { success: false, error: "未连接" };
  }

  try {
    // ✅ 使用 executeWithResponse（带响应）
    const result = trionapi.executeWithResponse(trioContext, command);

    if (result.err === 0n) {
      const response = result.response
        ? result.response.replace(/\0/g, "").trim()
        : "";
      return { success: true, response: response || "✅ 执行成功" };
    } else {
      const lower32 = Number(result.err & 0xffffffffn);
      const errorMap = {
        0: "成功",
        1: "一般错误",
        3: "连接模块加载失败",
        4: "连接上下文错误",
        6: "超时",
        12: "参数错误",
        21: "未连接",
      };
      return {
        success: false,
        error: errorMap[lower32] || `错误码: ${result.err}`,
      };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// 🆕 注册 Trio IPC
// ============================================================

function registerTrioIPC() {
  // 连接
  ipcMain.handle("trio-connect", (event, ip) => {
    return connectToTrio(ip || TRIO_IP);
  });

  // 断开
  ipcMain.handle("trio-disconnect", () => {
    return disconnectFromTrio();
  });

  // 状态
  ipcMain.handle("trio-status", () => {
    return getTrioStatus();
  });

  // 读取 VR
  ipcMain.handle("trio-getVr", (event, index) => {
    return getVrValue(index);
  });

  // 写入 VR
  ipcMain.handle("trio-setVr", (event, index, value) => {
    return setVrValue(index, value);
  });

  // 执行命令
  ipcMain.handle("trio-execute", (event, command) => {
    return executeTrioCommand(command);
  });

  console.log("🔌 Trio IPC 处理器已注册");
}

// ============================================================
// 导出
// ============================================================

module.exports = {
  registerIPC,
  registerTrioIPC,
  loadTrioAddon,
  connectToTrio,
  disconnectFromTrio,
  getTrioStatus,
  getVrValue,
  setVrValue,
  executeTrioCommand,
};
