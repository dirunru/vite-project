# 股票走势页(stockTrend)文档

> 对应文件:`src/views/stockTrend/index.vue`(约 1600 行,Vue 3 `<script setup>` + TypeScript + SCSS)

## 一、功能概述

一个**单页 A 股行情看盘工具**,采用左右分栏的 100vh 固定布局:

- **左侧**:自选股票列表(内置 `STOCKS` + 用户在页面上添加的自定义项),点击切换当前查看的标的;
- **右侧**:行情图表区,包含报价头部(名称 / 代码 / 最新价 / 涨跌幅)、工具栏、三合一图表(主图 + 成交量副图 + MACD 副图);
- **弹窗**:每只股票关联一份 markdown 交易计划文档(`plans/<code>.md`),点击"计划"按钮弹出预览。

核心特性:

| 特性 | 说明 |
| --- | --- |
| 多周期切换 | 分时 / 近9日 / 日K / 周K / 月K |
| 自定义自选 | 左侧列表「+ 添加」弹窗录入代码 / 名称 / 成本,自定义项存 localStorage;悬浮显示 × 可移除(内置项不可删) |
| 近九日分时 | 近 9 个交易日的 1 分钟分时,按日期倒序(最新在左上);布局可选 **3×3** 或 **2×4**,单元格均最低 500px、放不下时纵向滚动;含现价/均价双线 + 量柱 + MACD + 昨收虚线 + 顶底标记 |
| 多股分时 | 分时下"多股"模式:全部自选各占一个窗口,三列网格对比涨跌幅;网格上方有一条顶底汇总,只列 `MULTI_SIGNAL_WINDOW_MIN`(5)分钟内出现的信号,格式 `名称:顶/底 价格` |
| 双图表类型 | K线(蜡烛图)/ 走势(收盘价折线),分时类视图下隐藏 |
| 主图叠加 | 5 条均线(MA7/21/55/110/220)+ 持仓成本虚线 + 买卖点箭头标记(仅 K 线模式) |
| 成交量副图 | 红绿量柱(随涨跌染色)+ 2 条均量线(20 / 250,仅 K 线模式) |
| MACD 副图 | DIF / DEA 双线 + 红绿柱(国内习惯:`(DIF-DEA)×2`,仅 K 线模式) |
| 分时模式 | 当日分钟走势:现价线(蓝)+ 均价线(黄)+ 昨收基准虚线,量柱随分钟涨跌染色,盘中 5s 自动刷新 |
| 分时顶底 | 当日分时(个股与多股)用自适应 ZigZag 摆动结构识别真实高点/低点,图上箭头标注「顶/底 + 当时价格」;个股在头部列出最近 4 条,多股在每个窗口标题栏显示各自最近一条(均带价格) |
| 日K顶底 | 默认「价格顶底」(局部极值 + MACD:窗口 5 日 / 摆动 2% / 间隔 3 日),可切换「均线顶底」(MA20 方向拐点、标记回溯到波段价格极值)。顶=绿色下箭头、底=红色上箭头;距上一个顶 ≤10 个交易日时,第二个顶颜色加深。与交易计划买卖点合并显示 |
| 左侧信号标签 | 每只自选名称后显示最近一个日K顶底信号:最近是顶 → 「观望」(绿),最近是底 → 「持有」(红);跟随日K顶底标准切换 |
| 十字光标联动 | 悬停时左上角图例(MA 数值 / 分时现价均价)实时显示对应位置,移出后回到最新一根 |
| 左滑看历史 | K 线一次拉足历史数据,默认展示最近 120 根,更早的靠左滑查看 |
| 页面全屏 | 工具栏「全屏」按钮,基于 Fullscreen API 对页面根节点全屏,再点或按 Esc 退出 |
| 移动端适配 | ≤768px 自动切换上下布局:自选变顶部横向标签栏,顶底/工具栏单行横向滚动,多股与近九日单列滚动,弹窗宽度自适应 |

## 二、页面结构(模板)

