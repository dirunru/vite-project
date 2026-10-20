<template>
  <div ref="pageRef" class="stock-trend">
    <!-- 左侧:自选股票列表(内置 + 用户自定义) -->
    <aside v-show="!isMultiTrend" class="stock-side">
      <div class="side-title">
        <span>自选股票</span>
        <el-button link type="primary" size="small" @click="openAddStock">
          + 添加
        </el-button>
      </div>
      <div
        v-for="s in stockList"
        :key="s.code"
        class="stock-item"
        :class="{ active: s.code === currentCode }"
        @click="switchStock(s.code)"
      >
        <div class="stock-info">
          <div class="stock-name">
            {{ s.name }}
            <!-- 最近一个日K顶底信号:顶=观望、底=持有 -->
            <span
              v-if="sideTags[s.code]"
              class="stock-tag"
              :class="sideTags[s.code]?.kind"
            >
              {{ sideTags[s.code]?.text }}
            </span>
          </div>
          <div class="stock-code">{{ s.code }}</div>
        </div>
        <!-- 仅自定义股票可移除;stop 防止触发切换 -->
        <span
          v-if="isCustomStock(s.code)"
          class="stock-remove"
          title="从自选移除"
          @click.stop="removeStock(s.code)"
        >
          ×
        </span>
      </div>
    </aside>

    <!-- 右侧:走势图表 -->
    <main class="chart-main">
      <header class="chart-head">
        <div v-show="!isMultiTrend" class="head-quote">
          <span class="name">{{ currentStock.name }}</span>
          <span class="code">{{ currentStock.code }}</span>
          <span class="price" :class="chgClass">{{ quote.last }}</span>
          <span class="chg" :class="chgClass">
            {{ quote.chg.startsWith('-') ? '' : '+' }}{{ quote.chg }}%
          </span>
        </div>
        <!-- 分时顶底信号:图上标记的同时在头部列出最近几条,最新在前 -->
        <div v-if="isTrend && !isMultiTrend" class="head-signals">
          <span class="signals-title">顶底</span>
          <span v-if="recentPeaks.length === 0" class="signals-empty">
            暂无信号
          </span>
          <span
            v-for="s in recentPeaks"
            :key="s.ts"
            class="signal-item"
            :class="s.kind"
          >
            {{ s.kind === "top" ? "顶" : "底" }} {{ s.time }}
            {{ s.price.toFixed(3) }}
          </span>
        </div>
        <div class="head-tools">
          <el-radio-group v-model="frequency" size="small">
            <el-radio-button value="t">分时</el-radio-button>
            <el-radio-button value="t9">近9日</el-radio-button>
            <el-radio-button value="d">日K</el-radio-button>
            <el-radio-button value="w">周K</el-radio-button>
            <el-radio-button value="m">月K</el-radio-button>
          </el-radio-group>
          <!-- 分时展示切换:个股(现价/均价双线)或多股(全部自选涨跌幅对比) -->
          <el-radio-group v-if="isTrend" v-model="trendView" size="small">
            <el-radio-button value="single">个股</el-radio-button>
            <el-radio-button value="multi">多股</el-radio-button>
          </el-radio-group>
          <!-- 九日布局切换:3×3 同屏 / 2×4(单元格最低 500px,滚动查看);移动端固定单列无需切换 -->
          <el-radio-group
            v-if="isNineDay && !isMobile"
            v-model="nineLayout"
            size="small"
          >
            <el-radio-button value="3x3">3×3</el-radio-button>
            <el-radio-button value="2x4">2×4</el-radio-button>
          </el-radio-group>
          <!-- 分时类视图下无蜡烛/折线之分,隐藏图表类型切换 -->
          <el-radio-group v-if="!isIntraday" v-model="chartType" size="small">
            <el-radio-button value="candle">K线</el-radio-button>
            <el-radio-button value="line">走势</el-radio-button>
          </el-radio-group>
          <!-- 日K顶底标准:均线方向拐点 / 局部极值+MACD -->
          <el-radio-group v-if="frequency === 'd'" v-model="dailyPeakMode" size="small">
            <el-radio-button value="ma">均线顶底</el-radio-button>
            <el-radio-button value="price">价格顶底</el-radio-button>
          </el-radio-group>
          <!-- loadData 带 silent 参数,模板里必须显式传参,避免把事件对象当成 silent -->
          <el-button size="small" :loading="loading" @click="loadData()">
            刷新
          </el-button>
          <el-button size="small" @click="toggleFullscreen">
            {{ isFullscreen ? "退出全屏" : "全屏" }}
          </el-button>
          <el-button size="small" @click="planVisible = true">计划</el-button>
        </div>
      </header>

      <div
        v-show="!isMultiTrend && !isNineDay"
        class="chart-box"
        :class="{ 'trend-box': isTrend }"
      >
        <!-- 分时图例:现价 / 均价 / 悬停分钟与相对昨收涨跌幅 -->
        <div v-if="isTrend" class="ma-legend">
          <span :style="{ color: TREND_PRICE_COLOR }">
            现价: {{ trendLegend.price }}
          </span>
          <span :style="{ color: TREND_AVG_COLOR }">
            均价: {{ trendLegend.avg }}
          </span>
          <span :class="trendLegend.up ? 'up' : 'down'">
            {{ trendLegend.time }} {{ trendLegend.chg }}
          </span>
        </div>
        <div v-else class="ma-legend">
          <span
            v-for="m in maLegend"
            :key="m.period"
            :style="{ color: m.color }"
          >
            MA{{ m.period }}: {{ m.value }}
          </span>
          <span v-if="currentStock.cost > 0" class="cost-legend">
            成本: {{ currentStock.cost.toFixed(3) }}
          </span>
        </div>
        <div ref="chartRef" v-loading="loading" class="chart-canvas"></div>
      </div>

      <!-- 多股分时顶底汇总:只列最近几分钟内出现的信号,格式「名称:顶/底 价格 时间」 -->
      <div v-show="isMultiTrend" class="multi-signal-list">
        <span v-if="multiSignalList.length === 0" class="list-empty">
          近 {{ MULTI_SIGNAL_WINDOW_MIN }} 分钟无顶底信号
        </span>
        <span
          v-for="s in multiSignalList"
          :key="s.code"
          class="signal-cell"
          :class="s.kind"
        >
          <span class="s-name">{{ s.name }}：</span>
          <span class="s-value">
            {{ s.kind === "top" ? "顶" : "底" }} {{ s.price }}
          </span>
          <!-- 极值时间 + 距现在多久,方便判断信号新不新 -->
          <span class="s-time">{{ s.time }} · {{ s.ageMin }}</span>
        </span>
      </div>

      <!-- 多股分时:每只自选一个独立窗口,两列网格同屏 -->
      <div v-show="isMultiTrend" v-loading="loading" class="multi-grid">
        <div v-for="s in stockList" :key="s.code" class="multi-cell">
          <div class="multi-head">
            <span class="m-name">{{ s.name }}</span>
            <!-- 最近一条顶底信号:顶=绿、底=红 -->
            <span
              v-if="multiPeaks[s.code]"
              class="m-signal"
              :class="multiPeaks[s.code].kind"
            >
              {{ multiPeaks[s.code].kind === "top" ? "顶" : "底" }}
              {{ multiPeaks[s.code].time }}
              {{ multiPeaks[s.code].price.toFixed(3) }}
            </span>
            <span
              class="m-quote"
              :class="multiQuotes[s.code].up ? 'up' : 'down'"
            >
              {{ multiQuotes[s.code].last }} {{ multiQuotes[s.code].chg }}
            </span>
          </div>
          <div :ref="setMultiCanvasEl(s.code)" class="multi-canvas"></div>
        </div>
      </div>

      <!-- 近九日分时:3×3 网格,每格一个交易日(5 分钟粒度) -->
      <div
        v-show="isNineDay"
        v-loading="loading"
        class="multi-grid nine-grid"
        :class="nineLayout === '3x3' ? 'layout-3x3' : 'layout-2x4'"
      >
        <div v-for="d in nineDayTrend" :key="d.date" class="multi-cell">
          <div class="multi-head">
            <span class="m-name">{{ d.label }}</span>
            <span class="m-quote" :class="d.chg >= 0 ? 'up' : 'down'">
              {{ d.last.toFixed(3) }} {{ d.chg >= 0 ? '+' : ''
              }}{{ d.chg.toFixed(2) }}%
            </span>
          </div>
          <div :ref="setNineDayCanvasEl(d.date)" class="multi-canvas"></div>
        </div>
      </div>

      <el-alert
        v-if="error"
        :title="error"
        type="error"
        show-icon
        :closable="false"
        class="chart-error"
      />
    </main>

    <!-- 添加自选股票(自定义项存 localStorage,内置 STOCKS 不受影响) -->
    <el-dialog
      v-model="addVisible"
      title="添加自选股票"
      :width="addDialogWidth"
      :lock-scroll="false"
    >
      <div class="add-form">
        <div class="form-row">
          <label>代码</label>
          <el-input
            v-model="addForm.code"
            placeholder="如 sh.515180 或 515180"
            @keyup.enter="submitAddStock"
          />
        </div>
        <div class="form-row">
          <label>名称</label>
          <el-input
            v-model="addForm.name"
            placeholder="如 红利易方达ETF"
            @keyup.enter="submitAddStock"
          />
        </div>
        <div class="form-row">
          <label>成本价</label>
          <el-input
            v-model="addForm.cost"
            placeholder="可选,不填或 0 表示未持仓"
            @keyup.enter="submitAddStock"
          />
        </div>
        <div class="form-tip">
          代码支持 sh./sz./bj. 前缀;只填 6 位数字时按号段自动判断市场。
        </div>
      </div>
      <template #footer>
        <el-button @click="addVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAddStock">添加</el-button>
      </template>
    </el-dialog>

    <!-- 交易计划文档(markdown 预览,内容来自 plans/<code>.md) -->
    <!-- lock-scroll=false:页面是 100vh 固定布局,锁 body 滚动会引发宽度跳变、图表抖动 -->
    <!-- :title="`${currentStock.name}(${currentStock.code})交易计划`" -->
    <el-dialog
      v-model="planVisible"
      :width="planDialogWidth"
      :lock-scroll="false"
    >
      <div v-if="planContent" class="plan-md" v-html="renderedPlan"></div>
      <el-empty
        v-else
        :description="`尚未创建 plans/${currentStock.code}.md`"
      />
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  TickMarkType,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineData,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { marked } from "marked";
import { ElMessage, ElMessageBox } from "element-plus";
import type { StockItem } from "./constants";
import {
  CUSTOM_STOCKS_KEY,
  DAILY_MA_PEAK_CONFIRM,
  DAILY_MA_PEAK_MIN_GAP,
  DAILY_MA_PEAK_PERIOD,
  DAILY_PEAK_CONFIRM_BARS,
  DAILY_PEAK_TOP_EMPHASIS_GAP,
  DAILY_PEAK_MIN_GAP,
  DAILY_PEAK_MIN_SWING,
  DAILY_PEAK_WINDOW,
  DOWN_COLOR,
  MACD_MARGINS,
  MA_CONFIG,
  MAIN_MARGINS,
  MINI_TREND_MACD_MARGINS,
  MINI_TREND_MAIN_MARGINS,
  MINI_TREND_PRICE_MARGINS,
  MINI_TREND_VOLUME_MARGINS,
  MULTI_POLL_BATCH,
  MULTI_SIGNAL_WINDOW_MIN,
  NINE_DAY_BARS,
  NINE_DAY_COUNT,
  NINE_DAY_PAGE_BARS,
  NINE_DAY_REFRESH_BARS,
  STOCKS,
  TREND_AVG_COLOR,
  TREND_MACD_MARGINS,
  TREND_MAIN_MARGINS,
  TREND_PEAK_MAX_COUNT,
  TREND_PEAK_MAX_SHOW,
  TREND_PEAK_MAX_SWING,
  TREND_PEAK_MIN_GAP,
  TREND_PEAK_MIN_SWING,
  TREND_PEAK_MIN_TICKS,
  TREND_PEAK_RANGE_RATIO,
  TREND_PEAK_STRONG_SWING_MULT,
  TREND_POLL_MS,
  TREND_PRICE_COLOR,
  TOP_EMPHASIS_COLOR,
  TREND_VOLUME_MARGINS,
  UP_COLOR,
  VISIBLE_BARS,
  VOL_MA_CONFIG,
  VOLUME_MARGINS,
} from "./constants";

/** K线数据结构,字段名对齐 baostock query_history_k_data_plus 返回字段 */
interface StockBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  pctChg: number; // 涨跌幅 %
}

/** baostock 代码 -> 东方财富 secid(sh. 前缀市场号为 1,sz./bj. 为 0) */
function toSecid(code: string): string {
  const [market, num] = code.split(".");
  return `${market === "sh" ? 1 : 0}.${num}`;
}

/** baostock 代码 -> 腾讯 symbol(sh.515180 -> sh515180) */
function toTxSymbol(code: string): string {
  return code.replace(".", "");
}

/** 带超时的 JSON 请求:数据源不可达时尽快失败,避免整页长时间挂起 */
async function fetchJson(url: string, timeoutMs = 6000): Promise<any> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 把 fetch 的底层错误翻译成能看懂的原因:
 * 「Failed to fetch」不是 HTTP 状态码,而是请求根本没拿到可用响应 ——
 * 常见于断网、被浏览器插件拦截、或行情接口限流/拒连(此时往往连 CORS 头都不返回)。
 */
function describeFetchError(e: any): string {
  if (e?.name === "AbortError") return "超时";
  const msg: string = e?.message || "";
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return "网络被拒或限流";
  }
  return msg || "失败";
}

/** 依次尝试多个数据源(主源失败自动切备用源),全部失败时汇总错误信息 */
async function trySources<T>(
  label: string,
  sources: (() => Promise<T>)[]
): Promise<T> {
  const errors: string[] = [];
  for (const source of sources) {
    try {
      return await source();
    } catch (e: any) {
      errors.push(describeFetchError(e));
    }
  }
  // 两个源经常报同样的错(如都被拒连),去重后提示更好读
  throw new Error(`${label}请求失败(${[...new Set(errors)].join(" / ")})`);
}

/** 拉取 K 线(腾讯优先,东方财富备用);返回结构对齐 baostock 的 StockBar[] */
async function fetchBars(
  code: string,
  frequency: "d" | "w" | "m"
): Promise<StockBar[]> {
  return trySources("行情", [
    () => fetchBarsTx(code, frequency),
    () => fetchBarsEm(code, frequency),
  ]);
}

/**
 * 实时报价(东财,支持跨域):K线模式头部的「当前价格」用它。
 * 日K接口最后一根在盘中可能滞后,周/月K的最后一根更是周期末价格,不能代表现价。
 * f43 = 最新价、f60 = 昨收(均为整数),按 f59 的小数位数还原。
 */
async function fetchLiveQuote(
  code: string
): Promise<{ price: number; preClose: number }> {
  const url =
    `https://push2.eastmoney.com/api/qt/stock/get` +
    `?secid=${toSecid(code)}&fields=f43,f59,f60`;
  const json = await fetchJson(url);
  const d = json?.data;
  const scale = 10 ** Number(d?.f59 ?? 3);
  const price = Number(d?.f43) / scale;
  const preClose = Number(d?.f60) / scale;
  if (!price || !preClose || !Number.isFinite(price) || !Number.isFinite(preClose)) {
    throw new Error("无实时报价");
  }
  return { price, preClose };
}

/**
 * 昨收兜底:腾讯分时缺 qt、东财 trends2 压根不返回昨收(实测 data 里没有 preClose),
 * 这两种情况都会让头部「当前价格/涨幅」和图上昨收虚线全部失效,
 * 因此退一步用实时报价接口的 f60(昨收)补上。
 */
async function ensurePreClose(code: string, preClose: number): Promise<number> {
  if (preClose > 0) return preClose;
  try {
    return (await fetchLiveQuote(code)).preClose;
  } catch {
    return preClose; // 兜底也失败:保持 0,调用方只展示现价
  }
}

/**
 * 北京时间的今日 yyyy-MM-dd:行情日期都是按北京时间给的,
 * 用本地时区取日期在跨时区机器上会把「今天」算错(误判休市)。
 */
