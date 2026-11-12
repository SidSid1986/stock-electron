/*
 * @Author: Sid Li
 * @Date: 2025-11-24 10:59:31
 * @LastEditors: Sid Li
 * @LastEditTime: 2026-05-23 16:25:12
 * @FilePath: \tcp-to-leader\src\api\common.js
 * @Description:
 */
import request from "@/utils/request.js";

//退出所有
export function quitAll() {
  return request({
    url: "/sys/quit",
    method: "get",
  });
}