```
.stock-trend (flex, 100vh)
├── aside.stock-side          左侧自选列表(v-for stockList = 内置 STOCKS + 自定义,active 高亮)
│   └── .side-title           「+ 添加」入口;自定义项悬浮显示 × 移除按钮
└── main.chart-main           右侧图表区
    ├── header.chart-head
    │   ├── .head-quote       名称 + 代码 + 最新价 + 涨跌幅(红涨绿跌 class)
    │   ├── .head-signals     分时顶底信号列表(最近 4 条,最新在前;仅个股分时)
    │   └── .head-tools       周期切换(分时/近9日)/ 分时展示切换 / 九日布局切换 / 图表类型切换 / 日K顶底切换 / 刷新 / 全屏 / 计划
    ├── .chart-box            单图模式(当日分时 / K线)
    │   ├── .ma-legend        左上角悬浮图例(K线=MA 数值,分时=现价/均价/时间/涨跌幅)
    │   └── .chart-canvas     lightweight-charts 挂载点(v-loading)
    ├── .multi-signal-list    多股顶底汇总:只列最近 5 分钟内出现的信号 `名称:顶/底 价格`(窗口内无信号时显示占位)
    ├── .multi-grid           多股分时:三列网格,每只自选一个 .multi-canvas
    ├── .multi-grid.nine-grid 近九日分时:3×3 同屏 / 2×4 滚动可切换,每个交易日一个 .multi-canvas
    └── el-alert              请求失败时的错误提示
+ el-dialog                   交易计划 markdown 预览(:lock-scroll="false")
+ el-dialog                   添加自选股票表单(代码 / 名称 / 成本)
```

> 细节:`el-dialog` 设置 `:lock-scroll="false"`,因为页面本身是 100vh 固定布局,锁 body 滚动会引发宽度跳变、图表抖动。

## 三、数据获取

### 行情接口(`fetchBars`)

**双数据源自动回退**:优先腾讯 K 线,失败时切东方财富。`trySources()` 依次尝试并汇总两边的错误;`fetchJson()` 给每个请求加 6 秒超时,单个数据源不可达时不会长时间卡住页面。

**腾讯(主源)**

```
https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh515180,day,,,750,qfq
```

| 参数 | 说明 |
| --- | --- |
| `param` | `代码,周期,,根数,qfq`;周期 `day`/`week`/`month` |
| 返回 | `data.<code>.qfqday[]`(周/月为 `qfqweek`/`qfqmonth`),每行 `[日期,开,收,高,低,成交量(手)]` |
| 涨跌幅 | 腾讯日线不直接提供,用前一根收盘价计算 |

**东方财富(备用源)**

`push2his.eastmoney.com/api/qt/stock/kline/get`,浏览器直接请求、支持跨域:

| 参数 | 说明 |
| --- | --- |
| `secid` | 由 baostock 代码转换而来(`toSecid`):`sh.` → 市场号 `1`,`sz.`/`bj.` → `0` |
| `klt` | `101`=日K,`102`=周K,`103`=月K |
| `fqt=1` | 前复权 |
| `lmt` | 一次拉取根数:日K 750(约三年)、周K 260(约五年)、月K 120(约十年) |
| `fields2` | 日期,开盘,收盘,最高,最低,成交量,成交额,涨跌幅(`f59` 是涨跌幅;`f61` 是换手率,勿用) |

返回数据解析为本地 `StockBar` 结构(字段名对齐 baostock 的 `query_history_k_data_plus`,便于日后切换到 Python 后端而无需改动下游):

```ts
interface StockBar {
  date: string; open: number; high: number; low: number;
  close: number; volume: number; pctChg: number; // 涨跌幅 %
}
```

### 实时报价接口(`fetchLiveQuote`)

东方财富 `push2.eastmoney.com/api/qt/stock/get`,支持跨域:

- `fields=f43,f59,f60`:最新价 / 小数位数 / 昨收(均为整数,价格 = 值 ÷ 10^f59);
- 仅 K 线模式使用:日K接口最后一根在盘中可能滞后,周/月K的最后一根更是周期末价格,不能代表现价;头部「当前价格」与涨跌幅改用实时报价,不再取最后一根K线的收盘;
- 同时用报价修正当天那根 K 线的收盘/最高/最低,图表最后一根与头部保持一致;盘中只 `update` 最后一根,不重设整段数据,不会打断用户当前视口;
- 分时接口的**昨收兜底**也复用它:腾讯 `qt` 缺失、或退回东财 `trends2`(该接口实测不返回 `preClose`)时,由 `ensurePreClose()` 用 `f60` 把昨收补上,避免分时头部「当前价格/涨幅」和图上昨收虚线一起失效。

### 分时接口(`fetchTrend`)

同样采用**腾讯优先、东方财富备用**的双源回退。

**腾讯(主源)**:`web.ifzq.gtimg.cn/appstock/app/minute/query?code=sh515180`

- 返回 `data.<code>.data.data[]`,每行 `"HHmm 现价 累计成交量(手) 累计成交额"`;
- 腾讯会附带 15:06-15:30 的盘后固定价格交易点,解析时只保留 09:30-11:30 / 13:00-15:00;
- 分时均价 = 累计成交额 / (累计成交量 × 100),分钟量 = 累计成交量差分;
- 昨收取 `qt` 数组第 5 项(索引 4)。