function todayStr(): string {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  const m = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${d.getUTCDate()}`.padStart(2, "0");
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

/** 用实时报价修正当天那根K线:腾讯日/周/月K最后一根在盘中可能滞后半分钟以上 */
function applyLiveQuoteToBars(
  bars: StockBar[],
  quote: { price: number; preClose: number },
  frequency: "d" | "w" | "m" | "t" | "t9"
) {
  const last = bars.at(-1);
  if (!last || last.date !== todayStr()) return;
  last.close = quote.price;
  last.high = Math.max(last.high, quote.price);
  last.low = Math.min(last.low, quote.price);
  // 只有日K的涨跌幅是「相对昨收」,周/月K保留周期涨跌幅
  if (frequency === "d" && quote.preClose > 0) {
    last.pctChg = ((quote.price - quote.preClose) / quote.preClose) * 100;
  }
}

/** 腾讯 K 线(前复权):日/周/月,行格式 [日期,开,收,高,低,成交量(手)] */
async function fetchBarsTx(
  code: string,
  frequency: "d" | "w" | "m"
): Promise<StockBar[]> {
  const symbol = toTxSymbol(code);
  const period = frequency === "d" ? "day" : frequency === "w" ? "week" : "month";
  // 与东方财富保持同样的历史长度
  const lmt = frequency === "d" ? 750 : frequency === "w" ? 260 : 120;
  const url =
    `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get` +
    `?param=${symbol},${period},,,${lmt},qfq`;
  const json = await fetchJson(url);
  const data = json?.data?.[symbol];
  // qfq 数据键为 qfqday/qfqweek/qfqmonth(个别标的可能缺复权数据,退回原始键)
  const rows: string[][] = data?.[`qfq${period}`] ?? data?.[period] ?? [];
  if (rows.length === 0) throw new Error("无数据");
  return rows.map((row, i) => {
    const [date, open, close, high, low, volume] = row;
    // 腾讯日线不直接给涨跌幅,用前一根收盘价计算
    const prevClose = i > 0 ? +rows[i - 1][2] : +open;
    return {
      date,
      open: +open,
      high: +high,
      low: +low,
      close: +close,
      volume: +volume,
      pctChg: prevClose > 0 ? ((+close - prevClose) / prevClose) * 100 : 0,
    };
  });
}

/** 东方财富 K 线(备用源):klt 101=日/102=周/103=月,fqt=1 前复权 */
async function fetchBarsEm(
  code: string,
  frequency: "d" | "w" | "m"
): Promise<StockBar[]> {
  // klt: 101=日K, 102=周K, 103=月K;fqt=1 前复权
  const klt = frequency === "d" ? "101" : frequency === "w" ? "102" : "103";
  // 一次拉足历史(日K近三年、周K近五年、月K近十年),图表内可左滑查看;想看更久再调大 lmt
  const lmt = frequency === "d" ? 750 : frequency === "w" ? 260 : 120;
  // fields2 顺序:日期,开盘,收盘,最高,最低,成交量,成交额,涨跌幅(f59;f61 是换手率,勿用)
  const url =
    `https://push2his.eastmoney.com/api/qt/stock/kline/get` +
    `?secid=${toSecid(code)}&fields1=f1,f2,f3,f4,f5,f6` +
    `&fields2=f51,f52,f53,f54,f55,f56,f57,f59` +
    `&klt=${klt}&fqt=1&end=20500101&lmt=${lmt}`;

  const json = await fetchJson(url);
  const klines: string[] = json?.data?.klines ?? [];
  if (klines.length === 0) throw new Error("无数据");
  return klines.map((line) => {
    const [date, open, close, high, low, volume, , pctChg] = line.split(",");
    return {
      date,
      open: +open,
      high: +high,
      low: +low,
      close: +close,
      volume: +volume,
      pctChg: +pctChg,
    };
  });
}

/** 拉取当日分时(腾讯优先,东方财富备用) */
async function fetchTrend(code: string): Promise<TrendData> {
  return trySources("分时", [
    () => fetchTrendTx(code),
    () => fetchTrendEm(code),
  ]);
}

/**
 * 腾讯当日分时(备用主源):data.data[] 每行 "HHmm 现价 累计成交量(手) 累计成交额"。
 * 腾讯会附带 15:06-15:30 的盘后固定价格交易点,这里只保留 09:30-11:30 / 13:00-15:00。
 */
async function fetchTrendTx(code: string): Promise<TrendData> {
  const symbol = toTxSymbol(code);
  const url =
    `https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${symbol}`;
  const json = await fetchJson(url);
  const data = json?.data?.[symbol];
  const rows: string[] = data?.data?.data ?? [];
  if (rows.length === 0) throw new Error("无数据");
  // 昨收:qt 数组第 5 项(索引 4)
  const preClose = +(data?.qt?.[symbol]?.[4] ?? 0);
  const day = data?.data?.date ?? ""; // yyyymmdd
  const baseTs =
    Date.UTC(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8), 9, 30) /
    1000;
  let prevVol = 0;
  const points = rows
    .filter((line) => {
      const t = +line.slice(0, 4);
      return (t >= 930 && t <= 1130) || (t >= 1300 && t <= 1500);
    })
    .map((line, i) => {
      const [t, price, cumVol, cumAmount] = line.split(" ");
      const volume = Math.max(0, +cumVol - prevVol);
      prevVol = +cumVol;
      return {
        time: `${t.slice(0, 2)}:${t.slice(2, 4)}`,
        price: +price,
        // 均价 = 累计成交额 / 累计成交量(成交量单位为手,1 手 = 100 份)
        avg: +cumVol > 0 ? +cumAmount / (+cumVol * 100) : +price,
        volume,
        ts: (baseTs + i * 60) as UTCTimestamp,
      };
    });
  return { preClose: await ensurePreClose(code, preClose), points };
}

/** 东方财富当日分时(trends2 接口,ndays=1 返回最近交易日的分钟线) */
async function fetchTrendEm(code: string): Promise<TrendData> {
  // fields2 顺序:日期时间,开,现价,最高,最低,成交量(手),成交额,均价
  const url =
    `https://push2his.eastmoney.com/api/qt/stock/trends2/get` +
    `?secid=${toSecid(code)}&fields1=f1,f2,f3,f4,f5,f6` +
    `&fields2=f51,f52,f53,f54,f55,f56,f57,f58&iscr=0&ndays=1`;
  const json = await fetchJson(url);
  // 注意:trends2 的 data 里没有 preClose 字段,靠 ensurePreClose 用实时报价补
  const preClose: number = json?.data?.preClose ?? 0;
  const klines: string[] = json?.data?.trends ?? [];
  if (klines.length === 0) throw new Error("无数据");
  // 时间轴压缩:A股分时习惯在午休(11:30-13:00)不留空档 —— 伪时间戳从
  // 09:30 起按点序号每点 +60 秒(241 点恰好等于 4 小时交易时长),
  // 显示时经 trendPointMap 映射回真实 HH:mm
  const [day] = (klines[0] ?? "1970-01-01").split(" ");
  const [y, mo, d] = day.split("-").map(Number);
  const baseTs = Date.UTC(y, mo - 1, d, 9, 30) / 1000;
  const points = klines.map((line, i) => {
    const [dt, , price, , , volume, , avg] = line.split(",");
    return {
      time: dt.slice(11),
      price: +price,
      avg: +avg,
      volume: +volume,
      ts: (baseTs + i * 60) as UTCTimestamp,
    };
  });
  return { preClose: await ensurePreClose(code, preClose), points };
}

/** 九日分时点(5 分钟粒度):ts 为压缩时间轴的伪时间戳,均价为当日累计成交均价 */
interface NineDayPoint {
  time: string;
  price: number;
  avg: number;
  volume: number;
  ts: number;
}

/** 单个交易日的分时数据(含当日涨跌幅,供窗口头部展示) */
interface NineDayTrendDay {
  /** yyyymmdd */
  date: string;
  /** 窗口标题,如 "10-16 周五" */
  label: string;
  preClose: number;
  last: number;
  /** 相对昨收涨跌幅 % */
  chg: number;
  points: NineDayPoint[];
}

/**
 * 拉取近九个交易日的分时(腾讯优先,东方财富备用)。
 * force = false 时走盘中增量刷新,腾讯源只补最新一页,历史日复用缓存。
 */
async function fetchNineDayTrends(
  code: string,
  force = false
): Promise<NineDayTrendDay[]> {
  return trySources("九日分时", [
    () => fetchNineDayTrendsTx(code, force),
    () => fetchNineDayTrendsEm(code),
  ]);
}

/** 腾讯 1 分钟线缓存(代码 -> 交易日 -> 行);历史日不变,盘中只补最新数据 */
let nineDayTxCode = "";
const nineDayTxDays = new Map<string, string[][]>();

