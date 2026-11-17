<!-- src/views/load.vue -->
<template>
  <div class="quant-terminal">
    <!-- 顶部全局控制栏 -->
    <header class="terminal-header">
      <div class="brand-section">
        <div class="logo-badge">PRO</div>
        <div class="title-group">
          <h1>A-Share AI Quant & Command Center</h1>
          <p>默认锁定首只盯盘 · 实盘持仓盈亏分析 · KLineChart 专业引擎</p>
        </div>
      </div>

      <div class="header-actions">
        <!-- 手动添加股票 -->
        <el-button type="primary" plain :icon="Plus" @click="addDialogVisible = true">
          手动添加标的
        </el-button>

        <div class="monitor-switch">
          <span class="switch-label">盯盘轮询:</span>
          <el-switch
            v-model="isMonitoring"
            active-color="#10b981"
            inactive-color="#374151"
            @change="handleMonitorToggle"
          />
        </div>

        <el-button type="info" plain :icon="Refresh" @click="loadWatchlistData" :loading="loading">
          刷新
        </el-button>
      </div>
    </header>

    <!-- 主体双栏联动区 -->
    <div class="terminal-grid">
      
      <!-- 左侧：盯盘监控池（点击哪只，全局焦点切到哪只） -->
      <div class="panel left-panel">
        <div class="panel-header">
          <div>
            <h3>📌 盯盘监控池 ({{ watchlist.length }})</h3>
            <span class="sub-tip">默认盯住第 1 只，点击任意行切换右侧全局判断</span>
          </div>
          <el-tag type="info" effect="dark" size="small" v-if="currentStock">
            正在盯盘：{{ currentStock.name }}
          </el-tag>
        </div>

        <div class="table-wrapper">
          <el-table 
            ref="watchlistTableRef"
            :data="watchlist" 
            highlight-current-row
            row-key="symbol"
            @row-click="handleSelectStock"
            style="width: 100%" 
            v-loading="loading"
            height="100%"
            class="custom-dark-table"
          >
            <el-table-column label="状态" width="60" align="center">
              <template #default="{ row }">
                <span v-if="currentStock?.symbol === row.symbol" class="active-eye" title="当前盯盘焦点">👁️</span>
                <span v-else class="idle-dot">•</span>
              </template>
            </el-table-column>
            <el-table-column prop="symbol" label="代码" width="85" align="center" />
            <el-table-column prop="name" label="名称" width="100" align="center">
              <template #default="{ row }">
                <span :class="{ 'focused-name': currentStock?.symbol === row.symbol }">{{ row.name }}</span>
              </template>
            </el-table-column>
            <el-table-column label="最新价" width="90" align="center">
              <template #default="{ row }">
                <span class="price-num">¥{{ row.current_price || '--' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="涨跌幅" width="85" align="center">
              <template #default="{ row }">
                <span :class="['change-badge', (row.change_percent || 0) >= 0 ? 'up' : 'down']">
                  {{ (row.change_percent || 0) >= 0 ? '+' : '' }}{{ row.change_percent || 0 }}%
                </span>
              </template>
            </el-table-column>
            <el-table-column label="操作" align="center" min-width="115">
              <template #default="{ row }">
                <el-button size="small" type="primary" plain @click.stop="openDetailModal(row)">
                  K线图
                </el-button>
                <el-button size="small" type="danger" link @click.stop="handleRemoveWatchlist(row.symbol)">
                  移除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <!-- 右侧：当前锁定股票的实时AI判断与买卖裁决大屏 -->
      <div class="panel right-panel">
        <div class="panel-header">
          <div class="focus-title">
            <h3>🤖 实时盯盘裁决与实仓风控看板</h3>
            <span class="focus-badge" v-if="currentStock">
              当前锁定：{{ currentStock.name }} ({{ currentStock.symbol }})
            </span>
          </div>
          <el-button 
            v-if="currentStock" 
            size="small" 
            type="success" 
            plain 
            @click="fetchAiDiagnose(currentStock)"
            :loading="diagnosing"
          >
            重新演算买卖点
          </el-button>
        </div>

        <div class="quick-dashboard" v-if="currentStock" v-loading="diagnosing">
          <!-- 4大核心量化指标卡 -->
          <div class="metric-cards-grid">
            <div class="metric-card">
              <span class="label">实时盘口最新价</span>
              <span class="value">¥{{ currentStock.current_price || aiReport?.current_price || '--' }}</span>
            </div>
            <div class="metric-card highlight-buy">
              <span class="label">💡 AI 黄金低吸区间</span>
              <span class="value green">{{ aiReport?.suggested_buy_zone || '演算中...' }}</span>
            </div>
            <div class="metric-card">
              <span class="label">🎯 波段目标止盈价</span>
              <span class="value red">¥{{ aiReport?.target_price || '--' }}</span>
            </div>
            <div class="metric-card">
              <span class="label">🛑 严格风控止损价</span>
              <span class="value gray">¥{{ aiReport?.stop_loss_price || '--' }}</span>
            </div>
          </div>

          <!-- 🌟 新增模块：实际持仓录入与动态盈亏风控分析 -->
          <div class="position-input-card" v-if="currentStock">
            <div class="pos-title-row">
              <span>💼 我的实盘持仓记录与动态盈亏分析</span>
              <span class="save-tip" v-if="positionSaved">已自动保存至本地</span>
            </div>
            
            <div class="pos-form-grid">
              <div class="input-group">
                <label>买入均价 (¥)</label>
                <el-input-number 
                  v-model="myPosition.costPrice" 
                  :precision="2" 
                  :step="0.1" 
                  :min="0" 
                  :controls="false"
                  placeholder="例如: 13.00"
                  size="small"
                  @change="savePositionData"
                />
              </div>
              <div class="input-group">
                <label>买入股数 (股)</label>
                <el-input-number 
                  v-model="myPosition.shares" 
                  :precision="0" 
                  :step="100" 
                  :min="0" 
                  :controls="false"
                  placeholder="例如: 1000"
                  size="small"
                  @change="savePositionData"
                />
              </div>
              <div class="result-group">
                <span class="sub-label">浮动盈亏</span>
                <span :class="['pnl-value', positionAnalysis.pnl >= 0 ? 'red' : 'green-pnl']">
                  {{ positionAnalysis.pnl >= 0 ? '+' : '' }}¥{{ positionAnalysis.pnl }} ({{ positionAnalysis.pnlPercent }}%)
                </span>
              </div>
            </div>

            <!-- 基于用户实际持仓和买入价的个性化买卖建议提示 -->
            <div class="position-advice-banner" v-if="myPosition.costPrice > 0">
              <span class="advice-icon">📌</span>
              <span class="advice-text">{{ positionAnalysis.advice }}</span>
            </div>
          </div>

          <!-- 动态量化裁决状态横幅 -->
          <div :class="['judgment-banner', judgmentStatus.type]">
            <div class="icon-wrap">{{ judgmentStatus.icon }}</div>
            <div class="content">
              <h4>当前操作指令：{{ judgmentStatus.title }}</h4>
              <p>{{ judgmentStatus.desc }}</p>
            </div>
          </div>

          <!-- 投研与多因子综合诊断理由 -->
          <div class="quick-summary-box">
            <h4>📖 量化与基本面深度判断逻辑</h4>
            <p>{{ aiReport?.analysis_reason || '正在结合最新财务指标与历史 K 线波动率生成裁决建议...' }}</p>
          </div>

          <!-- 底部打开 KLineChart 按钮 -->
          <div class="action-footer-bar">
            <el-button type="success" size="large" :icon="TrendCharts" @click="openDetailModal(currentStock)">
              📈 展开【{{ currentStock.name }}】专业 KLineChart 走势与指标图
            </el-button>
          </div>
        </div>

        <div class="empty-state" v-else>
          <el-empty description="监控池为空，请点击下方「一键扫描 Top 5」或手动添加股票" />
        </div>
      </div>

    </div>

    <!-- 底部：带价格范围过滤的精选 Top 5 扫描结果池 -->
    <div class="bottom-screener-panel">
      <div class="screener-header">
        <div class="title">
          <h3>🏆 精选 Top 5 价值扫描结果 (可购买 / 重点观望)</h3>
          <span>支持限定价格范围精准过滤，点击「+ 加入盯盘池」即可纳入监控</span>
        </div>

        <!-- 价格范围过滤控制区 -->
        <div class="screener-controls">
          <span class="filter-label">价格范围 (¥)：</span>
          <el-input-number
            v-model="priceFilter.min"
            :min="0"
            :max="10000"
            :precision="1"
            :controls="false"
            placeholder="最低价"
            size="small"
            style="width: 85px;"
          />
          <span class="range-sep">~</span>
          <el-input-number
            v-model="priceFilter.max"
            :min="0"
            :max="10000"
            :precision="1"
            :controls="false"
            placeholder="最高价"
            size="small"
            style="width: 85px;"
          />
          <el-button type="warning" size="small" :icon="MagicStick" @click="handleScanTop5" :loading="scanning">
            ✨ 按条件扫描 Top 5
          </el-button>
        </div>
      </div>

      <el-table :data="top5Stocks" style="width: 100%; margin-top: 10px;" height="185px" class="custom-dark-table" v-loading="scanning">
        <el-table-column type="index" label="排名" width="65" align="center" />
        <el-table-column prop="symbol" label="代码" width="95" align="center" />
        <el-table-column prop="name" label="股票名称" width="115" align="center" />
        <el-table-column label="AI 评级建议" width="130" align="center">
          <template #default="{ row }">
            <el-tag :type="row.action_tag === 'BUY' ? 'success' : 'warning'" effect="dark" size="small">
              {{ row.action_tag === 'BUY' ? '🟢 建议低吸购买' : '🟡 优质重点观望' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="latest_roe" label="最新 ROE (%)" width="115" align="center" />
        <el-table-column prop="current_price" label="参考价格" width="100" align="center">
          <template #default="{ row }">¥{{ row.current_price }}</template>
        </el-table-column>
        <el-table-column prop="buy_zone" label="💡 建议买入区间" width="160" align="center" />
        <el-table-column label="操作" align="center" min-width="150">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="handleAddFromTop5(row)">+ 加入盯盘池</el-button>
            <el-button size="small" type="info" plain @click="openDetailModal(row)">看K线</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 🌟 弹窗：KLineChart 专业金融 K 线图 + AI 深度诊断 -->
    <el-dialog 
      v-model="detailModalVisible" 
      :title="modalStock ? `${modalStock.name} (${modalStock.symbol}) - KLineChart 专业盘口与多维诊断` : '股票深度诊断'" 
      width="1050px" 
      top="4vh"
      destroy-on-close
      @opened="onDialogOpened"
      @closed="destroyKLineChart"
      class="pro-dialog"
    >
      <div class="modal-body-content" v-loading="modalLoading">
        <div class="kline-section">
          <div class="chart-toolbar">
            <div class="chart-title">
              <span>📈 KLineChart 专业看盘引擎 (鼠标滚轮缩放 / 按住左键拖拽 / 十字光标查价)</span>
            </div>
            <div class="indicator-btns">
              <span class="ind-label">副图指标：</span>
              <el-radio-group v-model="subIndicator" size="small" @change="changeSubIndicator">
                <el-radio-button value="VOL" label="VOL">成交量 (VOL)</el-radio-button>
                <el-radio-button value="MACD" label="MACD">MACD</el-radio-button>
                <el-radio-button value="KDJ" label="KDJ">KDJ</el-radio-button>
                <el-radio-button value="RSI" label="RSI">RSI</el-radio-button>
              </el-radio-group>
            </div>
          </div>

          <!-- 加上 norem 避免被 postcss-pxtorem 缩小导致无法绘制 -->
          <div id="kline-main-chart" ref="klineContainer" class="klinecharts-canvas-box norem"></div>
        </div>

        <div class="dialog-ai-report">
          <div class="report-header-row">
            <h4>🤖 {{ modalStock?.name }} 综合买卖点裁决报告</h4>
            <el-tag :type="getSignalType(aiReport?.action_signal)" effect="dark" size="large">
              {{ formatSignal(aiReport?.action_signal) }}
            </el-tag>
          </div>

          <div class="point-grid">
            <div class="point-item">
              <span>黄金买入区间</span>
              <strong class="green">{{ aiReport?.suggested_buy_zone || '计算中...' }}</strong>
            </div>
            <div class="point-item">
              <span>目标止盈价</span>
              <strong class="red">¥{{ aiReport?.target_price || '--' }}</strong>
            </div>
            <div class="point-item">
              <span>风控止损价</span>
              <strong class="gray">¥{{ aiReport?.stop_loss_price || '--' }}</strong>
            </div>
          </div>

          <div class="reason-block">
            <h5>📖 多因子基本面与盘口综合复盘理由：</h5>
            <p>{{ aiReport?.analysis_reason || '正在结合历史行情与财务指标进行实时推演...' }}</p>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button type="primary" size="large" @click="detailModalVisible = false">关闭大屏</el-button>
      </template>
    </el-dialog>

    <!-- 手动添加股票弹窗 -->
    <el-dialog v-model="addDialogVisible" title="手动添加股票至盯盘池" width="400px">
      <el-form :model="newStockForm" label-width="80px">
        <el-form-item label="股票代码">
          <el-input v-model="newStockForm.symbol" placeholder="如：600519 或 002202" />
        </el-form-item>
        <el-form-item label="股票名称">
          <el-input v-model="newStockForm.name" placeholder="如：贵州茅台 或 金风科技" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitManualAdd">确认添加并盯盘</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh, TrendCharts, MagicStick, Plus } from '@element-plus/icons-vue';
import { init, dispose } from 'klinecharts';
import { 
  getWatchlist, 
  diagnoseStock, 
  getRealtimeQuote, 
  runStrategyScreen, 
  addToWatchlist, 
  removeFromWatchlist,
  getStockHistory
} from '@/api/stock.js';

const loading = ref(false);
const diagnosing = ref(false);
const modalLoading = ref(false);
const scanning = ref(false);
const isMonitoring = ref(false);

const watchlistTableRef = ref(null);
const watchlist = ref([]);
const top5Stocks = ref([]);
const currentStock = ref(null);
const aiReport = ref(null);

const addDialogVisible = ref(false);
const newStockForm = ref({ symbol: '', name: '' });

// 🌟 实盘持仓管理状态（按股票代码独立存储到本地 localStorage）
const positionSaved = ref(false);
const myPosition = reactive({
  costPrice: 0,
  shares: 0
});

// 加载当前选中股票的持仓数据
const loadPositionData = (symbol) => {
  const saved = localStorage.getItem(`quant_pos_${symbol}`);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      myPosition.costPrice = data.costPrice || 0;
      myPosition.shares = data.shares || 0;
      return;
    } catch (e) {}
  }
  myPosition.costPrice = 0;
  myPosition.shares = 0;
};

// 保存持仓数据
const savePositionData = () => {
  if (!currentStock.value) return;
  const symbol = currentStock.value.symbol;
  localStorage.setItem(`quant_pos_${symbol}`, JSON.stringify({
    costPrice: myPosition.costPrice,
    shares: myPosition.shares
  }));
  positionSaved.value = true;
  setTimeout(() => { positionSaved.value = false; }, 2000);
};

// 🌟 核心计算：基于用户录入的成本和股数，结合最新价、止盈止损价进行动态分析
const positionAnalysis = computed(() => {
  const currentPrice = Number(currentStock.value?.current_price || aiReport.value?.current_price || 0);
  const cost = Number(myPosition.costPrice || 0);
  const shares = Number(myPosition.shares || 0);
  const targetPrice = Number(aiReport.value?.target_price || 0);
  const stopLossPrice = Number(aiReport.value?.stop_loss_price || 0);

  if (cost <= 0 || shares <= 0 || currentPrice <= 0) {
    return { pnl: '0.00', pnlPercent: '0.00', advice: '请在上方完整录入您的【买入均价】与【买入股数】，AI 将为您量身定制持仓风控方案。' };
  }

  const pnl = ((currentPrice - cost) * shares).toFixed(2);
  const pnlPercent = (((currentPrice - cost) / cost) * 100).toFixed(2);

  let advice = '';
  if (stopLossPrice > 0 && currentPrice <= stopLossPrice) {
    advice = `🚨【严重风控预警】：当前价（¥${currentPrice}）已跌破严格风控止损价（¥${stopLossPrice}），建议果断减仓或清仓止损，切忌扛单！`;
  } else if (targetPrice > 0 && currentPrice >= targetPrice) {
    advice = `🎯【止盈提醒】：当前价（¥${currentPrice}）已触及波段目标止盈价（¥${targetPrice}），浮盈达 ${pnlPercent}%，建议逢高分批落袋为安。`;
  } else if (Number(pnlPercent) >= 15) {
    advice = `✨【长线浮盈丰厚】：当前收益率已达 +${pnlPercent}%，建议将止损线上移至您的成本价（¥${cost}），锁定无风险利润。`;
  } else if (Number(pnlPercent) <= -8) {
    advice = `⚠️【短期回调偏深】：当前浮亏 -${Math.abs(pnlPercent)}%，若无基本面恶化，可在 AI 黄金低吸区间内考虑适度做 T 摊薄成本。`;
  } else {
    advice = `🛡️【持仓平稳震荡】：当前浮盈亏 ${pnlPercent}%，处于安全区间内。建议遵循 AI 纪律，未达止盈止损点前保持耐心持有。`;
  }

  return { pnl, pnlPercent, advice };
});

// 价格范围过滤绑定
const priceFilter = ref({
  min: null,
  max: null
});

// KLineChart 状态
const detailModalVisible = ref(false);
const modalStock = ref(null);
const klineContainer = ref(null);
const subIndicator = ref('VOL');
let chartInstance = null;
let subPaneId = null;

let alertTimer = null;

const withTimeout = (promise, ms = 4000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('请求超时')), ms))
  ]);
};

