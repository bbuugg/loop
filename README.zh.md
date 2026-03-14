# Loop — Chrome DevTools 自动化面板扩展

Loop 是一个 Chrome 扩展，在 DevTools（F12）中添加 **Loop** 面板，用于在任意网页上构建、录制和回放自动化操作序列。

---

## 安装

1. 打开 Chrome，访问 `chrome://extensions`
2. 开启右上角的**开发者模式**
3. 点击**加载已解压的扩展程序**
4. 选择文件夹
5. 打开任意网页，按 **F12** 打开 DevTools，点击 **Loop** 标签页

> 扩展需要调试器权限。调试器附加时 Chrome 会在页面顶部显示提示横幅，这是正常现象。

---

## 界面说明

```
[ ▶ Run ] [ ☐ Loop ] [ ● Record ] [ Clear Steps ] [ Clear Log ] [ Export JSON ] [ Import JSON ]
────────────────────────────────────────────────────────────────────────────────────────────
  步骤面板（左侧）                              │  日志面板（右侧）
  1  跳转到 URL                               │  12:00:01  调试器已连接
     https://example.com                      │  12:00:02    → ok
  2  悬停元素  //nav/ul/li[2]                  │  12:00:03  运行完成
  3  点击元素  //*[@id="btn-login"]            │
```

---

## 步骤类型

| 类型 | 说明 |
|------|------|
| **跳转到 URL** | 将当前标签页导航到指定 URL |
| **刷新页面** | 重新加载当前页面 |
| **等待元素** | 等待 XPath 元素出现在 DOM 中（可配置超时时间） |
| **悬停元素** | 将鼠标移到元素上，触发 mouseover / mouseenter / mousemove 事件 |
| **点击元素** | 通过 CDP 鼠标事件点击元素 |
| **输入文本** | 聚焦输入框并逐字符输入文本 |
| **提取内容** | 提取元素的文本内容或指定属性值，可通过 **Save as variable** 字段将结果保存为变量 |
| **设置变量** | 设置或更新全局变量，支持字面量或 JavaScript 表达式（如 `page + 1`） |
| **滚动** | 按指定像素滚动页面或元素（X/Y 方向） |
| **等待毫秒** | 暂停执行指定毫秒数 |
| **截图** | 截取 PNG 截图，内嵌显示在日志中 |

所有定位元素的步骤均使用 **XPath** 选择器。

---

## 手动添加步骤

1. 点击步骤面板底部**添加步骤栏**中对应的步骤类型按钮
2. 弹出配置弹窗，填写所需字段：
   - **名称**（可选）：显示在步骤列表中的标签，便于识别
   - 各类型专属字段（URL、XPath、文本、超时时间等）
3. 点击 **OK** 添加步骤

### XPath 示例

```
//*[@id="login-btn"]          — id 为 login-btn 的元素
//button[text()="提交"]        — 文本精确匹配的按钮
//nav/ul/li[2]/a              — 导航第二项的链接
//*[contains(@class,"item")] — class 包含 item 的元素
```

---

## 录制步骤

1. 点击 **● Record** 开始录制
2. 在被检查的页面上点击元素，每次点击自动生成：
   - 一个**悬停**步骤（点击前最后悬停的元素）
   - 一个**点击**步骤（被点击的元素）
3. 点击 **⏹ Stop Rec** 停止录制

录制的步骤追加到当前步骤列表，可以编辑或重新排序。

> 不支持在受限页面录制（chrome://、edge://、chrome-extension://）。

---

## 运行步骤

### 单次运行
- 点击 **▶ Run** 按顺序执行所有已启用的步骤
- 运行中按钮变为 **⏹ Stop**，点击立即中止
- 每个步骤显示状态标记：运行中（蓝色）、完成（绿色）、错误（红色）
- 结果和错误显示在右侧日志面板

### 循环模式
- 勾选 **Loop** 复选框后点击 **▶ Run**
- 步骤无限循环执行，直到出现错误或点击 **⏹ Stop**
- 每轮在日志中标记：`── Loop iteration 1 ──`

### 单步执行
- 点击每个步骤行上的 **▶** 按钮，单独执行该步骤
- 适合测试或调试某个具体操作

### 执行行为
- 每个步骤执行前等待 `document.readyState === 'complete'`
- **悬停**和**点击**步骤自动等待目标元素出现（最多 10 秒）
- **等待元素**步骤等待可配置的超时时间（默认 10 秒）
- 步骤报错后立即停止，该步骤标记为红色

---

## 步骤管理