/** 把一页分钟行按交易日合并进缓存(按时间戳去重,增量刷新不会丢掉当天早盘数据) */
function upsertTxPage(rows: string[][]) {
  const byDay = new Map<string, string[][]>();
  for (const row of rows) {
    const day = row[0].slice(0, 8);
    const list = byDay.get(day);
    if (list) list.push(row);
    else byDay.set(day, [row]);
  }
  for (const [day, dayRows] of byDay) {
    const merged = new Map(
      (nineDayTxDays.get(day) ?? []).map((row) => [row[0], row])
    );
    for (const row of dayRows) merged.set(row[0], row);
    nineDayTxDays.set(
      day,
      [...merged.values()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
    );
  }
}

/**
 * 腾讯 1 分钟线(主源):单页 800 根 ≈ 3.3 个交易日,按页首时间戳向前翻页,
 * 直到覆盖 9 个展示日 + 前一日(算昨收)。1 分钟粒度比 5 分钟更能反映盘中细节。
 */
async function fetchNineDayTrendsTx(
  code: string,
  force = false
): Promise<NineDayTrendDay[]> {
  const symbol = toTxSymbol(code);
  const urlOf = (anchor: string, count: number) =>
    `https://ifzq.gtimg.cn/appstock/app/kline/mkline` +
    `?param=${symbol},m1,${anchor},${count}`;

  let latestPreClose = 0;
  const needFull = force || nineDayTxCode !== code || nineDayTxDays.size === 0;
  if (needFull) {
    // 首次 / 手动刷新 / 切股票:向前翻页拉足 10 个交易日
    nineDayTxCode = code;
    nineDayTxDays.clear();
    let anchor = "";
    for (let page = 0; page < 4; page++) {
      const json = await fetchJson(urlOf(anchor, NINE_DAY_PAGE_BARS));
      const rows: string[][] = json?.data?.[symbol]?.m1 ?? [];
      if (rows.length === 0) break;
      if (page === 0) latestPreClose = +json?.data?.[symbol]?.prec || 0;
      upsertTxPage(rows);
      anchor = rows[0][0]; // 下一页从本页最早一分钟继续向前
      if (nineDayTxDays.size > NINE_DAY_COUNT) break;
    }
  } else {
    // 盘中轮询:只拉最近一页,合并进缓存
    const json = await fetchJson(urlOf("", NINE_DAY_REFRESH_BARS));
    latestPreClose = +json?.data?.[symbol]?.prec || 0;
    upsertTxPage(json?.data?.[symbol]?.m1 ?? []);
  }
  if (nineDayTxDays.size === 0) throw new Error("无数据");

  // 只保留最近 11 个交易日(9 个展示日 + 缓冲),避免缓存无限增长
  const allDates = [...nineDayTxDays.keys()].sort();
  for (const day of allDates.slice(0, -11)) nineDayTxDays.delete(day);
  const keepDates = allDates.slice(-11);
  // 倒序:最新的交易日在最前(网格左上角)
  const dates = keepDates.slice(-NINE_DAY_COUNT).reverse();
  const week = ["日", "一", "二", "三", "四", "五", "六"];

  return dates.map((day) => {
    const list = nineDayTxDays.get(day)!;
    const y = +day.slice(0, 4);
    const mo = +day.slice(4, 6);
    const d = +day.slice(6, 8);
    // 昨收 = 前一交易日最后一分钟收盘价;首日无前一日时退化为当日开盘。
    // 最新交易日优先用接口 prec(已除权除息),避免 XD 日把涨跌幅算错
    const prevDay = keepDates[keepDates.indexOf(day) - 1];
    const prevList = prevDay ? nineDayTxDays.get(prevDay) : undefined;
    let preClose = prevList?.length
      ? +prevList[prevList.length - 1][2]
      : +list[0][1];
    if (day === dates[0] && latestPreClose > 0) {
      preClose = latestPreClose;
    }
    // 压缩时间轴:午休(11:30-13:00)不留空档,241 根分钟线恰好等于 4 小时交易时长
    const baseTs = Date.UTC(y, mo - 1, d, 9, 30) / 1000;
    let amount = 0;
    let totalVol = 0;
    const points = list.map((row, i) => {
      const price = +row[2];
      const volume = +row[5];
      // 分时均价 = 当日累计成交额 / 累计成交量(用每根收盘价近似成交额)
      amount += price * volume;
      totalVol += volume;
      return {
        time: `${row[0].slice(8, 10)}:${row[0].slice(10, 12)}`,
        price,
        avg: totalVol > 0 ? amount / totalVol : price,
        volume,
        ts: baseTs + i * 60,
      };
    });
    const last = points[points.length - 1].price;
    return {
      date: day,
      label: `${day.slice(4, 6)}-${day.slice(6, 8)} 周${
        week[new Date(y, mo - 1, d).getDay()]
      }`,
      preClose,
      last,
      chg: preClose > 0 ? ((last - preClose) / preClose) * 100 : 0,
      points,
    };
  });
}

/**
 * 东方财富 5 分钟线(备用源):klt=5 + fqt=1 前复权,跨除权除息日价格口径一致,
 * 昨收取前一交易日最后一根收盘价即可。
 */
async function fetchNineDayTrendsEm(
  code: string
): Promise<NineDayTrendDay[]> {
  const url =
    `https://push2his.eastmoney.com/api/qt/stock/kline/get` +
    `?secid=${toSecid(code)}&fields1=f1,f2,f3,f4,f5,f6` +
    `&fields2=f51,f52,f53,f54,f55,f56,f57` +
    `&klt=5&fqt=1&beg=0&end=20500101&lmt=${NINE_DAY_BARS}`;
  const json = await fetchJson(url);
  // 行格式:日期时间,开,收,高,低,成交量(手),成交额
  const klines: string[] = json?.data?.klines ?? [];
  if (klines.length === 0) throw new Error("无数据");

  // 按交易日分组(日期形如 "2026-10-16")
  const groups = new Map<string, string[]>();
  for (const line of klines) {
    const day = line.slice(0, 10);
    const list = groups.get(day);
    if (list) list.push(line);
    else groups.set(day, [line]);
  }
  const allDates = [...groups.keys()].sort();
  // 倒序:最新的交易日在最前(网格左上角)
  const dates = allDates.slice(-NINE_DAY_COUNT).reverse();
  const week = ["日", "一", "二", "三", "四", "五", "六"];

  return dates.map((day) => {
    const list = groups.get(day)!;
    const y = +day.slice(0, 4);
    const mo = +day.slice(5, 7);
    const d = +day.slice(8, 10);
    // 昨收 = 前一交易日最后一根收盘价(前复权口径一致)
    const prevDay = allDates[allDates.indexOf(day) - 1];
    const prevList = prevDay ? groups.get(prevDay) : undefined;
    const preClose = prevList?.length
      ? +prevList[prevList.length - 1].split(",")[2]
      : +list[0].split(",")[1];
    // 压缩时间轴:午休不留空档,48 根 5 分钟线恰好等于 4 小时交易时长
    const baseTs = Date.UTC(y, mo - 1, d, 9, 30) / 1000;
    let amount = 0;
    let totalVol = 0;
    const points = list.map((line, i) => {
      const [dt, , close, , , volume] = line.split(",");
      const price = +close;
      const vol = +volume;
      // 均价 = 当日累计成交额 / 累计成交量(用每根收盘价近似,与复权价格同口径)
      amount += price * vol;
      totalVol += vol;
      return {
        time: dt.slice(11),
        price,
        avg: totalVol > 0 ? amount / totalVol : price,
        volume: vol,
        ts: baseTs + i * 300,
      };
    });
    const last = points[points.length - 1].price;
    return {
      date: day,
      label: `${day.slice(5, 7)}-${day.slice(8, 10)} 周${
        week[new Date(y, mo - 1, d).getDay()]
      }`,
      preClose,
      last,
      chg: preClose > 0 ? ((last - preClose) / preClose) * 100 : 0,
      points,
    };
  });
}

// ---------- 自选列表(内置 STOCKS + 用户自定义,后者持久化到 localStorage) ----------

/** 读取用户自定义自选;数据损坏或格式不符时退回空数组 */
function loadCustomStocks(): StockItem[] {
  try {
    const raw = localStorage.getItem(CUSTOM_STOCKS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.filter(
      (s): s is StockItem =>
        typeof s?.code === "string" &&
        typeof s?.name === "string" &&
        typeof s?.cost === "number"
    );
  } catch {
    return [];
  }
}

const customStocks = ref<StockItem[]>(loadCustomStocks());
/** 左侧自选列表:内置在前,自定义在后 */
const stockList = computed(() => [...STOCKS, ...customStocks.value]);

function saveCustomStocks() {
  try {
    localStorage.setItem(CUSTOM_STOCKS_KEY, JSON.stringify(customStocks.value));
  } catch {
    // 隐私模式或存储已满:忽略写入失败,本次会话内仍可正常使用
  }
}

/** 是否为用户自定义股票(决定是否显示移除按钮) */
function isCustomStock(code: string): boolean {
  return customStocks.value.some((s) => s.code === code);
}

const currentCode = ref(STOCKS[0].code);
/** t = 分时(当日分钟走势),t9 = 近九日分时,d/w/m = 日/周/月K */
const frequency = ref<"t" | "t9" | "d" | "w" | "m">("d");
/** 是否为当日分时模式(与日/周/月K 的图表结构、数据源均不同) */
const isTrend = computed(() => frequency.value === "t");
/** 近九日分时(3×3 网格) */
const isNineDay = computed(() => frequency.value === "t9");
/** 分时类视图(当日分时或近九日分时),决定盘中自动刷新与主图 series 是否存在 */
const isIntraday = computed(() => isTrend.value || isNineDay.value);
/** 分时展示方式:single = 当前个股(现价/均价双线),multi = 全部自选涨跌幅对比 */
const trendView = ref<"single" | "multi">("single");
const isMultiTrend = computed(
  () => isTrend.value && trendView.value === "multi"
);
/** 九日网格布局:3x3 = 3 列 3 行同屏;2x4 = 2 列、单元格最低 500px 滚动查看 */
const nineLayout = ref<"3x3" | "2x4">("2x4");
const chartType = ref<"candle" | "line">("candle");
const loading = ref(false);
const error = ref("");
const bars = ref<StockBar[]>([]);

/** 分时点:time 为真实分钟 "HH:mm";ts 为压缩时间轴的伪时间戳(见 fetchTrend) */
interface TrendPoint {
  time: string;
  price: number;
  avg: number;
  volume: number;
  ts: number;
}

/** 当日分时数据(现价、均价、分钟量、昨收) */
interface TrendData {
  preClose: number;
  points: TrendPoint[];
}

const trend = ref<TrendData | null>(null);
/** 多股分时数据(代码 -> 当日分时;多股模式下全量在手,切个股无需重拉) */
const multiTrend = ref<Record<string, TrendData>>({});
/** 多股实时报价(代码 -> 现价/昨收),每轮只刷一小批,分钟线一分钟才重拉一次 */
const multiLive = ref<Record<string, { price: number; preClose: number }>>({});
/** 多股盘中轮巡的游标:轻量刷新每轮只取 MULTI_POLL_BATCH 只,轮流覆盖全部自选 */
let multiPollCursor = 0;
/** 近九日分时数据(当前个股,按日期升序) */
const nineDayTrend = ref<NineDayTrendDay[]>([]);

const currentStock = computed(
  () => stockList.value.find((s) => s.code === currentCode.value) ?? STOCKS[0]
);

// ---------- 添加 / 移除自选 ----------
const addVisible = ref(false);
const addForm = ref({ code: "", name: "", cost: "" });

function openAddStock() {
  addForm.value = { code: "", name: "", cost: "" };
  addVisible.value = true;
}

/** 规范化为 baostock 代码:支持 sh515180 / sh.515180 / 515180(纯数字按号段推断市场) */
function normalizeStockCode(input: string): string {
  const raw = input.trim().toLowerCase().replace(/\s+/g, "");
  const m = raw.match(/^(sh|sz|bj)?\.?(\d{6})$/);
  if (!m) return "";
  const num = m[2];
  const market =
    m[1] ?? (/^[569]/.test(num) ? "sh" : /^[48]/.test(num) ? "bj" : "sz");
  return `${market}.${num}`;
}

function submitAddStock() {
  const code = normalizeStockCode(addForm.value.code);
  const name = addForm.value.name.trim();
  if (!code) {
    ElMessage.warning("请输入 6 位代码,如 sh.515180 或 515180");
    return;
  }
  if (!name) {
    ElMessage.warning("请输入股票名称");
    return;
  }
  if (stockList.value.some((s) => s.code === code)) {
    ElMessage.warning("该股票已在自选列表中");
    return;
  }
  const cost = addForm.value.cost.trim() ? Number(addForm.value.cost) : 0;
  if (!Number.isFinite(cost) || cost < 0) {
    ElMessage.warning("成本价必须是不小于 0 的数字");
    return;
  }
  customStocks.value.push({ code, name, cost });
  saveCustomStocks();
  addVisible.value = false;
  addForm.value = { code: "", name: "", cost: "" };
  currentCode.value = code; // 添加后直接切换到新标的
  ElMessage.success(`已添加 ${name}`);
}

/** 移除自定义股票(内置股票不可移除) */
async function removeStock(code: string) {
  try {
    await ElMessageBox.confirm("确定从自选列表中移除该股票吗?", "提示", {
      type: "warning",
      confirmButtonText: "移除",
      cancelButtonText: "取消",
    });
  } catch {
    return; // 用户取消
  }
  customStocks.value = customStocks.value.filter((s) => s.code !== code);
  saveCustomStocks();
  // 多股视图下清理对应窗口
  multiCharts[code]?.chart.remove();
  delete multiCharts[code];
  if (currentCode.value === code) currentCode.value = STOCKS[0].code;
}

/** 头部报价:分时取最新一分钟价格(相对昨收),K线取最新收盘价 */
/** K线模式下的实时报价:日K最后一根收盘价盘中可能滞后,周/月K则只是周期末价格 */
const liveQuote = ref<{ code: string; price: number; preClose: number } | null>(
  null
);

const quote = computed(() => {
  if (isNineDay.value) {
    // 九日数据按倒序存放,第一个即最新交易日
    const day = nineDayTrend.value[0];
    if (!day) return { last: "--", chg: "0.00" };
    return { last: day.last.toFixed(3), chg: day.chg.toFixed(2) };
  }
  if (isTrend.value) {
    // 分钟线一分钟才重拉一次,现价优先用实时报价(每轮轮询都会刷新)
    const live =
      liveQuote.value?.code === currentCode.value ? liveQuote.value : null;
    const p = trend.value?.points.at(-1);
    const price = live ? live.price : p?.price;
    if (price === undefined) return { last: "--", chg: "0.00" };
    const pre =
      live && live.preClose > 0 ? live.preClose : (trend.value?.preClose ?? 0);
    // 没有昨收时至少把现价显示出来,涨跌幅按 0 处理(不再整块退化成 "--")
    if (!(pre > 0)) return { last: price.toFixed(3), chg: "0.00" };
    const chg = ((price - pre) / pre) * 100;
    return { last: price.toFixed(3), chg: chg.toFixed(2) };
  }
  const last = bars.value.at(-1);
  if (!last) return { last: "--", chg: "0.00" };
  // 优先用实时报价:K线最后一根在盘中可能滞后(周/月K更是周期末收盘价)
  const live = liveQuote.value;
  if (live && live.code === currentCode.value && live.preClose > 0) {
    const chg = ((live.price - live.preClose) / live.preClose) * 100;
    return { last: live.price.toFixed(3), chg: chg.toFixed(2) };
  }
  return { last: last.close.toFixed(3), chg: last.pctChg.toFixed(2) };
});

const chgClass = computed(() => {
  if (isNineDay.value) {
    return (nineDayTrend.value[0]?.chg ?? 0) >= 0 ? "up" : "down";
  }
  // 分时与 K 线都跟头部报价保持一致(涨跌幅串带负号即为跌)
  return quote.value.chg.startsWith("-") ? "down" : "up";
});

/** 计算 MACD(12,26,9):DIF = EMA12 - EMA26,DEA = EMA9(DIF),柱 = (DIF - DEA) × 2(国内软件习惯) */
function calcMACD(closes: number[], fast = 12, slow = 26, signal = 9) {
  const ema = (period: number, data: number[]) => {
    const alpha = 2 / (period + 1);
    const out: number[] = [];
    data.forEach((v, i) => {
      out.push(i === 0 ? v : alpha * v + (1 - alpha) * out[i - 1]);
    });
    return out;
  };
  const dif = ema(fast, closes).map(
    (v, i) => v - ema(slow, closes)[i]
  );
  const dea = ema(signal, dif);
  return { dif, dea, macd: dif.map((d, i) => (d - dea[i]) * 2) };
}

/** 简单移动平均 MA(滑动窗口);数据不足 period 的前置点返回 undefined(不绘制) */
function calcMA(closes: number[], period: number): (number | undefined)[] {
  let sum = 0;
  return closes.map((_, i) => {
    sum += closes[i];
    if (i >= period) sum -= closes[i - period];
    return i < period - 1 ? undefined : sum / period;
  });
}

// ---------- 分时 X 轴:固定为整个交易日(09:30-11:30 + 13:00-15:00) ----------

/** 一日交易时长(分钟):上午 120 + 下午 120,午休不占时间轴 */
const TREND_DAY_MINUTES = 240;

/** 伪时间戳 -> 时间轴文字;整天槽位(含尚未走到的分钟)都登记,刻度才不会退化成时间戳数字 */
const trendAxisLabels = new Map<number, string>();

/** 清空分时反查/刻度表:切股、切周期或加载失败时避免上一份数据残留 */
function clearTrendMaps() {
  trendPointMap.clear();
  trendAxisLabels.clear();
}

/** 真实时间 "HH:mm" -> 压缩时间轴上的分钟序号(09:30 = 0,午休不占位) */
function trendAxisMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  const real = h * 60 + m;
  return real - (9 * 60 + 30) - (real > 11 * 60 + 30 ? 90 : 0);
}

/** 压缩时间轴上的第 index 个槽位 -> 真实 "HH:mm"(跨过上午收盘后补回午休的 90 分钟) */
function trendSlotLabel(first: string, index: number, stepMin: number): string {
  const axis = trendAxisMinutes(first) + index * stepMin;
  const real = 9 * 60 + 30 + axis + (axis > 120 ? 90 : 0);
  const h = Math.floor(real / 60);
  const m = real % 60;
  return `${h < 10 ? "0" : ""}${h}:${m < 10 ? "0" : ""}${m}`;
}

/** 相邻分时点的间隔(秒);数据不足两点时按 1 分钟 */
function trendStepSec(points: { ts: number }[]): number {
  return points.length > 1 ? Math.max(60, points[1].ts - points[0].ts) : 60;
}

/**
 * 某一天的完整时间轴槽位:恒定 09:30 → 15:00,与已走到的分钟数无关。
 * 1. 按数据粒度(1 分钟 / 5 分钟)铺满整天,共 240 分钟交易时长;
 * 2. 首点先按自身时间对齐到时钟网格上,所以数据从盘中(如 10:15、13:00)才开始时,
 *    左侧空出的分钟同样补成空白槽位,X 轴左边界依然是 09:30;
 * 3. 结尾一律停在 15:00,早盘只有几十个点时这些点只占左侧一小段。
 */
function trendDaySlots<T extends { ts: number; time: string }>(
  points: T[]
): number[] {
  if (points.length === 0) return [];
  const step = trendStepSec(points);
  const stepMin = step / 60;
  const first = points[0];
  // 首点在整日时间轴上的位置(0 = 09:30)
  const offset = Math.round(trendAxisMinutes(first.time) / stepMin);
  // 网格锚回 09:30:首点伪时间戳 - offset 个槽位
  const startTs = first.ts - Math.max(0, offset) * step;
  const total = Math.round(TREND_DAY_MINUTES / stepMin) + 1;
  const slots: number[] = [];
  for (let i = 0; i < total; i++) slots.push(startTs + i * step);
  // 个别数据源会多给一根(如 15:01),以数据为准向后延伸
  const lastTs = points[points.length - 1].ts;
  let last = slots[slots.length - 1];
  while (last < lastTs) {
    last += step;
    slots.push(last);
  }
  return slots;
}

/** 把整日槽位(含空白分钟)的 "HH:mm" 登记给时间轴;真实分钟优先用行情自身的时间 */
function registerTrendAxis(
  points: { ts: number; time: string }[],
  slots: number[]
) {
  if (points.length === 0) return;
  const stepMin = trendStepSec(points) / 60;
  // 槽位 0 恒为 09:30,与数据起点无关
  slots.forEach((ts, i) => {
    trendAxisLabels.set(ts, trendSlotLabel("09:30", i, stepMin));
  });
  for (const p of points) trendAxisLabels.set(p.ts, p.time);
}

/** 时间轴左右各留出的空白(像素):留给首尾的顶底标记箭头与价格文字,避免被边缘裁掉 */
const TREND_AXIS_PAD_PX = 30;

/** 把时间轴钉在整日槽位区间(09:30 → 15:00),左右各留一点余量;没有数据时才退回 fitContent */
function pinTrendAxis(chartApi: IChartApi, slots: number[]) {
  const last = slots.length - 1;
  if (last <= 0) {
    chartApi.timeScale().fitContent();
    return;
  }
  // 按当前宽度把「留 30px」换算成需要空出几根线的宽度(窄屏自动变小)
  const width = chartApi.timeScale().width();
  const barSpacing = Math.max(1, width / (last + 1));
  const padBars = Math.round(TREND_AXIS_PAD_PX / barSpacing);
  const pad = Math.min(24, Math.max(3, padBars));
  chartApi.timeScale().setVisibleLogicalRange({
    from: -pad,
    to: last + pad,
  });
}

/** 序列数据项(线/柱共用;柱多一个 color) */
interface TrendSeriesItem {
  value: number;
  color?: string;
}

/** 分时序列项:真实分钟给 value(柱多一个 color),未走到的分钟只有 time(whitespace) */
type TrendSlotItem =
  | (TrendSeriesItem & { time: UTCTimestamp })
  | { time: UTCTimestamp };

/** 按整天槽位铺序列数据:有真实分钟的给值,尚未走到的分钟用 whitespace 占位(不绘制) */
function fillTrendSlots<T extends { ts: number }>(
  slots: number[],
  points: T[],
  toItem: (p: T, index: number) => TrendSeriesItem
): TrendSlotItem[] {
  const indexOf = new Map(points.map((p, i) => [p.ts, i]));
  return slots.map((ts) => {
    const i = indexOf.get(ts);
    return i === undefined
      ? { time: ts as UTCTimestamp }
      : { time: ts as UTCTimestamp, ...toItem(points[i], i) };
  });
}

// ---------- lightweight-charts ----------
/** 量柱 / MACD 柱的半透明红绿(K线与分时共用) */
const upBar = "rgba(239,35,42,0.45)";
const downBar = "rgba(8,153,129,0.45)";
const chartRef = ref<HTMLElement>();
let chart: IChartApi | null = null;
let mainSeries: ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | null = null;
let volumeSeries: ISeriesApi<"Histogram"> | null = null;
/** 成交量副图的均量线(根数与颜色见 VOL_MA_CONFIG) */
let volMaSeries: ISeriesApi<"Line">[] = [];
let macdDifSeries: ISeriesApi<"Line"> | null = null;
let macdDeaSeries: ISeriesApi<"Line"> | null = null;
let macdHistSeries: ISeriesApi<"Histogram"> | null = null;
let resizeObserver: ResizeObserver | null = null;

let maSeries: ISeriesApi<"Line">[] = [];
/** 主图上的持仓成本线(价格来自 STOCKS 的 cost) */
let costLine: IPriceLine | null = null;
// 分时模式专用:现价线 + 均价线(挂主图默认坐标系)及昨收基准虚线
let trendPriceSeries: ISeriesApi<"Line"> | null = null;
let trendAvgSeries: ISeriesApi<"Line"> | null = null;
let preCloseLine: IPriceLine | null = null;
/** 伪时间戳 -> 分时点(时间轴 formatter 与十字光标反查共用) */
const trendPointMap = new Map<number, TrendPoint>();
/** 均线缓存(供图例取值,避免十字光标移动时重算) */
let maCache: (number | undefined)[][] = [];
/** 左上角 MA 图例(随十字光标位置变化) */
const maLegend = ref(
  MA_CONFIG.map((c) => ({ period: c.period, color: c.color, value: "--" }))
);

/** 更新 MA 图例数值;index 为空时显示最新一根 */
function updateMaLegend(index?: number) {
  const i = index ?? bars.value.length - 1;
  maLegend.value = MA_CONFIG.map((cfg, mi) => {
    const v = maCache[mi]?.[i];
    return {
      period: cfg.period,
      color: cfg.color,
      value: v === undefined ? "--" : v.toFixed(3),
    };
  });
}

/** 左上角分时图例(现价/均价/时间/涨跌幅,随十字光标位置变化) */
const trendLegend = ref({
  time: "--",
  price: "--",
  avg: "--",
  chg: "",
  up: true,
});

/** 更新分时图例;point 为空时显示最新一分钟 */
function updateTrendLegend(point?: TrendPoint) {
  const data = trend.value;
  const p = point ?? data?.points.at(-1);
  if (!data || !p) {
    trendLegend.value = {
      time: "--",
      price: "--",
      avg: "--",
      chg: "",
      up: true,
    };
    return;
  }
  // 昨收缺失时仍然显示现价/均价,只是不算涨跌幅
  const pre = data.preClose > 0 ? data.preClose : 0;
  const pct = pre > 0 ? ((p.price - pre) / pre) * 100 : NaN;
  const valid = Number.isFinite(pct);
  trendLegend.value = {
    time: p.time,
    price: p.price.toFixed(3),
    avg: p.avg.toFixed(3),
    chg: valid ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : "",
    up: valid ? pct >= 0 : true,
  };
}

/** 顶底信号(分时与日K共用) */
interface TrendPeak {
  kind: "top" | "bottom";
  /** 点在序列中的下标 */
  index: number;
  /** 转折点(极值)所在分钟 */
  ts: number;
  time: string;
  price: number;
  /** 信号被确认(真正出现)的时间:ZigZag 要等反向摆动达到阈值才输出,
   *  往往晚于极值几分钟;「最近 N 分钟内出现的信号」按它判断 */
  confirmTs?: number;
  confirmTime?: string;
}

/** 顶底判定所需的最小点结构(TrendPoint 与日K收盘价序列都满足) */
interface PeakPoint {
  time: string;
  price: number;
  ts: number;
}

/** 日K「价格顶底」判定参数(分时改用 ZigZag,见 calcZigZagPeaks) */
interface PeakOptions {
  /** 局部极值窗口:点左右各 N 根 */
  window: number;
  /** 候选点后 MACD 死叉/金叉确认根数 */
  confirmBars: number;
  /** 相邻顶底最小摆动幅度(%) */
  minSwingPct: number;
  /** 最小摆动至少 N 个报价单位(0.001 元);日K传 0 */
  minTicks: number;
  /** 相邻顶底最小间隔(根) */
  minGap: number;
  /** 强反转豁免间隔限制的摆动倍数 */
  strongSwingMult: number;
  /** 是否撤销被后续行情突破的转折;日K历史回看不做 */
  invalidate: boolean;
}

/** 分时顶底(ZigZag 摆动结构)参数 */
interface ZigZagOptions {
  /** 摆动阈值下限(%) */
  minSwingPct: number;
  /** 摆动阈值上限(%) */
  maxSwingPct: number;
  /** 自适应系数:阈值 = 当日振幅 × rangeRatio */
  rangeRatio: number;
  /** 最小摆动至少 N 个报价单位(0.001 元) */
  minTicks: number;
  /** 相邻顶底最小间隔(分钟) */
  minGap: number;
  /** 强反转豁免间隔限制的摆动倍数 */
  strongSwingMult: number;
  /** 单日最多保留的信号数 */
  maxCount: number;
}

/** 分时(分钟级)参数:阈值随当日振幅在 0.5%~1.2% 之间浮动 */
const MINUTE_ZIGZAG_OPTIONS: ZigZagOptions = {
  minSwingPct: TREND_PEAK_MIN_SWING,
  maxSwingPct: TREND_PEAK_MAX_SWING,
  rangeRatio: TREND_PEAK_RANGE_RATIO,
  minTicks: TREND_PEAK_MIN_TICKS,
  minGap: TREND_PEAK_MIN_GAP,
  strongSwingMult: TREND_PEAK_STRONG_SWING_MULT,
  maxCount: TREND_PEAK_MAX_COUNT,
};

/** 日K参数:窗口/间隔按交易日,摆动 2% 起步;关闭失效过滤以保留历史波段 */
const DAILY_PEAK_OPTIONS: PeakOptions = {
  window: DAILY_PEAK_WINDOW,
  confirmBars: DAILY_PEAK_CONFIRM_BARS,
  minSwingPct: DAILY_PEAK_MIN_SWING,
  minTicks: 0,
  minGap: DAILY_PEAK_MIN_GAP,
  strongSwingMult: TREND_PEAK_STRONG_SWING_MULT,
  invalidate: false,
};

/** 最小有效摆动幅度(小数):同时满足百分比阈值与「N 个报价单位」下限 */
function minSwingRatio(price: number, opt: PeakOptions): number {
  const tickPct =
    opt.minTicks > 0 ? ((opt.minTicks * 0.001) / price) * 100 : 0;
  return Math.max(opt.minSwingPct, tickPct) / 100;
}

/** 顶底信号 -> 图表标记(顶=绿色下箭头、底=红色上箭头,与买卖点同一套 A 股配色)。
 *  withPrice = false 时只显示「顶/底」,用于空间较小的九日窗口,避免文字相互重叠 */
function toPeakMarkers(
  list: TrendPeak[],
  withPrice = true
): SeriesMarker<Time>[] {
  return list.map((s) => ({
    time: s.ts as UTCTimestamp,
    position: s.kind === "top" ? "aboveBar" : "belowBar",
    color: s.kind === "top" ? DOWN_COLOR : UP_COLOR,
    shape: s.kind === "top" ? "arrowDown" : "arrowUp",
    text: withPrice
      ? `${s.kind === "top" ? "顶" : "底"} ${s.price.toFixed(3)}`
      : s.kind === "top"
        ? "顶"
        : "底",
    size: 1,
  }));
}

/** 当前分时顶底信号(时间升序,图上标记与头部列表共用) */
const trendPeaks = ref<TrendPeak[]>([]);
/** 日K顶底信号(仅日K周期计算,与买卖点一起挂在主图 series 上) */
const dailyPeaks = ref<TrendPeak[]>([]);
/** 日K顶底判定方式:ma = 均线方向拐点,price = 局部极值 + MACD */
const dailyPeakMode = ref<"ma" | "price">("price");
/** 头部列表:最近的 N 条,最新在前 */
const recentPeaks = computed(() =>
  trendPeaks.value.slice(-TREND_PEAK_MAX_SHOW).reverse()
);

/**
 * 计算顶底(分时/日K共用,尺度由 opt 决定):
 * 1. 局部极值 —— 点左右各 opt.window 根内没有更高(顶)/更低(底)的价格;
 * 2. MACD 确认 —— 候选点后 opt.confirmBars 根内出现死叉(顶)/金叉(底),
 *    或 DIF 在局部窗口内处于高位且为正(顶)/低位且为负(底);
 * 3. 合并同类信号 —— 连续同类只保留价格更极端的一个(价格相等时取更晚的);
 *    摆动不足阈值的按横盘噪声丢弃;间隔不足 opt.minGap 时,
 *    只有摆动达到阈值的 opt.strongSwingMult 倍(强反转)才保留;
 * 4. 失效过滤(opt.invalidate)—— 顶之后创出明显更高价、底之后创出明显更低价时
 *    撤销该信号,避免把中继行情的小反弹误标成有效底(顶)。日K用于历史回看,关闭该步。
 * 需要右侧 N 根数据确认,因此最新几根不会立刻出信号,避免“未来函数”式误报。
 */
function calcTrendPeaks(points: PeakPoint[], opt: PeakOptions): TrendPeak[] {
  const n = points.length;
  const r = opt.window;
  if (n < r * 2 + 2) return [];
  const { dif, dea } = calcMACD(points.map((p) => p.price));
  const raw: TrendPeak[] = [];

  for (let i = r; i < n - r; i++) {
    const price = points[i].price;
    let isTop = true;
    let isBottom = true;
    for (let j = i - r; j <= i + r; j++) {
      if (j === i) continue;
      const v = points[j].price;
      if (v > price) isTop = false;
      if (v < price) isBottom = false;
    }
    if (!isTop && !isBottom) continue;

    // DIF 是否在局部窗口内处于同向极值
    let difIsHigh = true;
    let difIsLow = true;
    for (let j = i - r; j <= i + r; j++) {
      if (dif[j] > dif[i]) difIsHigh = false;
      if (dif[j] < dif[i]) difIsLow = false;
    }
    // 候选点之后是否出现死叉/金叉
    let crossDown = false;
    let crossUp = false;
    for (let j = i; j < Math.min(n - 1, i + opt.confirmBars); j++) {
      if (dif[j] >= dea[j] && dif[j + 1] < dea[j + 1]) crossDown = true;
      if (dif[j] <= dea[j] && dif[j + 1] > dea[j + 1]) crossUp = true;
    }

    if (isTop && (crossDown || (dif[i] > 0 && difIsHigh))) {
      raw.push({
        kind: "top",
        index: i,
        ts: points[i].ts,
        time: points[i].time,
        price,
      });
    } else if (isBottom && (crossUp || (dif[i] < 0 && difIsLow))) {
      raw.push({
        kind: "bottom",
        index: i,
        ts: points[i].ts,
        time: points[i].time,
        price,
      });
    }
  }

  // 连续同类信号合并:顶取更高价、底取更低价;价格相等时保留更晚出现的。
  // 异类顶底之间摆动不足阈值的,视为横盘噪声直接丢弃。
  const merged: TrendPeak[] = [];
  for (const sig of raw) {
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push(sig);
      continue;
    }
    if (prev.kind === sig.kind) {
      const better =
        sig.kind === "top" ? sig.price >= prev.price : sig.price <= prev.price;
      if (better) merged[merged.length - 1] = sig;
      continue;
    }
    // 摆动不足阈值视为横盘噪声
    const swing = Math.abs(sig.price - prev.price) / prev.price;
    const minSwing = minSwingRatio(prev.price, opt);
    if (swing < minSwing) continue;
    // 间隔过近时,只有摆动明显超过阈值(强反转)才保留;
    // 否则会误杀「假底后 1~2 分钟内的真顶」这类强反转
    if (
      sig.index - prev.index < opt.minGap &&
      swing < minSwing * opt.strongSwingMult
    ) {
      continue;
    }
    merged.push(sig);
  }

  // 日K历史回看不做失效过滤,保留已形成的历史波段
  if (!opt.invalidate) return merged;

  // 失效过滤:顶之后出现明显更高价、底之后出现明显更低价,说明该转折已被突破,
  // 不再作为有效顶底展示(例如下跌中继的小反弹低点,随后又被跌破)
  const valid = merged.filter((sig) => {
    const move = minSwingRatio(sig.price, opt);
    for (let j = sig.index + 1; j < n; j++) {
      const price = points[j].price;
      if (
        sig.kind === "top"
          ? price >= sig.price * (1 + move)
          : price <= sig.price * (1 - move)
      ) {
        return false;
      }
    }
    return true;
  });

  // 失效过滤后可能产生相邻同类,再合并一次
  const result: TrendPeak[] = [];
  for (const sig of valid) {
    const prev = result[result.length - 1];
    if (prev && prev.kind === sig.kind) {
      const better =
        sig.kind === "top" ? sig.price >= prev.price : sig.price <= prev.price;
      if (better) result[result.length - 1] = sig;
    } else {
      result.push(sig);
    }
  }
  return result;
}