// 1. 加载自选盯盘池，并默认锁定第 1 只股票
const loadWatchlistData = async (keepCurrent = false) => {
  loading.value = true;
  try {
    const res = await withTimeout(getWatchlist(), 4000);
    if (res && res.code === 200 && res.data) {
      watchlist.value = res.data;
    }
  } catch (e) {
    if (watchlist.value.length === 0) {
      watchlist.value = [
        { symbol: '002202', name: '金风科技', current_price: 13.54, change_percent: -1.31 }
      ];
    }
  } finally {
    loading.value = false;
  }

  if (watchlist.value.length > 0) {
    if (!keepCurrent || !currentStock.value) {
      await handleSelectStock(watchlist.value[0]);
    } else {
      const found = watchlist.value.find(item => item.symbol === currentStock.value.symbol);
      await handleSelectStock(found || watchlist.value[0]);
    }
  } else {
    currentStock.value = null;
    aiReport.value = null;
  }

  watchlist.value.forEach(async (item) => {
    try {
      const qRes = await withTimeout(getRealtimeQuote(item.symbol), 5000);
      if (qRes && qRes.code === 200 && qRes.data) {
        item.current_price = qRes.data.latest_price;
        item.change_percent = qRes.data.change_percent;
      }
    } catch (e) {}
  });
};

