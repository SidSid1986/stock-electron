/*
 * @Author: Sid Li
 * @Date: 2026-11-16 22:04:58
 * @LastEditors: Sid Li
 * @LastEditTime: 2026-11-17 22:18:42
 * @FilePath: \stock-electron\src\api\stock.js
 * @Description: 
 */
/*
 * @Author: Sid Li
 * @Description: A股量化终端 API 接口模块（已去重，包含全部完整接口）
 */
import request from "@/utils/request.js";

// 1. 分页获取股票列表与搜索
export function getStockList(params) {
  return request({
    url: "/api/stock/list",
    method: "get",
    params,
  });
}

// 2. 获取自选股列表
export function getWatchlist() {
  return request({
    url: "/api/stock/watchlist",
    method: "get",
  });
}

// 3. 添加到自选股
export function addToWatchlist(params) {
  return request({
    url: "/api/stock/watchlist/add",
    method: "post",
    params, // { symbol, name }
  });
}

// 4. 从自选股移除
export function removeFromWatchlist(symbol) {
  return request({
    url: `/api/stock/watchlist/${symbol}`,
    method: "delete",
  });
}

// 5. 获取实时盘口快照
export function getRealtimeQuote(symbol) {
  return request({
    url: `/api/stock/realtime/${symbol}`,
    method: "get",
  });
}

// 6. 获取指定股票的历史行情 (用于绘制K线图/趋势分析)
export function getStockHistory(symbol, params) {
  return request({
    url: `/api/stock/history/${symbol}`,
    method: "get",
    params,
  });
}

// 7. 触发 AI 综合诊断与买卖点计算
export function diagnoseStock(symbol) {
  return request({
    url: `/api/stock/diagnose/${symbol}`,
    method: "post",
  });
}

// 8. 运行多因子量化选股策略筛选
export function runStrategyScreen(params) {
  return request({
    url: "/api/stock/strategy/screen",
    method: "get",
    params,
  });
}

// 9. 轮询检查自选股是否触及买卖/止盈/止损告警条件
export function checkWatchlistAlerts() {
  return request({
    url: "/api/stock/watchlist/alerts",
    method: "get",
  });
}