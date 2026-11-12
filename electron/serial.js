const { ipcMain } = require("electron");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const { log } = require("./logger");

let mainWindow = null;
let port = null;
let parser = null;

//   CRC16

function crc16(data) {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >> 1) ^ 0xa001;
      } else {
        crc = crc >> 1;
      }
    }
  }
  // 低字节在前，高字节在后
  const low = crc & 0xff;
  const high = (crc >> 8) & 0xff;
  return Buffer.from([low, high]);
}

//  初始化串口
function initSerial(win) {
  mainWindow = win;
  log("串口模块初始化成功");
}

//  注册 IPC 通信
function registerSerialIPC() {
  //  获取所有串口列表
  ipcMain.handle("serial-list", async () => {
    try {
      const ports = await SerialPort.list();

      // 输出完整信息看日志
      console.log("【完整串口信息】", ports);

      return ports.map((p) => ({
        path: p.path,
        manufacturer: p.friendlyName || "",
      }));
    } catch (err) {
      log(`获取串口列表失败: ${err.message}`);
      return [];
    }
  });

  //  打开串口
  ipcMain.handle("serial-open", async (_, options) => {
    if (port?.isOpen) {
      return { success: false, msg: "串口已打开" };
    }
    try {
      port = new SerialPort({
        path: options.path,
        baudRate: options.baudRate || 115200,
        dataBits: 8,
        parity: "none",
        stopBits: 1,
        autoOpen: false,
      });

      // 监听错误
      port.on("error", (err) => {
        log(`串口错误: ${err.message}`);
        mainWindow?.webContents.send("serial-error", err.message);
      });

      port.open((err) => {
        if (err) {
          log(`打开串口失败: ${err.message}`);
          mainWindow?.webContents.send("serial-open-fail", {
            path: options.path,
            msg: err.message,
          });
          return;
        }

        // 移除所有旧 data 事件
        port.removeAllListeners("data");

        port.on("data", (data) => {
          const hex =
            data
              .toString("hex")
              .toUpperCase()
              .match(/.{1,2}/g)
              ?.join(" ") || "";
          log(`串口接收: ${hex}`);
          mainWindow?.webContents.send("serial-receive", {
            raw: data,
            hex,
            timestamp: new Date().toLocaleTimeString(),
          });
        });

        log(`串口 ${options.path} 打开成功`);
        mainWindow?.webContents.send("serial-open-success", {
          path: options.path,
        });
      });

      return { success: true, msg: "串口打开中..." };
    } catch (err) {
      log(`打开串口异常: ${err.message}`);
      return { success: false, msg: err.message };
    }
  });

  // 关闭串口
  ipcMain.handle("serial-close", async () => {
    if (!port) return { success: true, msg: "串口未打开" };
    try {
      port.close((err) => {
        if (err) log(`关闭串口失败: ${err.message}`);
        else log("串口已关闭");
      });
      port = null;
      return { success: true, msg: "串口已关闭" };
    } catch (err) {
      return { success: false, msg: err.message };
    }
  });

  // 发送原始HEX数据
  ipcMain.handle("serial-send-hex", async (_, hexStr) => {
    if (!port?.isOpen) return { success: false, msg: "串口未打开" };
    try {
      const cleanHex = hexStr.replace(/\s/g, "");
      const buffer = Buffer.from(cleanHex, "hex");
      port.write(buffer);
      log(
        `串口发送: ${
          cleanHex
            .toUpperCase()
            .match(/.{1,2}/g)
            ?.join(" ") || ""
        }`,
      );
      return { success: true, msg: "发送成功" };
    } catch (err) {
      log(`发送失败: ${err.message}`);
      return { success: false, msg: err.message };
    }
  });

  //  读保持寄存器 0x03
  ipcMain.handle("modbus-read-holding", async (_, { addr, start, count }) => {
    const cmd = Buffer.from([
      addr,
      0x03,
      (start >> 8) & 0xff,
      start & 0xff,
      (count >> 8) & 0xff,
      count & 0xff,
    ]);
    const crc = crc16(cmd);
    const frame = Buffer.concat([cmd, crc]);
    const hex = frame
      .toString("hex")
      .toUpperCase()
      .match(/.{1,2}/g)
      ?.join(" ");
    return await ipcMain.invoke("serial-send-hex", hex);
  });

  // 写单个寄存器 0x06
  ipcMain.handle("modbus-write-single", async (_, { addr, regAddr, value }) => {
    const cmd = Buffer.from([
      addr,
      0x06,
      (regAddr >> 8) & 0xff,
      regAddr & 0xff,
      (value >> 8) & 0xff,
      value & 0xff,
    ]);
    const crc = crc16(cmd);
    const frame = Buffer.concat([cmd, crc]);
    const hex = frame
      .toString("hex")
      .toUpperCase()
      .match(/.{1,2}/g)
      ?.join(" ");
    return await ipcMain.invoke("serial-send-hex", hex);
  });

  // 写多个寄存器 0x10
  ipcMain.handle("modbus-write-multi", async (_, { addr, start, values }) => {
    const regCount = values.length;
    const dataLen = regCount * 2;
    const cmdParts = [
      addr,
      0x10,
      (start >> 8) & 0xff,
      start & 0xff,
      (regCount >> 8) & 0xff,
      regCount & 0xff,
      dataLen,
    ];
    values.forEach((v) => {
      cmdParts.push((v >> 8) & 0xff, v & 0xff);
    });
    const cmd = Buffer.from(cmdParts);
    const crc = crc16(cmd);
    const frame = Buffer.concat([cmd, crc]);
    const hex = frame
      .toString("hex")
      .toUpperCase()
      .match(/.{1,2}/g)
      ?.join(" ");
    return await ipcMain.invoke("serial-send-hex", hex);
  });
}

module.exports = {
  initSerial,
  registerSerialIPC,
};