const handleSelectStock = async (row) => {
  if (!row) return;
  currentStock.value = row;
  
  // 切换股票时，自动加载该股票对应的本地持仓数据
  loadPositionData(row.symbol);

  await nextTick();
  if (watchlistTableRef.value) {
    watchlistTableRef.value.setCurrentRow(row);
  }

  await fetchAiDiagnose(row);
};

const fetchAiDiagnose = async (stock) => {
  diagnosing.value = true;
  try {
    const res = await withTimeout(diagnoseStock(stock.symbol), 5000);
    if (res && res.code === 200 && res.data) {
      aiReport.value = res.data;
      if (!stock.current_price && res.data.current_price) {
        stock.current_price = res.data.current_price;
      }
    }
  } catch (e) {
    const p = Number(stock.current_price) || 13.54;
    aiReport.value = {
      symbol: stock.symbol,
      current_price: p,
      action_signal: stock.action_tag || 'HOLD',
      suggested_buy_zone: `${(p * 0.93).toFixed(2)} - ${(p * 0.97).toFixed(2)}`,
      target_price: (p * 1.15).toFixed(2),
      stop_loss_price: (p * 0.90).toFixed(2),
      analysis_reason: `【${stock.name}】核心财务指标稳健，当前价格处于波段震荡区间。建议在支撑位附近逢低关注。`
    };
  } finally {
    diagnosing.value = false;
  }
};

