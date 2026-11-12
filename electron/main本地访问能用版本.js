const { app } = require("electron");
const { log } = require("./logger");
const { createWindow, getMainWindow } = require("./windowManager");
const { registerFileProtocolInterceptor } = require("./protocol");
const { registerIPC, registerTrioIPC } = require("./ipc");
const serial = require("./serial");
const express = require("express");

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// ==========本地http服务 监听所有网络接口==========
const HTTP_PORT = 9876;
let httpServer = null;

function startLocalHttpServer() {
  const server = express();
  server.use(express.json());

  // ✅ 配置 CORS - 允许所有来源
  server.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
    res.setHeader("Access-Control-Max-Age", "86400");

    // 处理预检请求
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // 健康检查
  server.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  server.post("/api/trio/execute", async (req, res) => {
    const win = getMainWindow();
    if (!win) {
      return res.json({ success: false, msg: "Electron窗口未就绪" });
    }
    const { cmd } = req.body;
    try {
      // 发送事件给渲染进程 TrioController.vue
      win.webContents.send("http_invoke_cmd", { cmd });
      // 等待渲染进程返回结果
      const ret = await new Promise((resolve, reject) => {
        const ipcMain = require("electron").ipcMain;
        ipcMain.once("http_invoke_result", (_, data) => {
          data.success ? resolve(data.payload) : reject(new Error(data.error));
        });
        // 设置超时
        setTimeout(() => reject(new Error("请求超时 (10s)")), 10000);
      });
      res.json({ success: true, data: ret });
    } catch (err) {
      res.json({ success: false, msg: err.message });
    }
  });

  // 监听 0.0.0.0 允许外部访问
  httpServer = server.listen(HTTP_PORT, "0.0.0.0", () => {
    log(`本地http接口启动成功 http://0.0.0.0:${HTTP_PORT}`);
    log(`  可从本机访问: http://127.0.0.1:${HTTP_PORT}`);
  });
  httpServer.on("error", (err) => {
    log(`本地http服务启动失败 ${err.message}`);
  });
}
app.whenReady().then(() => {
  app.commandLine.appendSwitch("disable-site-isolation-trials");
  app.commandLine.appendSwitch("ignore-certificate-errors");
  app.commandLine.appendSwitch("allow-insecure-localhost");

  log("Electron 就绪");

  // 启动本地http服务（场景2）
  startLocalHttpServer();

  // 先创建窗口
  createWindow();

  // 注册IPC
  registerIPC();

  // 🆕 注册 Trio IPC
  registerTrioIPC();

  // 延迟注册协议拦截
  setTimeout(() => {
    const win = getMainWindow();
    if (win) {
      registerFileProtocolInterceptor(win);
    }
  }, 300);

  // 初始化串口
  const win = getMainWindow();
  serial.initSerial(win);
  serial.registerSerialIPC();
});

app.on("window-all-closed", () => {
  if (httpServer) httpServer.close();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (getMainWindow() === null) {
    createWindow();
  }
});

// 🆕 退出时断开 Trio 连接
app.on("will-quit", () => {
  if (httpServer) httpServer.close();
  const { disconnectFromTrio } = require("./ipc");
  disconnectFromTrio();
});

// 错误捕获
process.on("uncaughtException", (err) => {
  log(`崩溃: ${err.message}`);
});
process.on("unhandledRejection", (reason) => {
  log(`Promise 异常: ${reason}`);
});

log("主进程初始化完成");