**东方财富(备用源)**:`push2his.eastmoney.com/api/qt/stock/trends2/get`

> 实测该接口的 `data` 里**没有 `preClose`**(只有 code/market/name/decimal/trends),因此两条分时源都会走 `ensurePreClose()`:拿不到昨收就用实时报价的 `f60` 补,再拿不到才降级为"只显示现价、涨跌幅按 0"。

| 参数 | 说明 |
| --- | --- |
| `secid` | 同 K 线接口,由 `toSecid` 转换 |
| `ndays=1` | 返回最近交易日的当日分钟线 |
| `fields2` | 日期时间,开,现价,最高,最低,成交量(手),成交额,均价(`f51`~`f58`) |

返回 `data.preClose`(昨收)与 `data.trends[]`(每分钟一条 CSV 行),两源统一解析为:

```ts
interface TrendPoint { time: string; price: number; avg: number; volume: number; ts: number; }
interface TrendData { preClose: number; points: TrendPoint[]; }
```

### 九日分时接口(`fetchNineDayTrends`)

东方财富 `trends2` 的 `ndays` 最多 5 日,无法覆盖 9 个交易日,因此改用 **1 分钟 K 线**,并做双源回退:

**腾讯(主源)**:`ifzq.gtimg.cn/appstock/app/kline/mkline?param=sh515180,m1,<anchor>,800`

| 参数 | 说明 |
| --- | --- |
| `param` | `代码,m1,锚点时间,根数`;单页最多 800 根 ≈ 3.3 个交易日,按页首时间戳向前翻页 |
| 返回 | `data.<code>.m1[]`,每行 `[yyyymmddHHmm, 开, 收, 高, 低, 成交量(手)]` |
| 分页 | 首次/手动刷新/切股时翻页拉到 10 个交易日;盘中轮询只补最近 320 根,历史日走缓存 |
| 昨收 | 前一交易日最后一分钟收盘价;最新交易日优先用 `prec`(已除权除息) |

**东方财富(备用源)**:同 K 线接口,`klt=5&fqt=1&beg=0&end=20500101&lmt=600`(5 分钟粒度)

- `fqt=1` 前复权,跨除权除息日价格口径一致,昨收取前一交易日最后一根收盘价即可;
- 网格内每个交易日独立建 chart(不复用 K 线主图),1 分钟粒度下 241 个点恰好覆盖 4 小时交易时长。

多取几日用于推算每个展示日的昨收,再取最后 9 个交易日:

```ts
interface NineDayTrendDay {
  date: string;   // yyyymmdd(腾讯) / YYYY-MM-DD(东方财富)
  label: string;  // "10-16 周五"
  preClose: number; last: number; chg: number; // 涨跌幅 %
  points: NineDayPoint[];
}
interface NineDayPoint { time: string; price: number; avg: number; volume: number; ts: number; }
```

- 均价线用**当日累计成交额 / 累计成交量**近似(每根收盘价 × 成交量);
- 数据按日期**倒序**存放,最新交易日在网格左上角;头部报价取 `nineDayTrend[0]`;
- 网格布局可在工具栏切换:`3×3` 三列,`2×4` 两列;两者单元格均最低 500px,视口放不下时容器内纵向滚动;
- 每格底部展示分钟量柱,颜色随该分钟涨跌(首根相对昨收);
- 两个接口均返回 `Access-Control-Allow-Origin: *`,浏览器可直接请求。

### 请求时机

- `watch([currentCode, frequency], () => loadData())` — 切换股票或周期时重新拉取(回调必须箭头函数包装:`loadData` 首参是 `silent`,直接传引用会把 watch 的 newVal 数组误当 `silent`);
- 分时类视图(当日分时 / 近九日)下,盘中(周一~五 9:15-11:35 / 12:55-15:05)每 5 秒静默轮询一次(`silent=true` 不触发 loading);上一次请求未完成时跳过本轮,避免请求堆积;
- **限流防护**(`Failed to fetch` 的根因就是请求过密被拒连),分时轮询分两级:
  - **整段分钟线只在一分钟切换时重拉**:`currentMinuteKey()` 与 `lastFullTrendKey` 比较,跨分钟才 `loadData(true)`(多股一次拉齐全部自选,一分钟才 7 个请求);且**跨分钟后先等 `FULL_PULL_DELAY_SEC`=3 秒** —— 服务端常常还没生成新的一根,拉早了曲线会整整慢一分钟;
  - **滞后补拉**:`lastTrendMinute`(数据里最新一根的时刻)比 `currentHhmm()` 还旧、且处于连续竞价时段时,每 15 秒补拉一次,直到追上当前分钟;
  - **两次之间只刷实时报价**:`refreshIntradayQuote()` 走东财 `stock/get`(一次几十字节),更新头部现价/涨幅;多股每轮只轮转 `MULTI_POLL_BATCH`(2)只(`multiPollCursor` 轮转),九日视图跳过这级;
  - **休市自动静默**:每次拿到行情都 `noteDataDate()` 记录行情所属日期;连续 `STALE_QUIET_MS`(3 分钟)都不是今天,就判定节假日/停市,降到 `QUIET_PROBE_MS`(60 秒)由 `probeTradingDay()` 只探 1 个请求(当前个股分时),一旦探到今天立即恢复正常刷新(靠行情日期自愈,不依赖节假日表);
  - 页面在后台(`document.hidden`)不发请求;
  - 轮询失败按 2 的幂指数退避(`pollFailures` / `nextPollAt`,最长 60 秒),成功一次即复位;**K线模式的 `refreshLiveQuote()` 失败也同样进退避**;
  - 轮询失败(`silent=true`)**只提示不清空**:图表保留上一次的走势,错误文案会附带「稍后自动重试」;