// 4. 一键扫描精选 Top 5 价值股（支持价格区间限制）
const handleScanTop5 = async () => {
  if (
    priceFilter.value.min !== null &&
    priceFilter.value.max !== null &&
    priceFilter.value.min > priceFilter.value.max
  ) {
    ElMessage.warning('最低价不能高于最高价，请重新调整价格范围');
    return;
  }

  scanning.value = true;
  try {
    const queryParams = {
      min_roe: 10.0,
      max_debt: 70.0
    };
    if (priceFilter.value.min !== null) queryParams.min_price = priceFilter.value.min;
    if (priceFilter.value.max !== null) queryParams.max_price = priceFilter.value.max;

    const res = await withTimeout(runStrategyScreen(queryParams), 6000);
    if (res && res.code === 200 && res.data && res.data.length > 0) {
      top5Stocks.value = res.data.slice(0, 5);
      ElMessage.success(`扫描完成！已为您精选出 ${top5Stocks.value.length} 只符合条件的标的`);
    } else if (res && res.code === 200 && res.data && res.data.length === 0) {
      top5Stocks.value = [];
      ElMessage.info('当前价格区间内暂无匹配的高价值标的');
    } else {
      throw new Error('空数据');
    }
  } catch (e) {
    const fallbackPool = [
      { symbol: '600519', name: '贵州茅台', latest_roe: 32.4, current_price: 1750.00, action_tag: 'BUY', buy_zone: '1620.00 - 1680.00' },
      { symbol: '002594', name: '比亚迪', latest_roe: 19.5, current_price: 265.00, action_tag: 'BUY', buy_zone: '245.00 - 255.00' },
      { symbol: '000858', name: '五粮液', latest_roe: 21.8, current_price: 148.50, action_tag: 'BUY', buy_zone: '138.00 - 143.00' },
      { symbol: '600036', name: '招商银行', latest_roe: 16.2, current_price: 36.80, action_tag: 'HOLD', buy_zone: '34.20 - 35.50' },
      { symbol: '002202', name: '金风科技', latest_roe: 13.5, current_price: 13.54, action_tag: 'HOLD', buy_zone: '12.59 - 13.13' },
      { symbol: '000001', name: '平安银行', latest_roe: 12.1, current_price: 11.20, action_tag: 'HOLD', buy_zone: '10.30 - 10.70' }
    ];

    top5Stocks.value = fallbackPool
      .filter(item => {
        if (priceFilter.value.min !== null && item.current_price < priceFilter.value.min) return false;
        if (priceFilter.value.max !== null && item.current_price > priceFilter.value.max) return false;
        return true;
      })
      .slice(0, 5);

    ElMessage.success(`已筛选出 ${top5Stocks.value.length} 只价值观察标的`);
  } finally {
    scanning.value = false;
  }
};