/**
 * 分时顶底(ZigZag 摆动结构):
 * 1. 自适应摆动阈值 —— 当日振幅 × rangeRatio,夹在 [minSwingPct, maxSwingPct],
 *    且不少于 minTicks 个报价单位;波动大的日子自动提高门槛,横盘日退回下限。
 * 2. 上升段持续跟踪最高价,从最高点回落达到阈值即确认顶;下降段对称确认底。
 *    标记位置就是被反向摆动确认的真实极值,不再依赖局部窗口 + MACD 交叉,
 *    既不会因 MACD 滞后漏掉当日最高/最低,也不会出现「只低一个 tick 的新低
 *    无法让前一个假底失效」导致标记停在旧位置的问题。
 * 3. 收盘后补上最后一个尚未被反向摆动确认的极值(右侧已回撤/反弹到阈值一半);
 *    盘中不输出,避免用没走完的行情猜顶底。
 * 4. 间隔过近且摆动未达强反转倍数时丢弃;超过 maxCount 时按摆动突出度
 *    反复删除最不显著的点,保证图上只留主波段。
 */
function calcZigZagPeaks(
  points: PeakPoint[],
  preClose: number,
  opt: ZigZagOptions
): TrendPeak[] {
  const n = points.length;
  if (n < 3) return [];

  // 以昨收为基准计算当日振幅,避免开盘跳空抬高百分比
  let hi = -Infinity;
  let lo = Infinity;
  for (const p of points) {
    if (p.price > hi) hi = p.price;
    if (p.price < lo) lo = p.price;
  }
  const base = preClose > 0 ? preClose : points[0].price;
  const rangePct = base > 0 ? ((hi - lo) / base) * 100 : 0;
  const swingPct = Math.min(
    opt.maxSwingPct,
    Math.max(opt.minSwingPct, rangePct * opt.rangeRatio)
  );
  /** 指定价格下的最小有效摆动比例(百分比换算为小数) */
  const swingOf = (price: number) =>
    Math.max(swingPct / 100, (opt.minTicks * 0.001) / price);

  const raw: TrendPeak[] = [];
  /**
   * 记录一条信号:index 是极值所在下标,confirmIndex 是**确认它**的那一根
   * (反向摆动达到阈值的那一刻)。两者可能相差好几分钟,
   * 「最近 N 分钟内出现的信号」必须按 confirmTs 判断,否则刚出的信号会被当成旧信号。
   */
  const addSignal = (
    kind: "top" | "bottom",
    index: number,
    confirmIndex: number
  ) => {
    const confirm = points[Math.min(Math.max(confirmIndex, 0), n - 1)];
    raw.push({
      kind,
      index,
      ts: points[index].ts,
      time: points[index].time,
      price: points[index].price,
      confirmTs: confirm.ts,
      confirmTime: confirm.time,
    });
  };

  // dir:0 = 开盘后方向未定,1 = 上升段找顶,-1 = 下降段找底
  let dir: 0 | 1 | -1 = 0;
  let pivotIdx = 0;
  let pivotPrice = points[0].price;
  let hiIdx = 0;
  let hiPrice = pivotPrice;
  let loIdx = 0;
  let loPrice = pivotPrice;

  for (let i = 1; i < n; i++) {
    const price = points[i].price;
    if (dir === 0) {
      if (price >= hiPrice) {
        hiPrice = price;
        hiIdx = i;
      }
      if (price <= loPrice) {
        loPrice = price;
        loIdx = i;
      }
      // 从区间高点回落 / 从低点反弹达到阈值,确认开盘后的第一个极值
      if (price <= hiPrice * (1 - swingOf(hiPrice))) {
        addSignal("top", hiIdx, i);
        dir = -1;
        pivotIdx = i;
        pivotPrice = price;
        loIdx = i;
        loPrice = price;
      } else if (price >= loPrice * (1 + swingOf(loPrice))) {
        addSignal("bottom", loIdx, i);
        dir = 1;
        pivotIdx = i;
        pivotPrice = price;
        hiIdx = i;
        hiPrice = price;
      }
      continue;
    }
    if (dir === 1) {
      if (price >= pivotPrice) {
        pivotPrice = price;
        pivotIdx = i;
      } else if (price <= pivotPrice * (1 - swingOf(pivotPrice))) {
        addSignal("top", pivotIdx, i);
        dir = -1;
        pivotIdx = i;
        pivotPrice = price;
      }
    } else {
      if (price <= pivotPrice) {
        pivotPrice = price;
        pivotIdx = i;
      } else if (price >= pivotPrice * (1 + swingOf(pivotPrice))) {
        addSignal("bottom", pivotIdx, i);
        dir = 1;
        pivotIdx = i;
        pivotPrice = price;
      }
    }
  }

  // 收盘后补最后一个未确认极值:右侧已回撤/反弹到阈值一半,视为当日最终顶/底
  const lastPoint = points[n - 1];
  const closed = lastPoint.time >= "15:00";
  if (closed && dir !== 0 && pivotIdx < n - 1) {
    const retrace = Math.abs(lastPoint.price - pivotPrice) / pivotPrice;
    if (retrace >= swingOf(pivotPrice) * 0.5) {
      addSignal(dir === 1 ? "top" : "bottom", pivotIdx, n - 1);
    }
  }

  /** 合并相邻同类信号:顶取更高价、底取更低价 */
  const mergeSame = (list: TrendPeak[]): TrendPeak[] => {
    const out: TrendPeak[] = [];
    for (const sig of list) {
      const prev = out[out.length - 1];
      if (prev && prev.kind === sig.kind) {
        const better =
          sig.kind === "top" ? sig.price >= prev.price : sig.price <= prev.price;
        if (better) out[out.length - 1] = sig;
      } else {
        out.push(sig);
      }
    }
    return out;
  };

  // 间隔过滤:过近的转折只有摆动明显超过阈值(强反转)才保留
  const merged: TrendPeak[] = [];
  for (const sig of raw) {
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push(sig);
      continue;
    }
    if (prev.kind === sig.kind) {
      const better =
        sig.kind === "top" ? sig.price >= prev.price : sig.price <= prev.price;
      if (better) merged[merged.length - 1] = sig;
      continue;
    }
    const swing = Math.abs(sig.price - prev.price) / prev.price;
    const minSwing = swingOf(prev.price);
    if (
      sig.index - prev.index < opt.minGap &&
      swing < minSwing * opt.strongSwingMult
    ) {
      continue;
    }
    merged.push(sig);
  }

  // 超过展示上限时,反复删除「突出度」最小的转折(与前后相邻转折的较小摆动距离)
  let result = mergeSame(merged);
  while (result.length > opt.maxCount) {
    let worst = 0;
    let worstProm = Infinity;
    for (let k = 0; k < result.length; k++) {
      let prom = Infinity;
      if (k > 0) {
        prom = Math.min(prom, Math.abs(result[k - 1].price - result[k].price));
      }
      if (k < result.length - 1) {
        prom = Math.min(prom, Math.abs(result[k + 1].price - result[k].price));
      }
      if (prom < worstProm) {
        worstProm = prom;
        worst = k;
      }
    }
    result.splice(worst, 1);
    result = mergeSame(result);
  }
  return result;
}

/**
 * 均线方向拐点顶底(日K):
 * 1. 计算 MA(period);
 * 2. 均线在 [i-confirm, i+confirm] 内为局部最大 → 顶、局部最小 → 底,
 *    均线走平时连续多天满足条件,只保留第一次出现的位置;
 * 3. 标记位置回溯到相邻拐点之间的收盘价最高/最低点,避免均线滞后导致标记偏离价格极值;
 * 4. 相邻信号间隔不足 minGap 个交易日时丢弃,并合并过滤后产生的相邻同类。
 */