- K线视图(日/周/月)下同样每 5 秒刷新一次实时报价(`fetchLiveQuote`),只更新头部与最后一根K线,不重拉整段历史;
- 点击"刷新"按钮手动拉取(模板里必须写 `@click="loadData()"`,否则事件对象会被当 `silent` 传入);
- 左侧「观望/持有」标签需要每只自选的日K数据:`onMounted` 后台为全部自选各拉一次日K(不阻塞首屏),之后切到日K/手动刷新时顺带更新当前股票;新增自定义自选时自动补拉;盘中另由 `refreshSideBarsIfDue()` 每 `SIDE_BARS_REFRESH_MS`(3 分钟)轮转补拉一只,不再一整天停在开盘状态;
- `onMounted` 时首次加载(先 `nextTick` 等容器完成布局再创建图表)。

## 四、图表实现(lightweight-charts)

### 三区布局

通过各 series 的 `scaleMargins` 在同一个 chart 实例内划分纵向区域(`constants.ts`):

| 区域 | priceScaleId | scaleMargins | 内容 |
| --- | --- | --- | --- |
| 主图 | 默认 | `top: 0.05, bottom: 0.52` | K线 / 走势线 + MA + 成本线 + 买卖点 |
| 成交量 | `volume` | `top: 0.55, bottom: 0.28` | 量柱 + 均量线 |
| MACD | `macd` | `top: 0.78, bottom: 0` | DIF/DEA 线 + MACD 柱 + 零轴虚线 |

### 指标计算(组件内实现)

- `calcMA`:简单移动平均,数据不足周期的前置点返回 `undefined`(以 whitespace 占位、不绘制);
- `calcMACD`:标准 `(12, 26, 9)`,`DIF = EMA12 - EMA26`,`DEA = EMA9(DIF)`,柱 = `(DIF - DEA) × 2`;
- 均线结果缓存于 `maCache`,供图例取值,避免十字光标移动时重算。

### 关键交互逻辑

- **`renderSeries()`**:把 `bars` 填充进所有 series;数据超长时用 `setVisibleLogicalRange` 只展示最近 `VISIBLE_BARS`(120)根,视窗右端停在最新一根;同时 `fixRightEdge: true` 锁住右边界——**最新一根之后(未来)不能再往右滚动**,只能在历史区间里拖动/缩放;再配 `rightBarStaysOnScroll: true`,滚轮/双指缩放时右侧偏移保持不变,**当前时间那根始终贴在右端不会被缩走**;末尾恢复三区布局并清空分时残留;
- **`rebuildMainSeries()`**:切换 K线/走势 时销毁重建主图 series,并**同步重建均线**——保证均线绘制层级始终位于 K 线之上(lightweight-charts 按 series 创建顺序绘制);分时模式下无主图 series,直接跳过;
- **十字光标联动**:`subscribeCrosshairMove` 中按 `param.time` 反查 `bars` 下标,更新 MA 图例;`param.time` 为空(移出图表)时回退到最新一根;分时模式下改经 `trendPointMap` 反查分钟点、更新分时图例;
- **自适应**:ResizeObserver 监听容器尺寸,手动 `applyOptions` 更新图表宽高(`autoSize: false`)。

### 分时模式

与 K 线共用同一个 chart 实例,靠"主图 series 增删 + 区域 margins 切换"实现模式互斥:

