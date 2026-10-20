/** 股票走势页常量配置 */

/** 股票条目(代码为 baostock 格式:sh./sz. 前缀,数据字段命名也对齐 baostock,便于日后切换到 Python 后端) */
export interface StockItem {
  code: string;
  name: string;
  /** 持仓成本价;0 表示未持仓,不画成本线 */
  cost: number;
}

/** 用户自定义自选股的 localStorage 键名(自定义项与内置 STOCKS 合并展示) */
export const CUSTOM_STOCKS_KEY = "stockTrend.customStocks";

/** 固定关注的股票(内置列表,自定义项见 CUSTOM_STOCKS_KEY) */
export const STOCKS: StockItem[] = [
  { code: "sh.515880", name: "通信ETF国泰", cost: 0.642 },
  { code: "sh.588000", name: "科创50ETF华夏", cost: 1.669 },
  { code: "sh.512400", name: "有色金属ETF南方", cost: 1.739 },
  { code: "sh.562950", name: "消费电子ETF易方达", cost: 1.732 },
  { code: "sh.510330", name: "沪深300ETF华夏", cost: 4.340 },
  { code: "sh.512710", name: "军工龙头ETF", cost: 0.000 },
  { code: "sh.515180", name: "红利易方达ETF", cost: 1.432 },
];


/** A股习惯配色:红涨绿跌 */
export const UP_COLOR = "#ef232a";
export const DOWN_COLOR = "#089981";

/** 各区域纵向占比:主图(上半)、成交量(中部)、MACD(底部) */
export const MAIN_MARGINS = { top: 0.05, bottom: 0.52 };
export const VOLUME_MARGINS = { top: 0.55, bottom: 0.28 };
export const MACD_MARGINS = { top: 0.78, bottom: 0 };

/** 主图均线(MA)周期与颜色 */
export const MA_CONFIG = [
  { period: 7, color: "#000000" },
  { period: 21, color: "#0066CC" },
  { period: 55, color: "#CC00FF" },
  { period: 110, color: "#FFCCFF" },
  { period: 220, color: "#99CC00" },
];

/** 成交量副图均量线周期(按K线根数,日K即 N 日均量)与颜色 */
export const VOL_MA_CONFIG = [
  { period: 20, color: "#f0a020" },
  { period: 250, color: "#909399" },
];

/** 默认一屏显示的K线根数,更早的历史靠左滑查看 */
export const VISIBLE_BARS = 120;

/** ---------- 分时(盘中分钟走势) ---------- */

/** 分时现价线(蓝)与均价线(黄)颜色 */
export const TREND_PRICE_COLOR = "#409eff";
export const TREND_AVG_COLOR = "#f0a020";

/** 分时模式下主图、成交量与分时MACD副图的纵向占比;
 *  主图上下留出余量,避免当日最高/最低处的「顶/底」标记箭头与价格文字被图表边缘裁掉 */
export const TREND_MAIN_MARGINS = { top: 0.09, bottom: 0.44 };
export const TREND_VOLUME_MARGINS = { top: 0.6, bottom: 0.26 };
export const TREND_MACD_MARGINS = { top: 0.79, bottom: 0 };

/** 多股分时小窗(只有现价/均价双线,没有量柱)的纵向余量,上下各留一截给顶底标记 */
export const MINI_TREND_PRICE_MARGINS = { top: 0.14, bottom: 0.14 };

/** 盘中自动刷新间隔(毫秒):5 秒,当日分时/多股/近九日统一使用;
 *  分时数据本身是 1 分钟粒度,5 秒一次可在分钟线更新后尽快看到,同时避免请求过于频繁
 *  (请求还在飞时会被 trendPollPending 跳过,不会堆积) */
export const TREND_POLL_MS = 5000;

/** 多股视图「轻量刷新」每轮取几只股票的实时报价:整段分钟线一分钟才重拉一次,
 *  两次之间只轮转刷新一小批报价,避免一次性打满接口被拒连(Failed to fetch) */
export const MULTI_POLL_BATCH = 2;

/** ---------- 分时顶底信号 ---------- */