function calcMaPeaks(
  bars: StockBar[],
  period: number,
  confirm: number,
  minGap: number
): TrendPeak[] {
  const n = bars.length;
  if (n < period + confirm * 2 + 1) return [];
  const closes = bars.map((b) => b.close);
  const ma = calcMA(closes, period);
  const turns: { kind: "top" | "bottom"; index: number }[] = [];

  for (let i = period - 1 + confirm; i < n - confirm; i++) {
    const cur = ma[i];
    if (cur === undefined) continue;
    let isMax = true;
    let isMin = true;
    let strictMax = false;
    let strictMin = false;
    for (let j = i - confirm; j <= i + confirm; j++) {
      if (j < period - 1 || ma[j] === undefined) continue;
      const v = ma[j] as number;
      if (v > cur) {
        isMax = false;
        strictMin = true;
      }
      if (v < cur) {
        isMin = false;
        strictMax = true;
      }
    }
    const kind =
      isMax && strictMax ? "top" : isMin && strictMin ? "bottom" : null;
    if (!kind) continue;
    // 均线走平时会连续多天满足极值条件,只保留第一次出现的位置
    if (turns.at(-1)?.kind === kind) continue;
    turns.push({ kind, index: i });
  }

  const picked: TrendPeak[] = [];
  let prevTurn = period - 1;
  for (const t of turns) {
    // 回溯到本段内的价格极值作为标记位置
    let best = Math.max(prevTurn, 0);
    for (let j = best; j <= t.index; j++) {
      if (
        t.kind === "top"
          ? closes[j] >= closes[best]
          : closes[j] <= closes[best]
      ) {
        best = j;
      }
    }
    const last = picked.at(-1);
    if (!last || best - last.index >= minGap) {
      picked.push({
        kind: t.kind,
        index: best,
        ts: 0,
        time: bars[best].date,
        price: closes[best],
      });
    }
    prevTurn = t.index;
  }

  // 间隔过滤后可能出现相邻同类,保留更极端的一个
  const merged: TrendPeak[] = [];
  for (const sig of picked) {
    const last = merged.at(-1);
    if (last && last.kind === sig.kind) {
      const better =
        sig.kind === "top" ? sig.price >= last.price : sig.price <= last.price;
      if (better) merged[merged.length - 1] = sig;
    } else {
      merged.push(sig);
    }
  }
  return merged;
}

/** 按当前顶底模式计算日K顶底(仅日K周期有结果) */
function calcDailyPeaks(): TrendPeak[] {
  if (frequency.value !== "d") return [];
  return dailyPeakMode.value === "ma"
    ? calcMaPeaks(
        bars.value,
        DAILY_MA_PEAK_PERIOD,
        DAILY_MA_PEAK_CONFIRM,
        DAILY_MA_PEAK_MIN_GAP
      )
    : calcTrendPeaks(
        bars.value.map((b) => ({ time: b.date, price: b.close, ts: 0 })),
        DAILY_PEAK_OPTIONS
      );
}

// ---------- 左侧自选的「观望 / 持有」标签 ----------

/** 各只自选的日K数据缓存(代码 -> 日K);只用于算左侧标签,与当前图表数据相互独立 */
const sideBars = ref<Record<string, StockBar[]>>({});
/** 加载中的守卫,避免自选列表连续变化时重复请求同一批数据 */
let sideBarsLoading = false;

/** 为还没有缓存的股票补拉日K(新增自定义自选时也会调用) */
async function loadSideBars() {
  if (sideBarsLoading) return;
  const missing = stockList.value.filter((s) => !sideBars.value[s.code]);
  if (missing.length === 0) return;
  sideBarsLoading = true;
  try {
    const settled = await Promise.allSettled(
      missing.map((s) => fetchBars(s.code, "d"))
    );
    const next = { ...sideBars.value };
    settled.forEach((r, i) => {
      if (r.status === "fulfilled") next[missing[i].code] = r.value;
    });
    sideBars.value = next;
  } finally {
    sideBarsLoading = false;
  }
  // 加载期间又新增了自选时再补一轮
  if (stockList.value.some((s) => !sideBars.value[s.code])) void loadSideBars();
}

/** 左侧标签日K的轮转刷新:每 SIDE_BARS_REFRESH_MS 补一只,避免盘中一整天停在开盘状态 */
const SIDE_BARS_REFRESH_MS = 3 * 60 * 1000;
let sideBarsCursor = 0;
let sideBarsRefreshAt = 0;
let sideBarsRefreshing = false;

async function refreshSideBarsIfDue() {
  if (sideBarsRefreshing || Date.now() < sideBarsRefreshAt) return;
  const list = stockList.value;
  if (list.length === 0) return;
  sideBarsRefreshAt = Date.now() + SIDE_BARS_REFRESH_MS;
  sideBarsRefreshing = true;
  const target = list[sideBarsCursor % list.length];
  sideBarsCursor++;
  try {
    const fresh = await fetchBars(target.code, "d");
    sideBars.value = { ...sideBars.value, [target.code]: fresh };
  } catch {
    // 静默失败:下一轮再试别的股票
  } finally {
    sideBarsRefreshing = false;
  }
}

/**
 * 左侧标签:每只股票最近一个日K顶底信号 —— 顶 = 观望、底 = 持有。
 * 跟随工具栏的日K顶底标准(价格顶底 / 均线顶底),切换标准时无需重新请求。
 */
const sideTags = computed<
  Record<string, { text: string; kind: "top" | "bottom" }>
>(() => {
  const out: Record<string, { text: string; kind: "top" | "bottom" }> = {};
  for (const [code, bars] of Object.entries(sideBars.value)) {
    const list =
      dailyPeakMode.value === "ma"
        ? calcMaPeaks(
            bars,
            DAILY_MA_PEAK_PERIOD,
            DAILY_MA_PEAK_CONFIRM,
            DAILY_MA_PEAK_MIN_GAP
          )
        : calcTrendPeaks(
            bars.map((b) => ({ time: b.date, price: b.close, ts: 0 })),
            DAILY_PEAK_OPTIONS
          );
    const last = list.at(-1);
    if (last) {
      out[code] = {
        text: last.kind === "top" ? "观望" : "持有",
        kind: last.kind,
      };
    }
  }
  return out;
});

/** 多股窗口头部报价(代码 -> 现价/涨跌幅,红涨绿跌) */
const multiQuotes = computed(() => {
  const out: Record<string, { last: string; chg: string; up: boolean }> = {};
  for (const s of stockList.value) {
    const d = multiTrend.value[s.code];
    const p = d?.points.at(-1);
    // 现价优先用实时报价(轻量轮询每 5 秒刷一批),分钟线一分钟才重拉一次
    const live = multiLive.value[s.code];
    const price = live?.price ?? p?.price;
    if (price === undefined) {
      out[s.code] = { last: "--", chg: "--", up: true };
      continue;
    }
    const pre = live?.preClose ?? d?.preClose ?? 0;
    // 昨收未知时仍显示现价,只是涨跌幅按 0 处理
    const pct = pre > 0 ? ((price - pre) / pre) * 100 : 0;
    out[s.code] = {
      last: price.toFixed(3),
      chg: `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`,
      up: pct >= 0,
    };
  }
  return out;
});

// ---------- 迷你分时窗口(多股 / 近九日共用) ----------

interface MiniChartEntry {
  chart: IChartApi;
  priceSeries: ISeriesApi<"Line">;
  avgSeries: ISeriesApi<"Line">;
  /** 九日窗口才有量柱与 MACD;多股窗口为 null */
  volumeSeries: ISeriesApi<"Histogram"> | null;
  macdDifSeries: ISeriesApi<"Line"> | null;
  macdDeaSeries: ISeriesApi<"Line"> | null;
  macdHistSeries: ISeriesApi<"Histogram"> | null;
  preCloseLine: IPriceLine | null;
}

/**
 * 创建一个迷你分时窗口:现价/均价双线 + 昨收基准线。
 * withVolume = true 时在下方再加量柱区与 MACD 副图(九日视图),价格区相应收紧。
 */
function createMiniTrendChart(
  el: HTMLElement,
  withVolume = false
): MiniChartEntry {
  const c = createChart(el, {
    // autoSize 让库自管 ResizeObserver,v-show 显隐时自动跟随尺寸
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: "#606266",
    },
    grid: {
      vertLines: { color: "rgba(0,0,0,0.05)" },
      horzLines: { color: "rgba(0,0,0,0.3)" },
    },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: { borderColor: "#dcdfe6" },
    timeScale: { borderColor: "#dcdfe6", tickMarkFormatter: formatTickMark },
    localization: { timeFormatter: formatCrosshairTime },
  });
  // 均价线先建、现价线后建,保证现价线绘制在上层
  const avgSeries = c.addLineSeries({
    color: TREND_AVG_COLOR,
    lineWidth: 1,
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
    priceFormat: { type: "price", precision: 3, minMove: 0.001 },
  });
  const priceSeries = c.addLineSeries({
    color: TREND_PRICE_COLOR,
    lineWidth: 2,
    lastValueVisible: true,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
    priceFormat: { type: "price", precision: 3, minMove: 0.0001 },
  });
  let volumeSeries: ISeriesApi<"Histogram"> | null = null;
  let macdDifSeries: ISeriesApi<"Line"> | null = null;
  let macdDeaSeries: ISeriesApi<"Line"> | null = null;
  let macdHistSeries: ISeriesApi<"Histogram"> | null = null;
  // 迷你分时窗为只读视图:关闭滚轮缩放、拖拽平移与坐标轴拉伸,
  // 时间轴恒为整日(由 pinTrendAxis 钉死),只保留十字光标读数
  c.applyOptions({ handleScroll: false, handleScale: false });
  if (withVolume) {
    // 量柱挂独立 priceScale,通过 margins 在底部划出量能区
    volumeSeries = c.addHistogramSeries({
      priceScaleId: "volume",
      priceFormat: { type: "volume" },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    // MACD 副图:DIF/DEA 双线 + 红绿柱 + 零轴
    const macdPriceFormat = {
      type: "price" as const,
      precision: 3,
      minMove: 0.001,
    };
    macdDifSeries = c.addLineSeries({
      priceScaleId: "macd",
      color: "#f0a020",
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      priceFormat: macdPriceFormat,
    });
    macdDeaSeries = c.addLineSeries({
      priceScaleId: "macd",
      color: "#5470c6",
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      priceFormat: macdPriceFormat,
    });
    macdHistSeries = c.addHistogramSeries({
      priceScaleId: "macd",
      lastValueVisible: false,
      priceLineVisible: false,
      priceFormat: macdPriceFormat,
    });
    macdHistSeries.createPriceLine({
      price: 0,
      color: "#c0c4cc",
      lineStyle: LineStyle.Dashed,
      lineWidth: 1,
      axisLabelVisible: false,
    });
    c.priceScale("right").applyOptions({
      scaleMargins: MINI_TREND_MAIN_MARGINS,
    });
    c.priceScale("volume").applyOptions({
      scaleMargins: MINI_TREND_VOLUME_MARGINS,
    });
    c.priceScale("macd").applyOptions({
      scaleMargins: MINI_TREND_MACD_MARGINS,
    });
  } else {
    // 多股小窗整块都是主图区:上下留出余量,当日最高/最低处的顶底标记不会被裁切
    c.priceScale("right").applyOptions({
      scaleMargins: MINI_TREND_PRICE_MARGINS,
    });
  }
  return {
    chart: c,
    priceSeries,
    avgSeries,
    volumeSeries,
    macdDifSeries,
    macdDeaSeries,
    macdHistSeries,
    preCloseLine: null,
  };
}

// ---------- 多股分时窗口(每只自选一个独立 chart,两列网格同屏) ----------

/** 多股窗口 canvas 容器(代码 -> DOM,函数式 ref 收集) */
const multiCanvasEls = new Map<string, HTMLElement>();

/** 函数式 ref:收集/清理各窗口容器(multi-grid 用 v-show,卸载时 el 为 null) */
function setMultiCanvasEl(code: string) {
  return (el: unknown) => {
    if (el) multiCanvasEls.set(code, el as HTMLElement);
    else multiCanvasEls.delete(code);
  };
}

/** 已创建的多股分时窗口(代码 -> chart 与其 series) */
let multiCharts: Record<string, MiniChartEntry> = {};

/**
 * 统一的时间轴刻度格式化。
 * 分时模式:伪时间戳经 trendAxisLabels 映射回真实 "HH:mm"(压缩时间轴,午休不留空档,
 * 且整日槽位都登记在表里,盘中未走到的空白分钟也能给出正确刻度);
 * K线模式:originalTime 本就是 "YYYY-MM-DD" 字符串,按 tickMarkType 输出 年/月/日,
 * 复刻库默认观感 —— lightweight-charts 的 applyOptions 无法把 formatter 重置回 undefined
 * (merge 跳过 undefined),故创建时一次性设置 dispatcher。
 */
function formatTickMark(time: Time, tickMarkType: TickMarkType): string {
  // 分时:整日槽位都在标签表里(含尚未走到的空白分钟),刻度统一显示 "HH:mm"
  const label = typeof time === "number" ? trendAxisLabels.get(time) : undefined;
  if (label) return label;
  if (typeof time !== "string") return String(time);
  const [, m, d] = time.split("-");
  if (tickMarkType === TickMarkType.Year) return time.slice(0, 4);
  if (tickMarkType === TickMarkType.Month) return `${+m}月`;
  return `${+d}日`;
}

/** 十字光标底部标签:分时显示真实 "HH:mm",K线显示原日期字符串 */
function formatCrosshairTime(time: Time): string {
  const label =
    typeof time === "number" ? trendAxisLabels.get(time) : undefined;
  if (label) return label;
  return typeof time === "string" ? time : String(time);
}

function createChartInstance() {
  if (!chartRef.value) return;
  chart = createChart(chartRef.value, {
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: "#606266",
    },
    grid: {
      vertLines: { color: "rgba(0,0,0,0.05)" },
      horzLines: { color: "rgba(0,0,0,0.05)" },
    },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: { borderColor: "#dcdfe6" },
    timeScale: { borderColor: "#dcdfe6", tickMarkFormatter: formatTickMark },
    localization: { timeFormatter: formatCrosshairTime },
    autoSize: false,
  });

  // 成交量副图
  volumeSeries = chart.addHistogramSeries({
    priceFormat: { type: "volume" },
    priceScaleId: "volume",
    lastValueVisible: false,
    priceLineVisible: false,
  });
  // 均量线,与成交量柱同尺度
  volMaSeries = VOL_MA_CONFIG.map((cfg) =>
    chart!.addLineSeries({
      priceScaleId: "volume",
      color: cfg.color,
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      priceFormat: { type: "volume" },
    })
  );
  chart.priceScale("volume").applyOptions({
    scaleMargins: VOLUME_MARGINS,
  });

  // MACD 副图:DIF/DEA 两条线 + 红绿柱
  const macdPriceFormat = { type: "price" as const, precision: 3, minMove: 0.001 };
  macdDifSeries = chart.addLineSeries({
    priceScaleId: "macd",
    color: "#f0a020",
    lineWidth: 1,
    lastValueVisible: false,
    priceLineVisible: false,
    priceFormat: macdPriceFormat,
  });
  macdDeaSeries = chart.addLineSeries({
    priceScaleId: "macd",
    color: "#5470c6",
    lineWidth: 1,
    lastValueVisible: false,
    priceLineVisible: false,
    priceFormat: macdPriceFormat,
  });
  macdHistSeries = chart.addHistogramSeries({
    priceScaleId: "macd",
    lastValueVisible: false,
    priceLineVisible: false,
    priceFormat: macdPriceFormat,
  });
  macdHistSeries.createPriceLine({
    price: 0,
    color: "#c0c4cc",
    lineStyle: LineStyle.Dashed,
    lineWidth: 1,
    axisLabelVisible: false,
  });
  chart.priceScale("macd").applyOptions({
    scaleMargins: MACD_MARGINS,
  });

  mainSeries = chart.addCandlestickSeries({
    upColor: UP_COLOR,
    downColor: DOWN_COLOR,
    wickUpColor: UP_COLOR,
    wickDownColor: DOWN_COLOR,
    borderVisible: false,
    priceFormat: { type: "price", precision: 3, minMove: 0.001 }, // 3位小数,最小移动量 0.001
  });
  // 主图区域限制在上半部分,避免与成交量和 MACD 副图重叠
  mainSeries.priceScale().applyOptions({ scaleMargins: MAIN_MARGINS });

  // 主图均线:在主图 series 之后创建,保证绘制层级位于 K 线之上
  const chartInstance = chart; // 局部常量,闭包内 TS 不丢失非空收窄
  const createMaSeries = (color: string) =>
    chartInstance.addLineSeries({
      color,
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      priceFormat: { type: "price", precision: 3, minMove: 0.001 },
    });
  maSeries = MA_CONFIG.map((cfg) => createMaSeries(cfg.color));

  // 分时双线:均价线(黄)先建、现价线(蓝)后建,保证现价线绘制在上层;
  // 挂主图默认坐标系,K线模式下 setData([]) 隐藏即可
  trendAvgSeries = chart.addLineSeries({
    color: TREND_AVG_COLOR,
    lineWidth: 1,
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
    priceFormat: { type: "price", precision: 3, minMove: 0.001 },
  });
  trendPriceSeries = chart.addLineSeries({
    color: TREND_PRICE_COLOR,
    lineWidth: 2,
    lastValueVisible: true,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
    priceFormat: { type: "price", precision: 3, minMove: 0.001 },
  });

  // 十字光标联动:悬停时显示对应位置的 MA 数值,移出后回到最新一根;
  // 分时模式下经伪时间戳反查真实分钟点,更新分时图例
  chart.subscribeCrosshairMove((param) => {
    if (isTrend.value) {
      const ts = param.time ? (param.time as number) : undefined;
      updateTrendLegend(ts !== undefined ? trendPointMap.get(ts) : undefined);
      return;
    }
    if (!param.time) {
      updateMaLegend();
      return;
    }
    const idx = bars.value.findIndex((b) => b.date === param.time);
    updateMaLegend(idx >= 0 ? idx : undefined);
  });

  resizeObserver = new ResizeObserver(() => {
    if (!chart || !chartRef.value) return;
    chart.applyOptions({
      width: chartRef.value.clientWidth,
      height: chartRef.value.clientHeight,
    });
  });
  resizeObserver.observe(chartRef.value);
}