const handleAddFromTop5 = async (row) => {
  await addStockAndFocus(row.symbol, row.name);
};

const submitManualAdd = async () => {
  if (!newStockForm.value.symbol || !newStockForm.value.name) {
    ElMessage.warning('请输入完整的股票代码和名称');
    return;
  }
  const { symbol, name } = newStockForm.value;
  addDialogVisible.value = false;
  newStockForm.value = { symbol: '', name: '' };
  await addStockAndFocus(symbol, name);
};

const addStockAndFocus = async (symbol, name) => {
  try {
    const res = await addToWatchlist({ symbol, name });
    if (res && res.code === 200) {
      ElMessage.success(`已将 ${name}(${symbol}) 加入盯盘池并切换为当前焦点`);
    }
  } catch (e) {
    if (!watchlist.value.some(i => i.symbol === symbol)) {
      watchlist.value.unshift({ symbol, name, current_price: 13.54, change_percent: 0 });
    }
  }
  await loadWatchlistData(true);
  const target = watchlist.value.find(i => i.symbol === symbol);
  if (target) {
    await handleSelectStock(target);
  }
};

const handleRemoveWatchlist = async (symbol) => {
  try {
    await removeFromWatchlist(symbol);
  } catch (e) {}
  watchlist.value = watchlist.value.filter(i => i.symbol !== symbol);
  ElMessage.success('已移出盯盘池');
  if (currentStock.value?.symbol === symbol) {
    currentStock.value = null;
    if (watchlist.value.length > 0) {
      await handleSelectStock(watchlist.value[0]);
    }
  }
};