| 要素 | 实现 |
| --- | --- |
| 现价线(蓝) | `trendPriceSeries`,`lineWidth: 2`,挂主图默认坐标系,后建以绘制在上层 |
| 均价线(黄) | `trendAvgSeries`,`lineWidth: 1`,先建在下层 |
| 昨收基准线 | 灰色点线价格线,挂在 `trendPriceSeries` 上,每次渲染前先移除旧线 |
| 分钟量柱 | 复用 `volumeSeries`,色 = 现价 vs 前一分钟(首点 vs 昨收)的红绿 |
| 三区布局 | `TREND_MAIN_MARGINS` / `TREND_VOLUME_MARGINS` / `TREND_MACD_MARGINS`,K 线模式恢复原三区 margins |
| 隐藏 K 线内容 | 移除 `mainSeries`(成本线随之销毁),MA/均量线 `setData([])`,MACD 副图改填分钟数据 |
| 压缩时间轴 | 伪时间戳 = `Date.UTC(y, m, d, 9, 30) + i×step` 秒,241 个 1 分钟点恰好等于 4 小时交易时长,午休不留空档;`trendPointMap` 把伪时间戳映射回真实 `HH:mm` |
| X 轴固定整日 | `trendDaySlots()` 按固定时钟网格生成 **09:30 → 15:00** 的槽位(1 分钟粒度 241 个),首点先对齐时钟网格再向前回推,数据从盘中才开始也补齐左侧空白;`fillTrendSlots()` 把尚未走到的分钟填成 whitespace(占位置但不绘制);`pinTrendAxis()` 用 `setVisibleLogicalRange` 把可视范围钉在整段槽位上,并左右各留约 30px 空白,避免首尾的顶底标记文字被边缘裁掉 |
| 时间轴格式化 | `formatTickMark` / `formatCrosshairTime` 统一 dispatcher:分时查 `trendAxisLabels`(整天槽位都登记,空白分钟也有 `HH:mm`)返回真实时刻,K 线按 `TickMarkType` 输出 年/月/日(创建图表时一次性设置,`applyOptions` 无法把 formatter 重置回默认) |
| 图例 | `updateTrendLegend`:现价 / 均价 / 时间 / 相对昨收涨跌幅,随十字光标变化,移出回到最新一分钟 |
| 只读交互 | 所有分时视图(个股主图 / 多股小窗 / 九日小窗)都是纯展示:`handleScroll` / `handleScale` 关闭,滚轮缩放、拖拽平移、坐标轴拉伸全部禁用,只保留十字光标读数;`renderSeries()`(切回 K 线)重新打开 |
| 自动刷新 | `isTradingTime()` 守卫 + 5s `setInterval`,仅交易时段拉取,请求未完成时跳过本轮;分时视图重拉数据,K线视图只刷新实时报价;`onMounted` 启动、`onBeforeUnmount` 清理定时器 |

### 分时顶底信号

作用于三个分时视图:个股主图、多股网格、近九日网格里的每个小窗分别调用 `calcZigZagPeaks()` 重算。个股的标记挂在 `trendPriceSeries` 上并同步头部列表;多股则挂在各小窗的 `priceSeries` 上,标题栏显示最近一条信号,网格上方的 `.multi-signal-list` 再把 `MULTI_SIGNAL_WINDOW_MIN`(5)分钟内**出现**的信号按自选顺序汇总成「名称:顶/底 价格 时间」;九日窗口同样挂在各日 `priceSeries` 上,因小窗较窄只显示「顶/底」、不带价格文字以避免重叠。

> **时间口径**:`TrendPeak` 有两个时间 —— `ts/time` 是极值(图上箭头)所在分钟,`confirmTs/confirmTime` 是反向摆动达到阈值、信号真正**出现**的那一分钟,两者常差好几分钟。5 分钟窗口按 `confirmTs` 判断(否则刚确认的信号会因为极值在几分钟前而被滤掉,列表一直是空的);列表里同时显示极值时间与「N 分钟前确认」。

采用 **ZigZag 摆动结构**,判定流程:

1. **自适应阈值**:`摆动阈值 = 当日振幅 × TREND_PEAK_RANGE_RATIO`,夹在 `TREND_PEAK_MIN_SWING`(0.5%)与 `TREND_PEAK_MAX_SWING`(1.2%)之间,且不少于 `TREND_PEAK_MIN_TICKS`(3)个报价单位。高波动日自动提高门槛,低价 ETF 的 tick 下限会自动抬高阈值;
2. **摆动确认**:上升段持续跟踪最高价,从最高点回落达到阈值即确认顶;下降段持续跟踪最低价,从最低点反弹达到阈值即确认底。标记位置就是被反向摆动确认的真实极值,不需要右侧固定窗口;
3. **收盘补点**:收盘后(最后一分钟 ≥ 15:00)若最后一个极值右侧已回撤/反弹到阈值的一半,补标为当日最终顶/底。盘中不输出,避免用未走完的行情猜顶底;
4. **间隔过滤**:相邻顶底间隔不足 `TREND_PEAK_MIN_GAP`(5 分钟)时,只有摆动达到阈值的 `TREND_PEAK_STRONG_SWING_MULT`(1.5)倍(强反转)才保留;
5. **数量上限**:单日最多 `TREND_PEAK_MAX_COUNT`(8)个;超过时按「突出度」(与前后相邻转折的较小摆动距离)反复删除最不显著的点,保证图上只留主波段。