/** 按当前图表类型重建主图 series(K线 / 走势线);分时类视图下无主图 series,跳过 */
function rebuildMainSeries() {
  if (!chart || isIntraday.value) return;
  if (mainSeries) chart.removeSeries(mainSeries);
  mainSeries =
    chartType.value === "candle"
      ? chart.addCandlestickSeries({
          upColor: UP_COLOR,
          downColor: DOWN_COLOR,
          wickUpColor: UP_COLOR,
          wickDownColor: DOWN_COLOR,
          borderVisible: false,
          priceFormat: { type: "price", precision: 3, minMove: 0.001 },
        })
      : chart.addLineSeries({
          color: "#409eff",
          lineWidth: 2,
          priceFormat: { type: "price", precision: 3, minMove: 0.001 },
        });
  mainSeries?.priceScale().applyOptions({ scaleMargins: MAIN_MARGINS });
  // 重建均线,保证其绘制层级仍在新的主图 series 之上
  maSeries.forEach((s) => chart!.removeSeries(s));
  maSeries = MA_CONFIG.map((cfg) =>
    chart!.addLineSeries({
      color: cfg.color,
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      priceFormat: { type: "price", precision: 3, minMove: 0.001 },
    })
  );
  renderSeries();
}

/** 把 bars 填充进图表(主图 + 成交量副图 + MACD 副图) */
function renderSeries() {
  if (!mainSeries || !volumeSeries || !macdHistSeries) return;
  // K 线视图恢复交互:分时是只读展示,切回 K 线要能拖动/缩放查看历史;
  // fixRightEdge:最新一根(当前时间)之后不能再往右滚到空白未来;
  // rightBarStaysOnScroll:缩放时保持右侧偏移不变 —— 当前时间那根始终贴在右端,不会被缩走
  chart?.applyOptions({
    handleScroll: true,
    handleScale: true,
    timeScale: {
      fixRightEdge: true,
      rightOffset: 0,
      rightBarStaysOnScroll: true,
    },
  });
  mainSeries.setData(
    bars.value.map((b) =>
      chartType.value === "candle"
        ? ({
            time: b.date,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
          } satisfies CandlestickData<Time>)
        : ({ time: b.date, value: b.close } satisfies LineData<Time>)
    )
  );
  volumeSeries.setData(
    bars.value.map(
      (b) =>
        ({
          time: b.date,
          value: b.volume,
          color: b.close >= b.open ? upBar : downBar,
        }) satisfies HistogramData<Time>
    )
  );
  // 均量线:数据不足周期的前置点用 whitespace 占位(不绘制)
  const volumes = bars.value.map((b) => b.volume);
  volMaSeries.forEach((s, si) => {
    const ma = calcMA(volumes, VOL_MA_CONFIG[si].period);
    s.setData(
      bars.value.map((b, bi) =>
        ma[bi] === undefined
          ? { time: b.date }
          : { time: b.date, value: ma[bi] as number }
      )
    );
  });
  // MACD 副图:DIF/DEA 线 + 红绿柱(柱色跟随涨跌)
  const { dif, dea, macd } = calcMACD(bars.value.map((b) => b.close));
  macdDifSeries?.setData(
    bars.value.map((b, i) => ({ time: b.date, value: dif[i] }))
  );
  macdDeaSeries?.setData(
    bars.value.map((b, i) => ({ time: b.date, value: dea[i] }))
  );
  macdHistSeries.setData(
    bars.value.map((b, i) => ({
      time: b.date,
      value: macd[i],
      color: macd[i] >= 0 ? upBar : downBar,
    }))
  );
  // 主图均线:数据不足周期数的前置点用 whitespace 占位(不绘制)
  const closes = bars.value.map((b) => b.close);
  maCache = MA_CONFIG.map((cfg) => calcMA(closes, cfg.period));
  maSeries.forEach((s, mi) => {
    s.setData(
      bars.value.map((b, i) =>
        maCache[mi][i] === undefined
          ? { time: b.date }
          : { time: b.date, value: maCache[mi][i] as number }
      )
    );
  });
  // 数据一次拉足,默认只展示最近 VISIBLE_BARS 根,更早的历史靠左滑查看;
  // 视窗右端停在最新一根(fixRightEdge 已锁右边界,不会再出现空白未来)
  const total = bars.value.length;
  if (total > VISIBLE_BARS) {
    chart?.timeScale().setVisibleLogicalRange({
      from: total - VISIBLE_BARS,
      to: total - 1,
    });
  } else {
    chart?.timeScale().fitContent();
  }
  updateMaLegend();
  // K线模式恢复三区布局,并清掉分时残留(双线、昨收基准线)
  chart?.priceScale("right").applyOptions({ scaleMargins: MAIN_MARGINS });
  volumeSeries.priceScale().applyOptions({ scaleMargins: VOLUME_MARGINS });
  trendPriceSeries?.setData([]);
  trendPriceSeries?.setMarkers([]);
  trendAvgSeries?.setData([]);
  trendPeaks.value = [];
  if (preCloseLine) {
    trendPriceSeries?.removePriceLine(preCloseLine);
    preCloseLine = null;
  }
  // 日K顶底:均线方向拐点 / 局部极值+MACD,由工具栏切换
  dailyPeaks.value = calcDailyPeaks();
  // 重画成本线、买卖点与日K顶底(主图 series 重建后原有挂载失效)
  applyOverlays();
}

/** 把当日分时填充进图表:主图 = 现价线 + 均价线 + 昨收基准线,副图 = 分钟量柱 */
function renderTrendSeries() {
  if (!chart || !trendPriceSeries || !trendAvgSeries || !volumeSeries) return;
  // 分时是纯展示视图:关闭滚轮缩放、拖拽平移与坐标轴拉伸,
  // 时间轴恒为整日(见 pinTrendAxis),只保留十字光标读数;
  // fixRightEdge 要关掉,K 线锁右边界那套会让 15:00 之后的留白被夹没
  chart.applyOptions({
    handleScroll: false,
    handleScale: false,
    timeScale: { fixRightEdge: false },
  });
  // 移除 K 线主图 series(挂在其上的成本线一并销毁;applyOverlays 首行空检查天然防御)
  if (mainSeries) {
    chart.removeSeries(mainSeries);
    mainSeries = null;
    costLine = null;
  }
  // 隐藏 K 线专属内容(均线/均量线);MACD 副图共用,数据随分时重填
  maSeries.forEach((s) => s.setData([]));
  volMaSeries.forEach((s) => s.setData([]));

  const data = trend.value;
  if (!data || data.points.length === 0) {
    trendPriceSeries.setData([]);
    trendPriceSeries.setMarkers([]);
    trendAvgSeries.setData([]);
    volumeSeries.setData([]);
    macdDifSeries?.setData([]);
    macdDeaSeries?.setData([]);
    macdHistSeries?.setData([]);
    trendPeaks.value = [];
    chart.timeScale().fitContent();
    updateTrendLegend();
    return;
  }
  // X 轴恒定 09:30-15:00:早盘只有几十个点时也只占左侧一段,右侧留白到收盘;
  // 未走到的分钟用 whitespace 占位,刻度照样铺到 15:00
  const slots = trendDaySlots(data.points);
  registerTrendAxis(data.points, slots);
  trendPriceSeries.setData(
    fillTrendSlots(slots, data.points, (p) => ({ value: p.price }))
  );
  trendAvgSeries.setData(
    fillTrendSlots(slots, data.points, (p) => ({ value: p.avg }))
  );
  // 分钟量柱:色随现价相对前一分钟(首点相对昨收)的涨跌
  volumeSeries.setData(
    fillTrendSlots(slots, data.points, (p, i) => ({
      value: p.volume,
      color:
        p.price >= (i > 0 ? data.points[i - 1].price : data.preClose)
          ? upBar
          : downBar,
    }))
  );
  // 分时三区布局:主图 / 成交量 / 分时MACD(通过 priceScale 而非 series),fitContent 展示全天
  chart.priceScale("right").applyOptions({ scaleMargins: TREND_MAIN_MARGINS });
  volumeSeries.priceScale().applyOptions({ scaleMargins: TREND_VOLUME_MARGINS });
  chart.priceScale("macd").applyOptions({ scaleMargins: TREND_MACD_MARGINS });
  // 分时 MACD:基于每分钟价格序列计算(EMA12/26 + DEA9),与 K 线共用副图 series
  const { dif, dea, macd } = calcMACD(data.points.map((p) => p.price));
  macdDifSeries?.setData(
    fillTrendSlots(slots, data.points, (_p, i) => ({ value: dif[i] }))
  );
  macdDeaSeries?.setData(
    fillTrendSlots(slots, data.points, (_p, i) => ({ value: dea[i] }))
  );
  macdHistSeries?.setData(
    fillTrendSlots(slots, data.points, (_p, i) => ({
      value: macd[i],
      color: macd[i] >= 0 ? upBar : downBar,
    }))
  );
  // 昨收基准虚线:先移除旧线再挂新线;昨收未知(0)时不画,免得线落在坐标外
  if (preCloseLine) {
    trendPriceSeries.removePriceLine(preCloseLine);
    preCloseLine = null;
  }
  if (data.preClose > 0) {
    preCloseLine = trendPriceSeries.createPriceLine({
      price: data.preClose,
      color: "#909399",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: "昨收",
    });
  }
  // 顶底信号:自适应 ZigZag 摆动结构,图上标记与头部列表同步
  trendPeaks.value = calcZigZagPeaks(
    data.points,
    data.preClose,
    MINUTE_ZIGZAG_OPTIONS
  );
  trendPriceSeries.setMarkers(toPeakMarkers(trendPeaks.value));
  // X 轴钉死在 09:30-15:00 的整日槽位,不随已走到的分钟数收缩
  pinTrendAxis(chart, slots);
  updateTrendLegend();
}

/** 多股分时:为每只自选创建独立小窗(惰性) */
function ensureMultiCharts() {
  for (const s of stockList.value) {
    if (multiCharts[s.code]) continue;
    const el = multiCanvasEls.get(s.code);
    if (!el) continue;
    const mc = createMiniTrendChart(el);
    multiCharts[s.code] = mc;
  }
}

/** 多股窗口最近一条顶底信号(代码 -> 信号),显示在各自标题栏 */
const multiPeaks = ref<Record<string, TrendPeak>>({});

/**
 * 多股视图顶部的顶底汇总:只列最近 `MULTI_SIGNAL_WINDOW_MIN` 分钟内**出现**的信号,
 * 按自选顺序排列,文字格式「名称:顶/底 价格 时间」。
 * 时间口径:用 `confirmTs`(反向摆动确认的那一刻,也就是信号真正出现在图上的时间),
 * 而不是极值所在的分钟 —— ZigZag 往往要过几分钟才确认,按极值分钟过滤会把刚出的新信号漏掉。
 * 基准取该股最新一分钟(盘中即"现在",收盘后即尾盘)。
 */
const multiSignalList = computed(() => {
  const windowSec = MULTI_SIGNAL_WINDOW_MIN * 60;
  const out: {
    code: string;
    name: string;
    kind: "top" | "bottom";
    price: string;
    time: string;
    ageMin: string;
  }[] = [];
  for (const s of stockList.value) {
    const p = multiPeaks.value[s.code];
    if (!p) continue;
    const lastTs = multiTrend.value[s.code]?.points.at(-1)?.ts;
    const shownTs = p.confirmTs ?? p.ts;
    // 超出时间窗口的旧信号不再展示,避免列表一直挂着早盘的信号
    if (lastTs !== undefined && shownTs < lastTs - windowSec) continue;
    out.push({
      code: s.code,
      name: s.name,
      kind: p.kind,
      price: p.price.toFixed(3),
      // 极值所在时间(图上箭头的位置)
      time: p.time,
      ageMin: (() => {
        if (lastTs === undefined) return "";
        const mins = Math.max(0, Math.round((lastTs - shownTs) / 60));
        return mins === 0 ? "刚刚确认" : `${mins}分钟前确认`;
      })(),
    });
  }
  return out;
});

/** 多股分时:把各股当日分时填进各自独立窗口(现价/均价双线 + 昨收虚线 + 顶底) */
function renderMultiTrendCharts() {
  const dataMap = multiTrend.value;
  const peaks: Record<string, TrendPeak> = {};
  for (const s of stockList.value) {
    const mc = multiCharts[s.code];
    if (!mc) continue;
    if (mc.preCloseLine) {
      mc.priceSeries.removePriceLine(mc.preCloseLine);
      mc.preCloseLine = null;
    }
    const d = dataMap[s.code];
    if (!d || d.points.length === 0) {
      mc.priceSeries.setData([]);
      mc.priceSeries.setMarkers([]);
      mc.avgSeries.setData([]);
      continue;
    }
    // X 轴固定为整天:盘中早段点数少时也铺满 09:30-15:00,不被拉伸放大
    const slots = trendDaySlots(d.points);
    registerTrendAxis(d.points, slots);
    mc.priceSeries.setData(
      fillTrendSlots(slots, d.points, (p) => ({ value: p.price }))
    );
    mc.avgSeries.setData(
      fillTrendSlots(slots, d.points, (p) => ({ value: p.avg }))
    );
    // 顶底:与个股分时同一套 ZigZag 算法;小窗全部高度都是主图区,标记直接挂现价线
    const list = calcZigZagPeaks(d.points, d.preClose, MINUTE_ZIGZAG_OPTIONS);
    const last = list.at(-1);
    if (last) peaks[s.code] = last;
    mc.priceSeries.setMarkers(toPeakMarkers(list));
    // 昨收虚线:昨收未知(0)时不画
    if (d.preClose > 0) {
      mc.preCloseLine = mc.priceSeries.createPriceLine({
        price: d.preClose,
        color: "#909399",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: "昨收",
      });
    }
    // X 轴钉死在 09:30-15:00,各窗口时间轴宽度一致
    pinTrendAxis(mc.chart, slots);
  }
  multiPeaks.value = peaks;
}

// ---------- 近九日分时窗口(3×3 网格,每格一个交易日) ----------

/** 九日窗口 canvas 容器(日期 -> DOM,函数式 ref 收集) */
const nineDayCanvasEls = new Map<string, HTMLElement>();

/** 函数式 ref:收集/清理各窗口容器 */
function setNineDayCanvasEl(date: string) {
  return (el: unknown) => {
    if (el) nineDayCanvasEls.set(date, el as HTMLElement);
    else nineDayCanvasEls.delete(date);
  };
}

/** 已创建的九日窗口(日期 -> chart 与其 series) */
let nineDayCharts: Record<string, MiniChartEntry> = {};

/** 为九日网格惰性建图,并清理当前不再展示的旧窗口 */
function ensureNineDayCharts() {
  const dates = new Set(nineDayTrend.value.map((d) => d.date));
  for (const date of Object.keys(nineDayCharts)) {
    if (dates.has(date)) continue;
    nineDayCharts[date].chart.remove();
    delete nineDayCharts[date];
  }
  for (const d of nineDayTrend.value) {
    if (nineDayCharts[d.date]) continue;
    const el = nineDayCanvasEls.get(d.date);
    if (!el) continue;
    nineDayCharts[d.date] = createMiniTrendChart(el, true);
  }
}

/** 把各交易日的分时填进对应窗口(现价/均价双线 + 量柱 + 昨收虚线) */
function renderNineDayCharts() {
  for (const d of nineDayTrend.value) {
    const mc = nineDayCharts[d.date];
    if (!mc) continue;
    if (mc.preCloseLine) {
      mc.priceSeries.removePriceLine(mc.preCloseLine);
      mc.preCloseLine = null;
    }
    // X 轴固定为整天:历史日数据本就完整,当日盘中未走完的部分补空白槽位,
    // 九个窗口的时间轴宽度才一致,不会被点数拉伸
    const slots = trendDaySlots(d.points);
    registerTrendAxis(d.points, slots);
    mc.priceSeries.setData(
      fillTrendSlots(slots, d.points, (p) => ({ value: p.price }))
    );
    mc.avgSeries.setData(
      fillTrendSlots(slots, d.points, (p) => ({ value: p.avg }))
    );
    // 量柱:色随现价相对前一分钟(首点相对昨收)的涨跌,与当日分时一致
    mc.volumeSeries?.setData(
      fillTrendSlots(slots, d.points, (p, i) => ({
        value: p.volume,
        color:
          p.price >= (i > 0 ? d.points[i - 1].price : d.preClose)
            ? upBar
            : downBar,
      }))
    );
    // 分时 MACD:基于 5 分钟价格序列计算(EMA12/26 + DEA9),与当日分时同口径
    const { dif, dea, macd } = calcMACD(d.points.map((p) => p.price));
    mc.macdDifSeries?.setData(
      fillTrendSlots(slots, d.points, (_p, i) => ({ value: dif[i] }))
    );
    mc.macdDeaSeries?.setData(
      fillTrendSlots(slots, d.points, (_p, i) => ({ value: dea[i] }))
    );
    mc.macdHistSeries?.setData(
      fillTrendSlots(slots, d.points, (_p, i) => ({
        value: macd[i],
        color: macd[i] >= 0 ? upBar : downBar,
      }))
    );
    // 顶底:与当日分时同一套自适应 ZigZag;小窗较窄,标记只显示「顶/底」避免文字重叠
    const peaks = calcZigZagPeaks(
      d.points,
      d.preClose,
      MINUTE_ZIGZAG_OPTIONS
    );
    mc.priceSeries.setMarkers(toPeakMarkers(peaks, false));
    // 昨收虚线:昨收未知(0)时不画
    if (d.preClose > 0) {
      mc.preCloseLine = mc.priceSeries.createPriceLine({
        price: d.preClose,
        color: "#909399",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: "昨收",
      });
    }
    // X 轴钉死在 09:30-15:00:历史日与当日窗口的时间轴宽度一致
    pinTrendAxis(mc.chart, slots);
  }
}