| 按钮 | 功能 |
|------|------|
| **▶** | 单独执行该步骤 |
| **⊘** | 禁用 / 启用步骤（禁用的步骤运行时跳过，显示半透明） |
| **Edit** | 打开弹窗编辑步骤参数 |
| **Del** | 删除步骤 |
| **▲ / ▼** | 向上 / 向下移动步骤 |
| **⇑** | 在此步骤前插入新步骤 |
| **⇓** | 在此步骤后插入新步骤 |

---

## 导出与导入

### 导出
- 点击 **Export JSON** 将当前步骤列表下载为 `.json` 文件

### 导入
- 点击 **Import JSON** 选择之前导出的文件
- 导入的步骤会替换当前步骤列表

### JSON 格式

```json
[
  {
    "type": "navigate",
    "name": "打开首页",
    "url": "https://example.com"
  },
  {
    "type": "hover",
    "selector": "//nav/ul/li[2]"
  },
  {
    "type": "click",
    "name": "打开菜单",
    "selector": "//*[@id=\"menu-btn\"]"
  },
  {
    "type": "waitElement",
    "selector": "//*[@id=\"dropdown\"]",
    "timeout": 5000
  },
  {
    "type": "type",
    "selector": "//input[@name=\"search\"]",
    "text": "hello"
  },
  {
    "type": "extract",
    "selector": "//h1",
    "attribute": ""
  },
  {
    "type": "waitMs",
    "ms": 1000
  },
  {
    "type": "screenshot"
  }
]
```

各类型支持的字段：

| 类型 | 字段 |
|------|------|
| `navigate` | `url` |
| `refresh` | 无 |
| `waitElement` | `selector`、`timeout`（毫秒，默认 10000） |
| `hover` | `selector` |
| `click` | `selector` |
| `type` | `selector`、`text` |
| `extract` | `selector`、`attribute`（空 = 文本内容）、`saveAs`（变量名） |
| `setVar` | `varName`、`varExpr` |
| `scroll` | `selector`（可选）、`deltaX`、`deltaY` |
| `waitMs` | `ms` |
| `screenshot` | 无 |

所有步骤可选填 `name`（字符串）、`disabled`（布尔值）、`onError`（`stop` / `continue` / `goto`）、`onErrorGoto`（目标步骤 ID）。

---

## 全局变量

**变量面板**（位于步骤列表和日志之间）用于定义全局变量，可在任意步骤字段中通过 `{变量名}` 引用。

### 定义变量

- 点击变量面板标题栏的 **+** 按钮，输入变量名（字母、数字、下划线）
- 直接在输入框中编辑变量值
- 点击 **✕** 删除变量

### 在步骤中使用变量

任意步骤字段均支持 `{变量名}` 替换：

```
Navigate URL:  https://example.com/page/{page}
输入文本:       {username}
XPath:         //li[{index}]
```

### 设置变量步骤（Set Var）

在执行过程中动态修改变量值：

| 字段 | 示例 | 说明 |
|------|------|------|
| 变量名 | `page` | 要设置的变量名 |
| 值或表达式 | `1` | 设置为固定值 |
| 值或表达式 | `page + 1` | 在当前值基础上加 1 |
| 值或表达式 | `"https://example.com/" + page` | 字符串拼接 |
| 值或表达式 | `page > 5 ? "done" : "continue"` | 条件表达式 |

表达式为标准 JavaScript，所有已定义变量均可直接引用。

### 提取内容并存为变量（Extract + Save as variable）

在 Extract 步骤的 **Save as variable** 字段填入变量名，提取结果会自动写入该变量，变量面板实时更新。

### 导出与导入

JSON 文件同时保存步骤列表和变量：

```json
{
  "steps": [...],
  "vars": {
    "page": "1",
    "username": "admin"
  }
}
```

---

## 常见问题

**「Failed to start recording」**
页面可能是受限页面（chrome://、edge://），或扩展需要重新加载。前往 `chrome://extensions` → Loop → 点击刷新图标。

**「Element not found」**
XPath 在超时时间内未匹配到任何元素。在浏览器控制台验证 XPath：
```js
document.evaluate('//your/xpath', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
```

**页面顶部出现调试器横幅**
这是正常现象。Chrome 在 DevTools 扩展附加调试器时会显示提示，关闭 DevTools 或运行结束后消失。

**步骤执行了但页面没有反应**
部分网站使用 React/Vue 合成事件，可能不响应 CDP 鼠标事件。尝试在交互步骤前添加**等待元素**步骤，或检查 XPath 是否指向了正确的元素。