/** 多股视图顶部顶底汇总的时间窗口(分钟):只列出最近 N 分钟内出现的信号。
 *  基准取该股最新一分钟(盘中即"现在"),收盘后即为尾盘那几分钟 */
export const MULTI_SIGNAL_WINDOW_MIN = 5;

/** 相邻顶底之间的最小摆动幅度下限(百分比),过滤横盘噪声。
 *  0.5% 大致对应 ETF 日内有意义的波段,低波动日以该值为准 */
export const TREND_PEAK_MIN_SWING = 0.5;

/** 摆动阈值随当日振幅放大的系数:阈值 = 当日振幅 × 该系数,再夹在上下限之间。
 *  高波动日放大阈值,避免把日内大量小波段都标成顶底 */
export const TREND_PEAK_RANGE_RATIO = 0.3;

/** 自适应摆动阈值的上限(百分比),防止极端波动日阈值过大而漏掉主波段 */
export const TREND_PEAK_MAX_SWING = 1.2;

/** 单日最多展示的顶底信号数;超过时按摆动突出度删除最不显著的信号 */
export const TREND_PEAK_MAX_COUNT = 8;

/** 最小摆动至少要有 N 个报价单位(0.001 元),避免低价 ETF 的 1~2 个 tick 抖动 */
export const TREND_PEAK_MIN_TICKS = 3;

/** 相邻顶底的最小间隔(分钟),过滤 1~2 分钟内的快速来回 */
export const TREND_PEAK_MIN_GAP = 5;

/** 间隔过近时,摆动达到阈值的 N 倍即视为强反转,不受最小间隔限制 */
export const TREND_PEAK_STRONG_SWING_MULT = 1.5;

/** 头部顶底信号列表最多展示条数(最新的在前) */
export const TREND_PEAK_MAX_SHOW = 4;

/** ---------- 日K顶底信号 ---------- */

/** 日K局部极值窗口:点左右各 N 个交易日 */
export const DAILY_PEAK_WINDOW = 5;

/** 日K候选点之后 MACD 死叉/金叉确认窗口(交易日) */
export const DAILY_PEAK_CONFIRM_BARS = 5;

/** 日K相邻顶底最小摆动幅度(%),小于该值的波段视为噪声 */
export const DAILY_PEAK_MIN_SWING = 2;

/** 日K相邻顶底最小间隔(交易日) */
export const DAILY_PEAK_MIN_GAP = 3;

/** ---------- 日K均线顶底 ---------- */

/** 均线周期(日K) */
export const DAILY_MA_PEAK_PERIOD = 20;

/** 均线拐点确认天数:均线在 ±N 天窗口内为局部最大/最小才视为拐点 */
export const DAILY_MA_PEAK_CONFIRM = 3;

/** 均线顶底最小间隔(交易日),过滤震荡期均线的反复转向 */
export const DAILY_MA_PEAK_MIN_GAP = 5;

/** 日K顶:距上一个顶不超过 N 个交易日时,当前顶颜色加深(短时间连续冲顶) */
export const DAILY_PEAK_TOP_EMPHASIS_GAP = 10;

/** 连续顶的加深颜色(深绿,区分普通顶) */
export const TOP_EMPHASIS_COLOR = "#046b5a";

/** ---------- 近九日分时(3×3 网格) ---------- */

/** 展示的交易日数量 */
export const NINE_DAY_COUNT = 9;

/** 东方财富备用源:5 分钟线一次请求根数(600 根约 12 个交易日) */
export const NINE_DAY_BARS = 600;

/** 腾讯 1 分钟线单页最多 800 根(约 3.3 个交易日),向前分页直到覆盖 9 日 + 前一日 */
export const NINE_DAY_PAGE_BARS = 800;

/** 盘中增量刷新只取最近约 1.3 个交易日,减少流量 */
export const NINE_DAY_REFRESH_BARS = 320;

/** 九日迷你窗口:主图 / 量柱 / MACD 三区的纵向占比(区间尽量贴合,减少空隙) */
export const MINI_TREND_MAIN_MARGINS = { top: 0.07, bottom: 0.44 };
export const MINI_TREND_VOLUME_MARGINS = { top: 0.57, bottom: 0.28 };
export const MINI_TREND_MACD_MARGINS = { top: 0.72, bottom: 0 };