/** 拉取行情并渲染;返回是否成功(轮询据此做失败退避) */
async function loadData(silent = false): Promise<boolean> {
  error.value = "";
  if (!silent) {
    loading.value = true;
    // 切股 / 切周期 / 手动刷新:先丢掉旧的实时报价,避免头部闪一下上一轮的价
    liveQuote.value = null;
    multiLive.value = {};
  }
  try {
    if (frequency.value === "t9") {
      // 近九日分时:一次拉齐 9 个交易日的 5 分钟线,登记全部伪时间戳供时间轴映射
      // 非静默刷新(首次/切股/手动)强制全量翻页,盘中轮询只补最新一页
      nineDayTrend.value = await fetchNineDayTrends(
        currentCode.value,
        !silent
      );
      clearTrendMaps();
      for (const d of nineDayTrend.value) {
        for (const p of d.points) trendPointMap.set(p.ts, p);
      }
      // 九日数据按倒序存放,第一个即最新交易日:用它判断今天是否开市
      const latestDay = nineDayTrend.value[0];
      if (latestDay?.date.length === 8) {
        noteDataDate(
          `${latestDay.date.slice(0, 4)}-${latestDay.date.slice(4, 6)}-${latestDay.date.slice(6, 8)}`
        );
      }
      lastTrendMinute = latestDay?.points.at(-1)?.time ?? "";
      // v-show 刚切到九日视图时等一帧,容器有尺寸后再惰性建图
      await nextTick();
      ensureNineDayCharts();
      renderNineDayCharts();
    } else if (frequency.value === "t") {
      // 分时:拉当日分钟线,并把伪时间戳登记进反查表(供时间轴/十字光标映射)
      if (isMultiTrend.value) {
        // 多股:并行拉全部自选(个别失败不拖累整体),每只一个独立分时窗口。
        // 分钟线一分钟才重拉一次(见轮询逻辑),所以这里可以一次拉齐
        const list = stockList.value;
        const settled = await Promise.allSettled(
          list.map((s) => fetchTrend(s.code))
        );
        // 增量刷新:失败的股票保留上一次的数据
        const map: Record<string, TrendData> = silent
          ? { ...multiTrend.value }
          : {};
        let fulfilled = 0;
        // TS 不追踪闭包内赋值的类型收窄,这里用 for 循环
        for (let i = 0; i < settled.length; i++) {
          const r = settled[i];
          if (r.status !== "fulfilled") continue;
          map[list[i].code] = r.value;
          fulfilled++;
        }
        if (fulfilled === 0) throw new Error("分时请求失败");
        multiTrend.value = map;
        // 反查表用任意一只有数据的股票(同一天,各股分钟序列的伪时间戳一致,
        // 供各窗口时间轴/十字光标把伪时间戳映射回真实 HH:mm)
        const first = Object.values(map)[0];
        clearTrendMaps();
        for (const p of first.points) trendPointMap.set(p.ts, p);
        // 行情日期取所有股票里最新的一个(个别停牌股会给出旧日期)
        let newest = first;
        for (const d of Object.values(map)) {
          const ts = d.points.at(-1)?.ts ?? 0;
          if (ts > (newest.points.at(-1)?.ts ?? 0)) newest = d;
        }
        noteDataDate(trendDataDate(newest.points));
        lastTrendMinute = newest.points.at(-1)?.time ?? "";
        // v-show 刚切到多股时等一帧,容器有尺寸后再惰性建图
        await nextTick();
        ensureMultiCharts();
        renderMultiTrendCharts();
      } else {
        trend.value = await fetchTrend(currentCode.value);
        clearTrendMaps();
        for (const p of trend.value.points) trendPointMap.set(p.ts, p);
        noteDataDate(trendDataDate(trend.value.points));
        lastTrendMinute = trend.value.points.at(-1)?.time ?? "";
        renderTrendSeries();
      }
    } else {
      // K线数据与实时报价并行拉取;报价失败时回退到最后一根收盘价
      const [barsRes, quoteRes] = await Promise.allSettled([
        fetchBars(currentCode.value, frequency.value),
        fetchLiveQuote(currentCode.value),
      ]);
      if (barsRes.status === "rejected") throw barsRes.reason;
      bars.value = barsRes.value;
      liveQuote.value =
        quoteRes.status === "fulfilled"
          ? { code: currentCode.value, ...quoteRes.value }
          : null;
      // 当天那根K线用实时报价修正收盘/高低,避免图上最后一根停在滞后价格
      if (liveQuote.value) {
        applyLiveQuoteToBars(
          bars.value,
          liveQuote.value,
          frequency.value
        );
      }
      // 日K数据顺带刷新左侧「观望/持有」标签缓存,避免为当前股票重复请求
      if (frequency.value === "d") {
        sideBars.value = { ...sideBars.value, [currentCode.value]: bars.value };
        const lastBar = bars.value.at(-1);
        if (lastBar) noteDataDate(lastBar.date);
      }
      if (!mainSeries) rebuildMainSeries();
      else renderSeries();
    }
    // 刚整段拉过分钟线,记下当前分钟:这一分钟内后续轮询只刷实时报价
    if (isIntraday.value) {
      lastFullTrendKey = currentMinuteKey();
      lastFullAt = Date.now();
    }
    return true;
  } catch (e: any) {
    const msg = e?.message || "获取行情数据失败";
    error.value = silent ? `${msg} · 稍后自动重试` : msg;
    // 轮询失败只提示、保留上一次的数据,避免整页清空 + 红色报错反复闪烁
    if (!silent) {
      bars.value = [];
      trend.value = null;
      multiTrend.value = {};
      nineDayTrend.value = [];
      liveQuote.value = null;
      if (frequency.value === "t9") {
        clearTrendMaps();
        // 数据清空后同步销毁旧窗口,避免残留上一次的走势
        ensureNineDayCharts();
      } else if (frequency.value === "t") {
        clearTrendMaps();
        if (isMultiTrend.value) renderMultiTrendCharts();
        else renderTrendSeries();
      } else {
        if (!mainSeries) rebuildMainSeries();
        else renderSeries();
      }
    }
    return false;
  } finally {
    if (!silent) loading.value = false;
  }
}

// ---------- 分时盘中自动刷新(仅交易时段轮询) ----------
let trendPollTimer: number | null = null;

/** 是否处于 A 股交易时段(周一~五 9:15-11:35 / 12:55-15:05,首尾各留余量) */
function isTradingTime(): boolean {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return (
    (minutes >= 9 * 60 + 15 && minutes <= 11 * 60 + 35) ||
    (minutes >= 12 * 60 + 55 && minutes <= 15 * 60 + 5)
  );
}
/** 静默刷新不设置 loading,轮询需单独记一个请求中标志,避免 5 秒间隔下请求堆积 */
let trendPollPending = false;

/**
 * K线模式:只刷新实时报价,不重拉整段K线(头部与图上最后一根同步)。
 * 返回是否成功,由轮询统一决定是否进入失败退避。
 */
async function refreshLiveQuote(): Promise<boolean> {
  try {
    const q = await fetchLiveQuote(currentCode.value);
    liveQuote.value = { code: currentCode.value, ...q };
    const last = bars.value.at(-1);
    if (last && last.date === todayStr()) {
      applyLiveQuoteToBars(bars.value, q, frequency.value);
      // 只 update 最后一根,不重设整段数据,不影响用户当前视口
      if (mainSeries) {
        if (chartType.value === "line") {
          (mainSeries as ISeriesApi<"Line">).update({
            time: last.date,
            value: last.close,
          });
        } else {
          (mainSeries as ISeriesApi<"Candlestick">).update({
            time: last.date,
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close,
          });
        }
      }
    }
    return true;
  } catch {
    // 静默失败:保留上一次报价,交给轮询做退避
    return false;
  }
}

/** 连续失败次数 / 下一次允许请求的时间:失败后指数退避,避免被限流还越撞越狠 */
let pollFailures = 0;
let nextPollAt = 0;

/** 「年+月+日+时+分」:用来判断是否已经跨过一根分钟线(跨了才重拉整段分钟数据) */
function currentMinuteKey(): string {
  const d = new Date();
  return `${d.getFullYear()}${d.getMonth() + 1}${d.getDate()}${d.getHours()}${d.getMinutes()}`;
}

/** 当前 "HH:mm" */
function currentHhmm(): string {
  const d = new Date();
  const h = `${d.getHours()}`.padStart(2, "0");
  const m = `${d.getMinutes()}`.padStart(2, "0");
  return `${h}:${m}`;
}

/** 是否在连续竞价时段(09:31-11:30 / 13:01-15:00):只在这段时间才要求分钟线追上当前分钟 */
function inContinuousSession(): boolean {
  const d = new Date();
  const minutes = d.getHours() * 60 + d.getMinutes();
  return (
    (minutes >= 9 * 60 + 31 && minutes <= 11 * 60 + 30) ||
    (minutes >= 13 * 60 + 1 && minutes <= 15 * 60)
  );
}

/** 上一次整段拉取分钟线:所在分钟 / 完成时刻 / 数据里最新一根的时刻 */
let lastFullTrendKey = "";
let lastFullAt = 0;
let lastTrendMinute = "";

/** 分钟切换后先等几秒再重拉:服务端往往还没生成新的一根,拉早了曲线会慢一分钟 */
const FULL_PULL_DELAY_SEC = 3;
/** 行情日期连续这么久都不是今天,就认为今天休市(节假日/停牌),降到低频探测 */
const STALE_QUIET_MS = 3 * 60 * 1000;
/** 休市探测间隔 */
const QUIET_PROBE_MS = 60 * 1000;

/** 首次发现"行情日期不是今天"的时刻;0 表示数据是今天的 */
let staleSince = 0;
let nextQuietProbeAt = 0;

