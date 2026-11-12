const { session } = require("electron");
const { BACKEND_ADDRESS } = require("./config");
const { log } = require("./logger");

// 接收传入的 win 对象！！！
function registerFileProtocolInterceptor(win) {
  session.defaultSession.webRequest.onBeforeRequest(
    {
      urls: [
        "file:///*/api*",
        "file:///*/sys*",
        "file:///api*",
        "file:///sys*",
      ],
    },
    () => {},
  );

  // File 适配 Windows 盘符路径
  session.defaultSession.webRequest.onBeforeRequest(
    {
      urls: [
        "file:///*/api*",
        "file:///*/sys*",
        "file:///api*",
        "file:///sys*",
      ],
    },
    (details, callback) => {
      try {
        const url = details.url.toLowerCase();
        if (url.includes("/api/") || url.includes("/sys/")) {
          let path = details.url
            .replace(/^file:\/+/, "")
            .replace(/^[A-Za-z]:\//, "/")
            .replace(/\\/g, "/");

          if (!path.startsWith("/api") && !path.startsWith("/sys")) {
            const apiIndex = path.indexOf("/api");
            const sysIndex = path.indexOf("/sys");
            const startIndex = apiIndex !== -1 ? apiIndex : sysIndex;
            if (startIndex !== -1) {
              path = path.slice(startIndex);
            }
          }

          const baseUrl = `http://${BACKEND_ADDRESS}`;
          const encodedUrl = new URL(path, baseUrl).href.replace(/ /g, "%20");

          callback({
            redirectURL: encodedUrl,
            statusCode: 307,
            responseHeaders: { "Cache-Control": "no-cache" },
          });
          return;
        }
        callback({ cancel: false });
      } catch (error) {
        console.error(`[拦截失败] ${error.message} | 地址: ${details.url}`);
        callback({ cancel: false });
      }
    },
  );

  // 传入的 win
  if (win) {
    win.webContents.session.webRequest.onBeforeRequest(
      {
        urls: [
          "file:///*/api*",
          "file:///*/sys*",
          "file:///api*",
          "file:///sys*",
        ],
      },
      (details, callback) => {
        try {
          const url = details.url.toLowerCase();
          if (url.includes("/api/") || url.includes("/sys/")) {
            let path = details.url
              .replace(/^file:\/+/, "")
              .replace(/^[A-Za-z]:\//, "/")
              .replace(/\\/g, "/");

            if (!path.startsWith("/api") && !path.startsWith("/sys")) {
              const apiIndex = path.indexOf("/api");
              const sysIndex = path.indexOf("/sys");
              const startIndex = apiIndex !== -1 ? apiIndex : sysIndex;
              if (startIndex !== -1) {
                path = path.slice(startIndex);
              }
            }

            const baseUrl = `http://${BACKEND_ADDRESS}`;
            const encodedUrl = new URL(path, baseUrl).href.replace(/ /g, "%20");

            callback({ redirectURL: encodedUrl, statusCode: 307 });
          } else {
            callback({ cancel: false });
          }
        } catch (error) {
          callback({ cancel: false });
        }
      },
    );
  }

  log("File 拦截器注册成功");
}

module.exports = { registerFileProtocolInterceptor };