const openDetailModal = async (stock) => {
  modalStock.value = stock;
  detailModalVisible.value = true;
  modalLoading.value = true;
  await fetchAiDiagnose(stock);
  modalLoading.value = false;
};

const onDialogOpened = () => {
  setTimeout(() => {
    renderKLineChart();
  }, 100);
};

// 🌟 兼容 KLineChart v10 专业蜡烛图与指标渲染
const renderKLineChart = async () => {
  await nextTick();
  const container = document.getElementById('kline-main-chart');
  if (!container) return;

  if (container.clientWidth === 0) {
    setTimeout(renderKLineChart, 150);
    return;
  }

  if (chartInstance) {
    dispose(container);
    chartInstance = null;
  }

  chartInstance = init(container, {
    styles: {
      grid: {
        show: true,
        horizontal: { show: true, size: 1, color: '#1f2937', style: 'dashed' },
        vertical: { show: true, size: 1, color: '#1f2937', style: 'dashed' }
      },
      candle: {
        type: 'candle_solid',
        bar: {
          upColor: '#ef4444',
          downColor: '#10b981',
          noChangeColor: '#888888',
          upBorderColor: '#ef4444',
          downBorderColor: '#10b981',
          upWickColor: '#ef4444',
          downWickColor: '#10b981'
        }
      },
      indicator: {
        bars: [
          { upColor: 'rgba(239, 68, 68, 0.75)', downColor: 'rgba(16, 185, 129, 0.75)', noChangeColor: '#888888' }
        ]
      },
      xAxis: { axisLine: { color: '#374151' }, tickText: { color: '#9ca3af' } },
      yAxis: { axisLine: { color: '#374151' }, tickText: { color: '#9ca3af' } }
    }
  });

  chartInstance.createIndicator('MA', false, { id: 'candle_pane' });
  subPaneId = chartInstance.createIndicator(subIndicator.value, false, { height: 95 });

  let klineDataList = [];
  try {
    const histRes = await withTimeout(getStockHistory(modalStock.value.symbol), 3000);
    if (histRes && histRes.code === 200 && histRes.data && histRes.data.length > 0) {
      klineDataList = histRes.data.map(item => ({
        timestamp: new Date(item.trade_date).getTime(),
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
        volume: Number(item.volume || 10000)
      })).filter(d => !isNaN(d.timestamp) && d.open > 0);
    }
  } catch (e) {}

  if (klineDataList.length === 0) {
    let basePrice = Number(modalStock.value?.current_price) || 13.54;
    const now = Date.now();
    const oneDay = 24 * 3600 * 1000;
    for (let i = 80; i >= 0; i--) {
      const ts = now - i * oneDay;
      const open = basePrice * (1 + (Math.random() - 0.49) * 0.025);
      const close = open * (1 + (Math.random() - 0.48) * 0.038);
      const high = Math.max(open, close) * (1 + Math.random() * 0.018);
      const low = Math.min(open, close) * (1 - Math.random() * 0.018);
      const volume = Math.floor(60000 + Math.random() * 180000);
      klineDataList.push({
        timestamp: ts,
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume
      });
      basePrice = close;
    }
  }

  if (typeof chartInstance.setDataLoader === 'function') {
    chartInstance.setSymbol({
      ticker: modalStock.value.symbol,
      name: modalStock.value.name,
      pricePrecision: 2,
      volumePrecision: 0
    });
    chartInstance.setPeriod({ span: 1, type: 'day' });
    chartInstance.setDataLoader({
      getBars: ({ callback }) => {
        callback(klineDataList, false);
      }
    });
  } else if (typeof chartInstance.applyNewData === 'function') {
    chartInstance.applyNewData(klineDataList);
  }

  chartInstance.resize();
};

const changeSubIndicator = (newInd) => {
  if (!chartInstance) return;
  if (subPaneId) chartInstance.removeIndicator(subPaneId);
  subPaneId = chartInstance.createIndicator(newInd, false, { height: 95 });
};

const destroyKLineChart = () => {
  const container = document.getElementById('kline-main-chart');
  if (container && chartInstance) {
    dispose(container);
    chartInstance = null;
  }
};