与旧实现的区别:旧版要求候选点后 8 分钟内出现 MACD 死叉/金叉才确认,实测会漏掉当日真正的最高/最低(价格创新高时 DIF 往往尚未转向);同时 0.5% 的失效阈值无法让「只低一个 tick」的新低推翻前一个假底,导致标记停在旧位置。ZigZag 以价格结构为准、不再把 MACD 作为硬性门槛,漏标和位置偏移一并解决。

标记挂在 `trendPriceSeries` 上(顶=绿色下箭头、底=红色上箭头,与买卖点同一套 A 股配色),箭头文字同时展示信号价格(如「顶 1.234」,保留 3 位小数);`renderSeries`(K线模式)与空数据分支会清空标记,防止跨模式残留。头部 `.head-signals` 展示最近 `TREND_PEAK_MAX_SHOW`(4)条,最新在前;头部列表、图上标记与多股标题栏三处都带当时价格。

**日K顶底**有「价格顶底 / 均线顶底」两种标准,工具栏在日K周期下切换(`dailyPeakMode`,默认价格顶底),结果统一存于 `dailyPeaks`,与交易计划买卖点合并到同一组 markers 后按日期升序设置(标记文字同分时一样带收盘价);周K/月K 暂不显示。

- **价格顶底(`calcTrendPeaks` + `DAILY_PEAK_*`,默认)**:窗口 5 个交易日、MACD 确认 5 日、最小摆动 2%、间隔 3 日,并**关闭失效过滤**——历史回看时若沿用"被后续新高/新低撤销"的规则,多年数据里的历史顶底几乎都会被最终行情抹掉。
- **均线顶底(`calcMaPeaks`)**:MA20 在 ±3 天窗口内由升转降标顶、由降转升标底;均线走平时只取第一次;标记位置回溯到相邻拐点之间的收盘价最高/最低点,避免均线滞后又偏离价格极值;相邻信号至少间隔 5 个交易日。以趋势为锚、天然过滤小波动,代价是滞后约半个均线周期。

两种标准共用一条强调规则:当前顶与上一个顶相距 ≤ `DAILY_PEAK_TOP_EMPHASIS_GAP`(10)个交易日时,第二个顶使用更深的绿色(`TOP_EMPHASIS_COLOR`),提示短时间连续冲顶。

### 近九日分时与多股窗口

两者都使用 `createMiniTrendChart()` 创建独立迷你 chart(现价/均价双线 + 昨收虚线),与主图互不影响;九日窗口额外传入 `withVolume = true`,用独立 `priceScale` 在下方划出量柱区与 MACD 副图(`MINI_TREND_*_MARGINS`),MACD 由 1 分钟价格序列按 EMA12/26/DEA9 计算;两处都复用与当日分时相同的 ZigZag 顶底算法(`calcZigZagPeaks`),九日窗口的标记挂在各自 `priceSeries` 上。迷你窗一律为只读视图(创建时就关掉 `handleScroll` / `handleScale`,不支持滚轮缩放、拖拽平移与坐标轴拉伸,只保留十字光标),时间轴由 `pinTrendAxis()` 钉在 09:30-15:00:

- **多股**:以股票代码为 key,`ensureMultiCharts` 惰性建图,`renderMultiTrendCharts` 填充当日分时、计算顶底并写入各小窗标记与标题栏信号;
- **近九日**:以 `yyyymmdd` 为 key,`ensureNineDayCharts` 建图并清理已不展示的旧窗口,`renderNineDayCharts` 填充各日数据;
- 窗口容器用函数式 ref 收集到 `Map`,配合 `v-show` 避免销毁重建;`autoSize: true` 让库自管尺寸;
- 九日视图的伪时间戳同样登记进 `trendPointMap`,时间轴与十字光标复用 `formatTickMark` / `formatCrosshairTime`。

## 五、交易计划文档(markdown 即数据源)

- 通过 `import.meta.glob("./plans/*.md", { query: "?raw", eager: true })` 在构建期把所有计划文档导入为字符串,**IDE 里改 md 后 HMR 自动同步**;
- 当前股票对应 `plans/<code>.md`(如 `plans/sh.515180.md`),不存在时显示 `el-empty` 占位;
- 用 `marked` 渲染为 HTML(`v-html`),弹窗内配有一套 `:deep()` 排版样式。