/** 压缩时间轴伪时间戳里带着行情日期(Date.UTC(日期, 9:30)) */
function trendDataDate(points: { ts: number }[]): string {
  if (points.length === 0) return "";
  const d = new Date(points[0].ts * 1000);
  const m = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${d.getUTCDate()}`.padStart(2, "0");
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

/** 记录行情日期:与今天不同就开始计时,连续几分钟都没变才判定为休市 */
function noteDataDate(date: string) {
  if (!date) return;
  if (date >= todayStr()) {
    staleSince = 0;
    nextQuietProbeAt = 0;
    return;
  }
  if (staleSince === 0) staleSince = Date.now();
}

/** 是否进入休市静默模式(节假日/停市):只低频探测,不再整段重拉 */
function isStaleQuiet(): boolean {
  return staleSince > 0 && Date.now() - staleSince >= STALE_QUIET_MS;
}

/**
 * 休市静默模式下的低频探测:只拉当前个股的分时(1 个请求)看行情日期是否变成今天,
 * 一旦变成今天(重新开市)立刻按正常流程整段刷新一次,随后自动恢复常规轮询。
 */
async function probeTradingDay(): Promise<boolean> {
  try {
    const data = await fetchTrend(currentCode.value);
    noteDataDate(trendDataDate(data.points));
    if (!isStaleQuiet()) {
      lastFullTrendKey = "";
      await loadData(true);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 盘中轻量刷新:只拉实时报价(东财 stock/get,一次几十字节),
 * 用于两次整段分钟线之间把头部的现价/涨幅刷新出来 ——
 * 整段分钟线一分钟才重拉一次,大幅降低请求体积,避免被接口限流。
 */
async function refreshIntradayQuote(): Promise<boolean> {
  // 近九日视图没有单独的"现价"刷新需求,整页一分钟重拉一次就够
  if (isNineDay.value) return true;
  if (isMultiTrend.value) {
    const list = stockList.value;
    if (list.length === 0) return true;
    // 多股:每轮轮转一小批,轮流覆盖全部自选
    const batch = Math.min(MULTI_POLL_BATCH, list.length);
    multiPollCursor = (multiPollCursor + batch) % list.length;
    const targets = Array.from(
      { length: batch },
      (_, i) => list[(multiPollCursor + i) % list.length]
    );
    const settled = await Promise.allSettled(
      targets.map((s) => fetchLiveQuote(s.code))
    );
    const next = { ...multiLive.value };
    let fulfilled = 0;
    for (let i = 0; i < settled.length; i++) {
      const r = settled[i];
      if (r.status !== "fulfilled") continue;
      next[targets[i].code] = r.value;
      fulfilled++;
    }
    if (fulfilled === 0) return false;
    multiLive.value = next;
    return true;
  }
  const q = await fetchLiveQuote(currentCode.value);
  liveQuote.value = { code: currentCode.value, ...q };
  return true;
}

/** 记一次轮询失败:间隔按 2 的幂放大,最长 1 分钟 */
function markPollFailure() {
  pollFailures = Math.min(pollFailures + 1, 5);
  nextPollAt = Date.now() + Math.min(60000, TREND_POLL_MS * 2 ** pollFailures);
}

/** 轮询成功后复位退避状态 */
function markPollSuccess() {
  pollFailures = 0;
  nextPollAt = 0;
}

/** 统一跑一轮轮询:置请求中标志,成功后复位退避、失败则退避 */
function runPollJob(job: Promise<boolean>) {
  trendPollPending = true;
  job
    .then((ok) => (ok ? markPollSuccess() : markPollFailure()))
    .catch(() => markPollFailure())
    .finally(() => {
      trendPollPending = false;
    });
}

// 盘中自动刷新:分时视图按"分钟线 + 实时报价"两级刷新,K线视图只更新实时报价(仅交易时段)
function startTrendPolling() {
  stopTrendPolling();
  trendPollTimer = window.setInterval(() => {
    // 页面在后台 / 非交易时段 / 上一轮未完成 / 退避中,一律不发请求
    if (document.hidden) return;
    if (!isTradingTime() || loading.value || trendPollPending) return;
    if (Date.now() < nextPollAt) return;

    // 左侧「观望/持有」标签的日K在后台轮转补拉,与行情请求互不影响
    void refreshSideBarsIfDue();

    // 休市(节假日/停牌):一分钟只探一次(1 个请求),不再整段重拉
    if (isStaleQuiet()) {
      if (Date.now() < nextQuietProbeAt) return;
      nextQuietProbeAt = Date.now() + QUIET_PROBE_MS;
      runPollJob(probeTradingDay());
      return;
    }

    if (isIntraday.value) {
      const key = currentMinuteKey();
      // ① 跨分钟:等过前几秒(服务端还没生成新的一根)再拉
      const boundary =
        key !== lastFullTrendKey &&
        new Date().getSeconds() >= FULL_PULL_DELAY_SEC;
      // ② 已经跨分钟,但拿到的分钟线还停在更早的分钟:每 15 秒补拉一次
      //    (只在个股/多股生效;数据比当前分钟更新时不触发)
      const lagging =
        !isNineDay.value &&
        lastTrendMinute !== "" &&
        lastTrendMinute < currentHhmm() &&
        inContinuousSession() &&
        Date.now() - lastFullAt >= 15000;
      if (boundary || lagging) {
        runPollJob(
          loadData(true).then((ok) => {
            if (ok) lastFullTrendKey = key;
            return ok;
          })
        );
      } else {
        runPollJob(refreshIntradayQuote());
      }
    } else {
      runPollJob(refreshLiveQuote());
    }
  }, TREND_POLL_MS);
}

function stopTrendPolling() {
  if (trendPollTimer !== null) {
    clearInterval(trendPollTimer);
    trendPollTimer = null;
  }
}

function switchStock(code: string) {
  if (code === currentCode.value) return;
  currentCode.value = code;
}

// ---------- 页面全屏(浏览器 Fullscreen API) ----------
/** 页面根节点(全屏目标) */
const pageRef = ref<HTMLElement>();
const isFullscreen = ref(false);

/** 全屏状态变化(Esc 退出等)时同步按钮文案 */
function onFullscreenChange() {
  isFullscreen.value = document.fullscreenElement === pageRef.value;
}

/** 切换当前页面全屏 */
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await pageRef.value?.requestFullscreen();
  } catch {
    // 浏览器不支持或被用户拒绝时保持原状
  }
}

// ---------- 移动端适配(≤768px 切换为上下布局) ----------
/** 是否窄屏(手机) */
const isMobile = ref(false);
let mobileQuery: MediaQueryList | null = null;

function onMobileChange(e: MediaQueryListEvent | MediaQueryList) {
  isMobile.value = e.matches;
}

/** 弹窗宽度:桌面固定像素,移动端占屏幕 92% */
const addDialogWidth = computed(() => (isMobile.value ? "92%" : "420px"));
const planDialogWidth = computed(() => (isMobile.value ? "92%" : "720px"));

// ---------- 交易计划文档(plans/<code>.md,文件即数据源,IDE 修改后 HMR 自动同步) ----------
const planModules = import.meta.glob("./plans/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const planVisible = ref(false);
const planContent = computed(
  () => planModules[`./plans/${currentCode.value}.md`] ?? ""
);
const renderedPlan = computed(() => marked.parse(planContent.value) as string);

/** 操作记录条目(来自 plans/<code>.md 的"## 操作记录"表格) */
interface TradeRecord {
  date: string;
  action: string;
  price: number;
  qty: number;
}

/** 从 markdown 原文提取"## 操作记录"下的表格数据行;
 *  以"日期列是否为 YYYY-MM-DD"过滤,天然跳过表头、| ---- | 分隔行、空行和 HTML 注释 */
function parseTrades(md: string): TradeRecord[] {
  const seg =
    md.split(/^##\s+/m).find((s) => s.trimStart().startsWith("操作记录")) ?? "";
  const list: TradeRecord[] = [];
  for (const line of seg.split("\n")) {
    if (!line.includes("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    if (cells[0] === "") cells.shift();
    if (cells.at(-1) === "") cells.pop();
    const [date = "", action = "", price = "", qty = ""] = cells;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    list.push({
      date,
      action,
      price: parseFloat(price) || 0,
      qty: parseInt(qty, 10) || 0,
    });
  }
  return list;
}

/** 把操作日期映射到当前周期下不晚于它的最后一根K线(周K/月K下原始日期不在数据里);早于数据起点返回 null */
function toBarTime(date: string): string | null {
  for (let i = bars.value.length - 1; i >= 0; i--) {
    if (bars.value[i].date <= date) return bars.value[i].date;
  }
  return null;
}

/** 成本线 + 买卖点统一挂在主图 series 上,数据或 md 变化后重画 */
function applyOverlays() {
  if (!mainSeries) return;

  // 成本线:STOCKS 的 cost,0 = 未持仓不画
  if (costLine) {
    mainSeries.removePriceLine(costLine);
    costLine = null;
  }
  if (currentStock.value.cost > 0) {
    costLine = mainSeries.createPriceLine({
      price: currentStock.value.cost,
      color: "#ff9800",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "成本",
    });
  }

  // 买卖点:买 = 红色上箭头(B),卖 = 绿色下箭头(S)
  const markers: SeriesMarker<string>[] = [];
  for (const t of parseTrades(planContent.value)) {
    const sell = t.action.includes("卖");
    if (!sell && !t.action.includes("买")) continue;
    const time = toBarTime(t.date);
    if (!time) continue; // 早于当前周期数据起点的记录不显示
    markers.push({
      time,
      position: sell ? "aboveBar" : "belowBar",
      color: sell ? DOWN_COLOR : UP_COLOR,
      shape: sell ? "arrowDown" : "arrowUp",
      // text: `${sell ? "S" : "B"}${t.qty || ""}`,
      text: sell ? "S" : "B",
      // 与顶底标记同尺寸的迷你箭头(原来是 2)
      size: 0.5,
    });
  }
  // 日K顶底:顶=绿色下箭头、底=红色上箭头,与买卖点合并后统一排序。
  // 距上一个顶不超过 N 个交易日时,当前顶颜色加深(短时间连续冲顶)
  let lastTopIndex = -Infinity;
  for (const p of dailyPeaks.value) {
    let color = p.kind === "top" ? DOWN_COLOR : UP_COLOR;
    if (p.kind === "top") {
      if (p.index - lastTopIndex <= DAILY_PEAK_TOP_EMPHASIS_GAP) {
        color = TOP_EMPHASIS_COLOR;
      }
      lastTopIndex = p.index;
    }
    markers.push({
      time: p.time,
      position: p.kind === "top" ? "aboveBar" : "belowBar",
      color,
      shape: p.kind === "top" ? "arrowDown" : "arrowUp",
      text: `${p.kind === "top" ? "顶" : "底"} ${p.price.toFixed(3)}`,
      size: 1,
    });
  }
  // lightweight-charts 要求 markers 按时间升序
  markers.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  mainSeries.setMarkers(markers);
}

// 注意:回调必须用箭头函数包装,loadData 的首个参数是 silent,
// 直接传引用会把 watch 的 newVal 数组误当 silent 传入
watch(currentCode, () => loadData());
watch([frequency, trendView], () => loadData());
// 自选列表变化(新增/移除)时补拉左侧标签所需的日K
watch(stockList, () => void loadSideBars());
watch(chartType, rebuildMainSeries);
// 日K顶底标准切换:无需重新拉行情,重算标记并重画覆盖层
watch(dailyPeakMode, () => {
  if (frequency.value !== "d") return;
  dailyPeaks.value = calcDailyPeaks();
  applyOverlays();
});
// 只改了 md(操作记录)或成本时,无需重新拉行情,直接重画
watch(planContent, applyOverlays);
// 盘中自动刷新常驻:分时视图重拉数据,K线视图只刷新实时报价
// (startTrendPolling 在 onMounted 启动,onBeforeUnmount 停止)

onMounted(async () => {
  // 先确定窄屏状态,避免移动端首屏按桌面布局初始化后再跳变
  mobileQuery = window.matchMedia("(max-width: 768px)");
  onMobileChange(mobileQuery);
  mobileQuery.addEventListener("change", onMobileChange);
  await nextTick();
  createChartInstance();
  loadData();
  startTrendPolling();
  // 左侧标签后台加载,不阻塞图表首屏
  void loadSideBars();
  document.addEventListener("fullscreenchange", onFullscreenChange);
});

onBeforeUnmount(() => {
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  mobileQuery?.removeEventListener("change", onMobileChange);
  mobileQuery = null;
  stopTrendPolling();
  resizeObserver?.disconnect();
  chart?.remove();
  chart = null;
  // 多股 / 九日窗口(autoSize 的 ResizeObserver 随 chart.remove 一并释放)
  for (const code of Object.keys(multiCharts)) multiCharts[code].chart.remove();
  multiCharts = {};
  for (const date of Object.keys(nineDayCharts)) {
    nineDayCharts[date].chart.remove();
  }
  nineDayCharts = {};
});
</script>

<style lang="scss" scoped>
/* A股习惯配色:红涨绿跌 */
$up-color: #ef232a;
$down-color: #089981;

.stock-trend {
  display: flex;
  height: 100vh;
  background: #f5f7fa;
}

.stock-side {
  width: 200px;
  flex-shrink: 0;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  overflow-y: auto;

  .side-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    font-weight: bold;
    color: #303133;
    border-bottom: 1px solid #e4e7ed;
  }

  .stock-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 12px 16px;
    cursor: pointer;
    border-left: 3px solid transparent;
    transition: background 0.2s;

    .stock-info {
      flex: 1;
      min-width: 0;
    }

    /* 移除按钮:仅自定义股票渲染,hover 时显示 */
    .stock-remove {
      flex-shrink: 0;
      padding: 0 4px;
      font-size: 16px;
      line-height: 1;
      color: #c0c4cc;
      visibility: hidden;

      &:hover {
        color: #f56c6c;
      }
    }

    &:hover {
      background: #f5f7fa;

      .stock-remove {
        visibility: visible;
      }
    }

    &.active {
      background: #ecf5ff;
      border-left-color: #409eff;

      .stock-name {
        color: #409eff;
      }
    }

    .stock-name {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 14px;
      color: #303133;

      /* 最近日K顶底标签:顶=观望(绿)、底=持有(红),与图上顶底同色 */
      .stock-tag {
        flex-shrink: 0;
        padding: 0 4px;
        border: 1px solid currentColor;
        border-radius: 3px;
        font-size: 10px;
        font-weight: normal;
        line-height: 15px;

        &.top {
          color: $down-color;
        }

        &.bottom {
          color: $up-color;
        }
      }
    }

    .stock-code {
      margin-top: 2px;
      font-size: 12px;
      color: #909399;
    }
  }
}

.chart-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
  min-width: 0;
}

.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;

  .head-quote {
    display: flex;
    align-items: baseline;
    gap: 8px;

    .name {
      font-size: 18px;
      font-weight: bold;
      color: #303133;
    }

    .code {
      font-size: 13px;
      color: #909399;
    }

    .price {
      font-size: 22px;
      font-weight: bold;

      &.up {
        color: $up-color;
      }
      &.down {
        color: $down-color;
      }
    }

    .chg {
      font-size: 14px;

      &.up {
        color: $up-color;
      }
      &.down {
        color: $down-color;
      }
    }
  }

  /* 分时顶底列表:顶=绿、底=红,与图上标记一致 */
  .head-signals {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    overflow: hidden;
    font-size: 12px;
    color: #909399;

    .signals-title {
      flex-shrink: 0;
      color: #606266;
    }

    .signals-empty {
      color: #c0c4cc;
    }

    .signal-item {
      white-space: nowrap;

      &.top {
        color: $down-color;
      }

      &.bottom {
        color: $up-color;
      }
    }
  }

  .head-tools {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.chart-box {
  position: relative;
  flex: 1;
  min-height: 0;
  background: #fff;
  border-radius: 4px;
  border: 1px solid #e4e7ed;

  /* 个股分时:整天时间轴压在一个屏幕高度里会显得过高(波动被竖向放大),
     限制最大高度,超出部分留白 */
  &.trend-box {
    max-height: 700px;
  }

  .chart-canvas {
    position: absolute;
    inset: 0;
  }

  /* 左上角 MA 图例,悬浮在图上,不响应鼠标 */
  .ma-legend {
    position: absolute;
    top: 6px;
    left: 8px;
    z-index: 10;
    display: flex;
    gap: 10px;
    font-size: 12px;
    pointer-events: none;

    .cost-legend {
      color: #ff9800;
    }

    .up {
      color: $up-color;
    }

    .down {
      color: $down-color;
    }
  }

}

/* 多股分时顶部的顶底汇总:每只自选一条「名称:顶/底 价格」,放不下换行 */
.multi-signal-list {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 18px;
  max-height: 88px;
  overflow-y: auto;
  margin-bottom: 8px;
  padding: 6px 10px;
  font-size: 13px;
  line-height: 1.5;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;

  .signal-cell {
    white-space: nowrap;

    .s-name {
      color: #606266;
    }

    /* 极值时间与 "N分钟前":灰色小字,便于判断信号新不新 */
    .s-time {
      margin-left: 4px;
      font-size: 11px;
      color: #909399;
    }

    /* 顶=绿、底=红,与图上标记一致 */
    &.top .s-value {
      color: $down-color;
    }

    &.bottom .s-value {
      color: $up-color;
    }
  }

  /* 时间窗口内没有任何信号时的占位 */
  .list-empty {
    color: #c0c4cc;
  }
}

/* 多股分时:每只自选一个独立窗口,三列网格同屏 */
.multi-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  /* 每个窗口至少 400px;一屏放不下时容器纵向滚动 */
  grid-auto-rows: minmax(400px, 1fr);
  gap: 8px;
  overflow-y: auto;

  .multi-cell {
    display: flex;
    flex-direction: column;
    min-height: 400px;
    background: #fff;
    border: 1px solid #e4e7ed;
    border-radius: 4px;
    overflow: hidden;
  }

  .multi-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 4px 10px;
    font-size: 13px;
    border-bottom: 1px solid #ebeef5;

    .m-name {
      font-weight: bold;
      color: #303133;
    }

    /* 最近一条顶底信号:靠近右侧报价,顶=绿、底=红 */
    .m-signal {
      margin-left: auto;
      margin-right: 8px;
      font-size: 11px;
      white-space: nowrap;

      &.top { color: $down-color; }
      &.bottom { color: $up-color; }
    }

    .m-quote {
      font-weight: bold;

      &.up { color: $up-color; }
      &.down { color: $down-color; }
    }
  }

  .multi-canvas {
    flex: 1;
    min-height: 0;
  }
}

/* 近九日分时:可选 3×3 同屏 / 2×4 滚动查看 */
.nine-grid {
  gap: 4px;
  align-content: start;

  /* 标题栏收窄,把更多高度留给图表 */
  .multi-head {
    padding: 2px 8px;
    font-size: 12px;
    border-bottom-color: #f2f3f5;
  }

  /* 3 列 3 行:单元格同样最低 500px,一屏放不下时纵向滚动 */
  &.layout-3x3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-rows: minmax(500px, 1fr);
    overflow-y: auto;

    .multi-cell {
      min-height: 500px;
    }
  }

  /* 2 列:单元格最低 500px,超出容器高度时纵向滚动 */
  &.layout-2x4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-rows: auto;
    overflow-y: auto;

    .multi-cell {
      min-height: 500px;
    }
  }
}

/* 添加自选弹窗 */
.add-form {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .form-row {
    display: flex;
    align-items: center;
    gap: 10px;

    label {
      flex-shrink: 0;
      width: 56px;
      font-size: 14px;
      color: #606266;
      text-align: right;
    }
  }

  .form-tip {
    font-size: 12px;
    line-height: 1.5;
    color: #909399;
    padding-left: 66px;
  }
}

/* markdown 交易计划预览 */
.plan-md {
  max-height: 60vh;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.7;

  :deep(h1) {
    margin: 0 0 12px;
    font-size: 20px;
  }

  :deep(h2) {
    margin: 16px 0 8px;
    padding-bottom: 6px;
    font-size: 16px;
    border-bottom: 1px solid #ebeef5;
  }

  :deep(h3) {
    margin: 12px 0 6px;
    font-size: 14px;
  }

  :deep(p) {
    margin: 6px 0;
  }

  :deep(ul),
  :deep(ol) {
    margin: 6px 0;
    padding-left: 22px;
  }

  :deep(code) {
    padding: 1px 5px;
    font-size: 13px;
    color: #c7254e;
    background: #f5f7fa;
    border-radius: 3px;
  }

  :deep(pre) {
    padding: 10px 12px;
    overflow-x: auto;
    background: #f5f7fa;
    border-radius: 4px;
  }

  :deep(pre code) {
    padding: 0;
    color: inherit;
    background: none;
  }

  :deep(blockquote) {
    margin: 8px 0;
    padding: 4px 12px;
    color: #606266;
    border-left: 3px solid #dcdfe6;
  }

  :deep(table) {
    margin: 8px 0;
    border-collapse: collapse;

    th,
    td {
      padding: 6px 12px;
      border: 1px solid #ebeef5;
    }
  }
}

.chart-error {
  margin-top: 8px;
}

/* ---------- 移动端适配(≤768px):左右分栏改为上下布局 ---------- */
@media (max-width: 768px) {
  .stock-trend {
    height: 100dvh; /* 移动端地址栏收起/展开时保持可视高度;不支持时退回 100vh */
    flex-direction: column;
    overflow: hidden;
  }

  /* 左侧自选改为顶部横向滚动标签栏,标题与添加入口 sticky 在左侧 */
  .stock-side {
    display: flex;
    align-items: stretch;
    width: 100%;
    height: auto;
    flex-shrink: 0;
    overflow-x: auto;
    overflow-y: hidden;
    border-right: none;
    border-bottom: 1px solid #e4e7ed;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }

    .side-title {
      position: sticky;
      left: 0;
      z-index: 2;
      flex-shrink: 0;
      padding: 8px 10px;
      font-size: 12px;
      font-weight: normal;
      background: #fff;
      border-right: 1px solid #ebeef5;
      border-bottom: none;
    }

    .stock-item {
      flex-shrink: 0;
      padding: 8px 12px;
      border-left: none;
      border-bottom: 2px solid transparent;

      &.active {
        border-left-color: transparent;
        border-bottom-color: #409eff;
      }

      .stock-name {
        font-size: 13px;
        white-space: nowrap;
      }

      .stock-code {
        margin-top: 0;
        font-size: 10px;
        white-space: nowrap;
      }

      /* 触屏没有 hover,移除按钮常驻显示 */
      .stock-remove {
        visibility: visible;
      }
    }
  }

  .chart-main {
    flex: 1;
    min-height: 0;
    /* 底部预留 iPhone Home indicator 安全区 */
    padding: 6px 8px calc(8px + env(safe-area-inset-bottom));
  }

  .chart-head {
    gap: 4px;
    margin-bottom: 6px;

    .head-quote {
      width: 100%;
      gap: 6px;

      .name {
        font-size: 15px;
      }

      .code {
        font-size: 11px;
      }

      .price {
        font-size: 18px;
      }

      .chg {
        font-size: 12px;
      }
    }

    /* 顶底列表与工具栏改为单行横向滚动,避免换行挤压图表高度 */
    .head-signals,
    .head-tools {
      width: 100%;
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }

      > * {
        flex-shrink: 0;
      }
    }

    .head-tools {
      gap: 6px;
      padding-bottom: 2px;
    }

    .head-signals {
      gap: 8px;
    }
  }

  /* 图例:窄屏允许换行,字号略小 */
  .chart-box .ma-legend {
    flex-wrap: wrap;
    max-width: calc(100% - 70px);
    gap: 2px 8px;
    font-size: 11px;
  }

  /* 多股顶底汇总:窄屏缩小字号与间距,高度再压一点 */
  .multi-signal-list {
    gap: 2px 12px;
    max-height: 76px;
    padding: 4px 8px;
    font-size: 12px;
  }

  /* 多股分时:单列纵向滚动,每格最低 400px */
  .multi-grid {
    grid-template-columns: 1fr;
    grid-auto-rows: auto;
    overflow-y: auto;
    touch-action: pan-y;

    .multi-cell {
      min-height: 400px;
    }

    .multi-canvas {
      min-height: 200px;
      touch-action: pan-y;
    }
  }

  /* 近九日:不论桌面选了哪种布局,移动端一律单列 */
  .nine-grid {
    &.layout-3x3,
    &.layout-2x4 {
      grid-template-columns: 1fr;
      grid-auto-rows: auto;
      overflow-y: auto;

      .multi-cell {
        min-height: 260px;
      }
    }
  }

  /* 交易计划弹窗:提高可视高度,宽表格允许横向滚动 */
  .plan-md {
    max-height: 70vh;
    overflow-x: auto;
  }
}
</style>
