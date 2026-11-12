const { app, ipcMain } = require("electron");
const { log } = require("./logger");
const { createWindow, getMainWindow } = require("./windowManager");
const { registerFileProtocolInterceptor } = require("./protocol");
const { registerIPC, registerTrioIPC, disconnectFromTrio } = require("./ipc");
const serial = require("./serial");
const express = require("express");
const os = require("os");

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// ========== 本地http服务 监听所有网络接口 ==========
const HTTP_PORT = 9876;
let httpServer = null;

// ========== 获取本机 IP ==========
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

// ========== 启动本地 HTTP 服务 ==========
function startLocalHttpServer() {
  const server = express();
  server.use(express.json());

  // ✅ 配置 CORS - 允许所有来源（开发环境）
  server.use((req, res, next) => {
    const origin = req.headers.origin;

    // 允许的来源列表
    const allowedOrigins = [
      "http://8.138.158.114:8005",
      "http://localhost:8005",
      "http://127.0.0.1:8005",
      `http://${getLocalIP()}:8005`,
    ];

    // 如果来源在白名单中，或者是开发环境，允许访问
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      process.env.NODE_ENV === "development"
    ) {
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
    }

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
    res.json({
      status: "ok",
      timestamp: Date.now(),
      ip: getLocalIP(),
      port: HTTP_PORT,
    });
  });

  // 获取本机 IP（供 H5 页面动态获取）
  server.get("/api/local-ip", (req, res) => {
    res.json({
      ip: getLocalIP(),
      port: HTTP_PORT,
    });
  });

  // Trio 命令执行接口
  server.post("/api/trio/execute", async (req, res) => {
    const win = getMainWindow();
    if (!win) {
      return res.json({ success: false, msg: "Electron窗口未就绪" });
    }

    const { cmd } = req.body;
    if (!cmd) {
      return res.json({ success: false, msg: "缺少 cmd 参数" });
    }

    // 生成唯一请求 ID
    const requestId =
      Date.now() + "_" + Math.random().toString(36).substr(2, 6);

    try {
      // 发送事件给渲染进程 TrioController.vue
      win.webContents.send("http_invoke_cmd", { cmd, requestId });

      // 等待渲染进程返回结果
      const ret = await new Promise((resolve, reject) => {
        const handler = (_, data) => {
          if (data.requestId === requestId) {
            ipcMain.removeListener("http_invoke_result", handler);
            clearTimeout(timer);
            data.success
              ? resolve(data.payload)
              : reject(new Error(data.error));
          }
        };

        ipcMain.on("http_invoke_result", handler);

        // 设置超时
        const timer = setTimeout(() => {
          ipcMain.removeListener("http_invoke_result", handler);
          reject(new Error("请求超时 (10s)"));
        }, 10000);
      });

      res.json({ success: true, data: ret });
    } catch (err) {
      res.json({ success: false, msg: err.message });
    }
  });

  // 监听 0.0.0.0 允许外部访问
  const localIP = getLocalIP();
  httpServer = server.listen(HTTP_PORT, "0.0.0.0", () => {
    log(`🚀 本地 HTTP 接口启动成功`);
    log(`  📍 本机访问: http://127.0.0.1:${HTTP_PORT}`);
    log(`  🌐 外部访问: http://${localIP}:${HTTP_PORT}`);
    log(`  🔗 远程服务器请使用: http://${localIP}:${HTTP_PORT}`);
  });

  httpServer.on("error", (err) => {
    log(`❌ 本地 HTTP 服务启动失败: ${err.message}`);
  });
}

// ========== 关闭 HTTP 服务 ==========
function closeHttpServer() {
  if (httpServer) {
    httpServer.close(() => {
      log("HTTP 服务已关闭");
    });
    httpServer = null;
  }
}

// ========== 应用初始化 ==========
app.whenReady().then(() => {
  app.commandLine.appendSwitch("disable-site-isolation-trials");
  app.commandLine.appendSwitch("ignore-certificate-errors");
  app.commandLine.appendSwitch("allow-insecure-localhost");

  log("🚀 Electron 应用就绪");

  // 启动本地http服务
  startLocalHttpServer();

  // 先创建窗口
  createWindow();

  // 注册IPC
  registerIPC();

  // 注册 Trio IPC
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

// ========== 生命周期事件 ==========
app.on("window-all-closed", () => {
  closeHttpServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (getMainWindow() === null) {
    createWindow();
  }
});

// 退出时断开 Trio 连接
app.on("will-quit", () => {
  closeHttpServer();
  disconnectFromTrio();
});

// ========== 错误捕获 ==========
process.on("uncaughtException", (err) => {
  log(`💥 崩溃: ${err.message}`);
  log(err.stack);
});

process.on("unhandledRejection", (reason) => {
  log(`💥 Promise 异常: ${reason}`);
});

log("✅ 主进程初始化完成");