### 买卖点自动提取

`parseTrades` 从 markdown 原文提取 **`## 操作记录`** 小节下的表格:

- 以 `^##\s+` 切分小节后找到"操作记录"段;
- 逐行拆 `|`,只保留**日期列符合 `YYYY-MM-DD`** 的行——天然跳过表头、`| ---- |` 分隔行、空行和 HTML 注释;
- 动作含"卖"→ 绿色下箭头(S),含"买"→ 红色上箭头(B),按时间升序后 `setMarkers`。

`toBarTime` 负责日期映射:周K/月K 下原始日期不一定存在数据中,映射到**不晚于该日期的最后一根 K 线**;早于数据起点的记录不显示。

### 成本线与覆盖层刷新策略

- 成本价来自 `STOCKS` 中每只股票的 `cost` 字段(`0` 表示未持仓,不画),以橙色虚线价格线挂在主图 series 上;
- `applyOverlays()` 统一负责成本线 + 买卖点的(重)画;
- `watch(planContent, applyOverlays)` — 只改了 md 或成本时**无需重新拉行情**,直接重画覆盖层;而 `renderSeries` 末尾也会调用它,覆盖"主图 series 重建后原有挂载失效"的场景。

## 六、自定义自选

左侧列表 = 内置 `STOCKS` + 用户自定义项。自定义项只存浏览器 `localStorage`(键名 `CUSTOM_STOCKS_KEY`,`stockTrend.customStocks`),不修改源码:

- **添加**:点击侧栏标题右侧「+ 添加」,填写代码、名称、成本价(可选,0 表示未持仓)。代码支持 `sh.515180` / `sh515180` / 纯 `515180`;纯数字按号段推断市场(`5/6/9` → 沪、`4/8` → 北、其余 → 深)。添加成功后自动切换到该标的。
- **移除**:自定义项悬浮时显示 `×`,确认后从列表和 localStorage 删除,并清理对应的多股窗口;内置项不显示移除按钮。
- **持久化**:启动时读取 localStorage 并做结构校验,数据损坏时退回空数组;写入失败(隐私模式等)静默忽略。
- **联动**:`stockList` 为 computed,左侧列表、多股分时网格、报价与数据加载都遍历它,新增标的无需改代码。
- **观望/持有标签**:`sideBars` 按代码缓存每只自选的日K,`sideTags` computed 复用日K顶底算法取 `list.at(-1)`——最近信号为顶显示绿色「观望」,为底显示红色「持有」;日K顶底标准(价格/均线)切换时标签自动重算,无需重新请求。

## 七、配套常量(`constants.ts`)