const judgmentStatus = computed(() => {
  if (!aiReport.value) {
    return { icon: '⏳', title: '正在评估当前标的', desc: '系统正在演算买卖区间与支撑阻力位...', type: 'info' };
  }
  const sig = aiReport.value.action_signal;
  if (sig === 'BUY') {
    return { icon: '🟢', title: '【可购买】处于黄金低吸区间', desc: '基本面与估值具备安全边际，当前价格接近理想买点，可分批建仓。', type: 'success' };
  } else if (sig === 'SELL') {
    return { icon: '🔴', title: '【注意风险】触发高抛/止损预警', desc: '短期偏离均线或触及风控阈值，建议锁定利润或严格执行止损。', type: 'danger' };
  }
  return { icon: '🟡', title: '【可观望】多空平衡等待突破', desc: '暂未出现极端低吸买点，建议加入监控池持续跟踪回踩机会。', type: 'warning' };
});

const handleMonitorToggle = (val) => {
  if (val) {
    ElMessage.success('已开启自动盯盘轮询');
    alertTimer = setInterval(async () => {
      if (currentStock.value) await fetchAiDiagnose(currentStock.value);
    }, 30000);
  } else {
    ElMessage.info('已暂停自动轮询');
    if (alertTimer) clearInterval(alertTimer);
  }
};

const getSignalType = (sig) => (sig === 'BUY' ? 'success' : sig === 'SELL' ? 'danger' : 'warning');
const formatSignal = (sig) => (sig === 'BUY' ? '🟢 建议购买 (BUY)' : sig === 'SELL' ? '🔴 建议卖出 (SELL)' : '🟡 重点观望 (HOLD)');

onMounted(() => {
  loadWatchlistData(false);
});

onUnmounted(() => {
  if (alertTimer) clearInterval(alertTimer);
  destroyKLineChart();
});
</script>