| 常量 | 内容 |
| --- | --- |
| `STOCKS` | 内置自选列表:`{ code, name, cost }`,code 为 baostock 格式(`sh.`/`sz.` 前缀) |
| `CUSTOM_STOCKS_KEY` | 自定义自选的 localStorage 键名(`stockTrend.customStocks`) |
| `UP_COLOR` / `DOWN_COLOR` | `#ef232a` / `#089981`,A股习惯:红涨绿跌 |
| `MAIN_MARGINS` / `VOLUME_MARGINS` / `MACD_MARGINS` | 三个图表区域的纵向占比 |
| `MA_CONFIG` | 主图均线周期与颜色:7 / 21 / 55 / 110 / 220 |
| `VOL_MA_CONFIG` | 均量线:20(橙)/ 250(灰) |
| `VISIBLE_BARS` | 默认一屏显示 120 根 |
| `TREND_PRICE_COLOR` / `TREND_AVG_COLOR` | 分时现价线(蓝 `#409eff`)/ 均价线(黄 `#f0a020`) |
| `TREND_MAIN_MARGINS` / `TREND_VOLUME_MARGINS` / `TREND_MACD_MARGINS` | 分时模式三区布局;主图上方留出余量给「顶」标记 |
| `TREND_POLL_MS` | 分时盘中自动刷新间隔(5 秒) |
| `MULTI_POLL_BATCH` | 多股视图每轮轮询刷新的股票数(2),降低单轮请求量 |
| `MULTI_SIGNAL_WINDOW_MIN` | 多股顶底汇总的时间窗口(5 分钟),只列窗口内出现的信号 |
| `TREND_PEAK_MIN_SWING` | 分时摆动阈值下限(0.5%),过滤横盘噪声 |
| `TREND_PEAK_RANGE_RATIO` | 摆动阈值随当日振幅放大的系数(0.3) |
| `TREND_PEAK_MAX_SWING` | 自适应摆动阈值上限(1.2%) |
| `TREND_PEAK_MIN_TICKS` | 最小摆动至少 3 个报价单位(0.001 元),适配低价 ETF |
| `TREND_PEAK_MIN_GAP` | 相邻顶底最小间隔(5 分钟) |
| `TREND_PEAK_STRONG_SWING_MULT` | 强反转豁免间隔限制的摆动倍数(1.5) |
| `TREND_PEAK_MAX_COUNT` | 单日最多展示的顶底信号数(8,超出按突出度裁剪) |
| `TREND_PEAK_MAX_SHOW` | 头部顶底信号列表最多展示条数(4) |
| `DAILY_PEAK_WINDOW` | 日K顶底局部极值窗口(点左右各 5 个交易日) |
| `DAILY_PEAK_CONFIRM_BARS` | 日K顶底 MACD 确认窗口(5 个交易日) |
| `DAILY_PEAK_MIN_SWING` | 日K相邻顶底最小摆动幅度(2%) |
| `DAILY_PEAK_MIN_GAP` | 日K相邻顶底最小间隔(3 个交易日) |
| `DAILY_MA_PEAK_PERIOD` | 日K均线顶底的均线周期(MA20) |
| `DAILY_MA_PEAK_CONFIRM` | 均线拐点确认窗口(±3 天) |
| `DAILY_MA_PEAK_MIN_GAP` | 均线顶底最小间隔(5 个交易日) |
| `DAILY_PEAK_TOP_EMPHASIS_GAP` | 连续顶的判定间隔(10 个交易日,第二个顶颜色加深) |
| `TOP_EMPHASIS_COLOR` | 连续顶的加深颜色(深绿) |
| `NINE_DAY_COUNT` | 近九日视图展示的交易日数量(9) |
| `NINE_DAY_BARS` | 东方财富备用源的 5 分钟线请求根数(600) |
| `NINE_DAY_PAGE_BARS` | 腾讯 1 分钟线单页根数(800,约 3.3 个交易日) |
| `NINE_DAY_REFRESH_BARS` | 盘中增量刷新根数(320,约 1.3 个交易日) |
| `MINI_TREND_MAIN_MARGINS` / `MINI_TREND_VOLUME_MARGINS` / `MINI_TREND_MACD_MARGINS` | 九日迷你窗口主图 / 量柱 / MACD 三区的纵向占比 |
| `MINI_TREND_PRICE_MARGINS` | 多股小窗(无量柱)的上下余量,避免最高/最低处的顶底标记被裁切 |

## 八、样式要点

- 全局遵循 **红涨绿跌** 的 A 股配色,SCSS 变量 `$up-color` / `$down-color` 与 TS 常量保持一致;
- `.chart-canvas` 用 `position: absolute; inset: 0` 填满父容器,配合 ResizeObserver 实现自适应;
- `.ma-legend` 悬浮于图表左上角,`pointer-events: none` 不阻挡图表交互;
- markdown 预览(`.plan-md`)通过 `:deep()` 覆盖标题、表格、代码块、引用块等排版。

### 移动端适配(≤768px)

- `.stock-trend` 改为纵向 flex,高度使用 `100dvh`(不支持时退回 `100vh`),`.chart-main` 底部预留 `env(safe-area-inset-bottom)`;
- 左侧自选栏变为顶部横向滚动标签栏,标题与「+ 添加」用 `position: sticky; left: 0` 固定;触屏无 hover,自定义项的 `×` 常驻显示;
- 头部报价、顶底列表、工具栏各占一行,后两者单行横向滚动并隐藏滚动条,避免换行挤压图表高度;
- 多股与近九日一律单列纵向滚动,单元格最低高度分别为 400 / 260px;九日布局切换按钮在移动端隐藏;
- 多股窗口在移动端关闭 `handleScroll` / `handleScale`,让纵向滚动手势交还页面;
- `isMobile` 由 `matchMedia("(max-width: 768px)")` 驱动,弹窗宽度在固定像素与 `92%` 之间切换,跨断点时同步多股窗口手势。

## 九、可扩展点

- 数据源:接口注释中已预留切换路径——换成 baostock(Python)后端时,只需保持返回 `StockBar[]` 结构不变;
- 新增自选:直接在页面左侧「+ 添加」录入即可(存 localStorage);若希望成为所有环境的默认内置项,再在 `constants.ts` 的 `STOCKS` 中追加条目,并在 `plans/` 下创建同名 `.md`;
- 买卖点标记的 `text` 目前固定为 `S`/`B`,数量显示(`t.qty`)已在代码中留有注释掉的实现。