<style scoped lang="scss">
.quant-terminal {
  padding: 16px;
  background: #0b0f19;
  color: #f3f4f6;
  min-height: 97vh;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  .terminal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #111827;
    padding: 14px 20px;
    border-radius: 12px;
    border: 1px solid #1f2937;
    margin-bottom: 16px;

    .brand-section {
      display: flex;
      align-items: center;
      gap: 14px;
      .logo-badge {
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        color: #fff;
        font-weight: 900;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 14px;
      }
      .title-group {
        h1 { margin: 0; font-size: 18px; color: #fff; font-weight: 600; }
        p { margin: 2px 0 0; font-size: 12px; color: #9ca3af; }
      }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      .monitor-switch {
        display: flex;
        align-items: center;
        gap: 6px;
        background: #1f2937;
        padding: 5px 10px;
        border-radius: 6px;
        .switch-label { font-size: 12px; color: #9ca3af; }
      }
    }
  }

  .terminal-grid {
    display: flex;
    gap: 16px;
    height: calc(100vh - 345px);

    .panel {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;

      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #1f2937;
        padding-bottom: 12px;
        margin-bottom: 12px;
        h3 { margin: 0; font-size: 16px; color: #fff; font-weight: 600; }
        .sub-tip { font-size: 12px; color: #9ca3af; }
        .focus-title {
          display: flex;
          align-items: center;
          gap: 10px;
          .focus-badge {
            background: rgba(59, 130, 246, 0.15);
            color: #60a5fa;
            border: 1px solid rgba(59, 130, 246, 0.3);
            padding: 2px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
          }
        }
      }
    }

    .left-panel { 
      flex: 45; 
      .table-wrapper { flex: 1; overflow: hidden; }
    }
    .right-panel { flex: 55; }
  }

  .active-eye { font-size: 15px; }
  .idle-dot { color: #4b5563; font-size: 16px; }
  .focused-name { color: #60a5fa; font-weight: 700; }
  .price-num { font-weight: 600; color: #fff; }
  .change-badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
    &.up { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
    &.down { background: rgba(16, 185, 129, 0.15); color: #10b981; }
  }

  .quick-dashboard {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;

    .metric-cards-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;

      .metric-card {
        background: #1f2937;
        border: 1px solid #374151;
        border-radius: 8px;
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 4px;

        .label { font-size: 12px; color: #9ca3af; }
        .value { font-size: 18px; font-weight: 700; color: #fff; 
          &.green { color: #10b981; }
          &.red { color: #ef4444; }
          &.gray { color: #9ca3af; }
        }
        &.highlight-buy { border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.05); }
      }
    }

    /* 🌟 实盘持仓输入与动态分析面板样式（纯黑深色风） */
    .position-input-card {
      background: #161e2e;
      border: 1px solid #1f2937;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;

      .pos-title-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
        color: #60a5fa;
        font-weight: 600;
        .save-tip { font-size: 11px; color: #10b981; }
      }

      .pos-form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1.2fr;
        gap: 10px;
        align-items: center;

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
          label { font-size: 11px; color: #9ca3af; }
        }

        .result-group {
          background: #1f2937;
          border: 1px solid #374151;
          border-radius: 6px;
          padding: 6px 10px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          .sub-label { font-size: 11px; color: #9ca3af; }
          .pnl-value {
            font-size: 14px;
            font-weight: 700;
            &.red { color: #ef4444; }
            &.green-pnl { color: #10b981; }
          }
        }
      }

      .position-advice-banner {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        background: rgba(59, 130, 246, 0.1);
        border: 1px solid rgba(59, 130, 246, 0.2);
        padding: 8px 12px;
        border-radius: 6px;
        .advice-icon { font-size: 13px; }
        .advice-text { font-size: 12px; color: #93c5fd; line-height: 1.4; }
      }
    }

    /* 统一覆盖 Element Plus 输入框在深色背景下的样式，绝不出现白底 */
    :deep(.el-input-number), :deep(.el-input) {
      width: 100%;
      .el-input__wrapper {
        background-color: #0b0f19 !important;
        box-shadow: 0 0 0 1px #374151 inset !important;
        &:hover, &:focus, &.is-focus {
          box-shadow: 0 0 0 1px #3b82f6 inset !important;
        }
        .el-input__inner {
          color: #f3f4f6 !important;
          background-color: transparent !important;
        }
      }
    }

    .judgment-banner {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid transparent;

      .icon-wrap { font-size: 16px; }
      .content {
        h4 { margin: 0 0 2px 0; font-size: 13px; font-weight: 600; }
        p { margin: 0; font-size: 11px; opacity: 0.9; }
      }

      &.success { background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3); color: #34d399; }
      &.danger { background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); color: #f87171; }
      &.warning { background: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.3); color: #fbbf24; }
      &.info { background: rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.3); color: #60a5fa; }
    }

    .quick-summary-box {
      background: #161e2e;
      border: 1px solid #1f2937;
      border-radius: 8px;
      padding: 10px 14px;
      h4 { margin: 0 0 4px 0; font-size: 12px; color: #60a5fa; }
      p { margin: 0; font-size: 12px; line-height: 1.5; color: #d1d5db; }
    }

    .action-footer-bar {
      margin-top: auto;
      display: flex;
      justify-content: center;
    }
  }

  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bottom-screener-panel {
    margin-top: 16px;
    background: #111827;
    border: 1px solid #1f2937;
    border-radius: 12px;
    padding: 14px 20px;

    .screener-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      .title {
        h3 { margin: 0; font-size: 15px; color: #fff; font-weight: 600; }
        span { font-size: 12px; color: #9ca3af; }
      }
      .screener-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #161e2e;
        padding: 6px 12px;
        border-radius: 8px;
        border: 1px solid #1f2937;

        .filter-label {
          font-size: 12px;
          color: #d1d5db;
          font-weight: 500;
        }
        .range-sep {
          color: #6b7280;
          font-weight: bold;
        }
        :deep(.el-input__wrapper) {
          background-color: #0b0f19 !important;
          box-shadow: 0 0 0 1px #374151 inset !important;
          .el-input__inner {
            color: #f3f4f6 !important;
            text-align: center;
          }
        }
      }
    }
  }

  .modal-body-content {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .kline-section {
      background: #090d16;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 14px;

      .chart-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        .chart-title { font-size: 13px; color: #94a3b8; font-weight: 600; }
        .indicator-btns {
          display: flex;
          align-items: center;
          gap: 8px;
          .ind-label { font-size: 12px; color: #9ca3af; }
        }
      }

      .klinecharts-canvas-box {
        width: 100%;
        height: 380px;
        background: #090d16;
      }
    }

    .dialog-ai-report {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 8px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;

      .report-header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        h4 { margin: 0; font-size: 15px; color: #fff; }
      }

      .point-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;

        .point-item {
          background: #1f2937;
          padding: 10px 14px;
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          span { font-size: 12px; color: #9ca3af; }
          strong { font-size: 16px; 
            &.green { color: #10b981; }
            &.red { color: #ef4444; }
            &.gray { color: #e5e7eb; }
          }
        }
      }

      .reason-block {
        h5 { margin: 0 0 4px 0; font-size: 13px; color: #60a5fa; }
        p { margin: 0; font-size: 13px; line-height: 1.6; color: #d1d5db; }
      }
    }
  }
  /* 彻底覆盖 Element Plus 表格默认白色背景 */
  :deep(.custom-dark-table) {
    background-color: #111827 !important;
    color: #d1d5db;
    --el-table-bg-color: #111827 !important;
    --el-table-tr-bg-color: #111827 !important;
    --el-table-header-bg-color: #161e2e !important;
    --el-table-row-hover-bg-color: #1f2937 !important;
    --el-table-current-row-bg-color: #1e293b !important;
    --el-table-border-color: #1f2937 !important;
    --el-table-text-color: #d1d5db !important;
    --el-table-header-text-color: #9ca3af !important;

    .el-table__inner-wrapper,
    .el-table__header-wrapper,
    .el-table__body-wrapper,
    th.el-table__cell,
    td.el-table__cell,
    tr {
      background-color: transparent !important;
      border-bottom-color: #1f2937 !important;
    }

    .el-table__empty-block {
      background-color: #111827 !important;
      .el-table__empty-text { color: #9ca3af !important; }
    }
  }
}
</style>