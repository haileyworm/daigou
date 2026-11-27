# 🛍️ 代購商品登記單 — 從零開始設定教學

> 網站放在 **GitHub Pages**（免費），資料存在 **Google Firebase Firestore**（免費 Spark 方案）。
> 還沒設定 Firebase 前，網站會用「示範模式」跑，資料只存在你自己的瀏覽器，可以先玩玩看。

---

## 📁 檔案說明

| 檔案 | 用途 | 你需要改嗎？ |
|---|---|---|
| `js/config.js` | 網站名稱、賣家 Email、Firebase 金鑰 | ✅ 一定要改 |
| `firestore.rules` | 資料庫安全規則（誰能看、誰能改） | ✅ 改 Email 後貼到 Firebase |
| `index.html` | 頁面骨架、LINE 預覽設定、首頁插圖預留區 | ✅ 改 LINE 預覽網址 |
| `css/theme.css` | **風格設定（顏色、線條、圓角、字型）** | 想換風格時改 |
| `css/app.css` | 細部版面 | 通常不用 |
| `js/app.js` | 主程式 | 不用 |
| `js/data.js` | 連接 Firebase | 不用 |
| `js/illustrations.js` | 卡片內建 SVG 插圖 | 想加插圖時改 |
| `og-image.png` | LINE 分享時的預覽圖（1200×630） | 可換成自己的 |

---

## 步驟 1：建立 Firebase 專案

1. 打開 <https://console.firebase.google.com/> → 用你的 Google 帳號登入
2. 按 **「建立專案」** → 取名（例如 `daigou`）→ Google Analytics 可以關掉 → 建立
3. 專案首頁按 **「</>」（網頁）** 圖示新增網頁應用程式 → 取個暱稱 → **不要**勾 Firebase Hosting → 註冊
4. 畫面會出現一段 `const firebaseConfig = { apiKey: ..., ... }` → **先複製起來**（步驟 4 會用到）

## 步驟 2：開啟 Firestore 資料庫

1. 左側選單 **建構 → Firestore Database** → **建立資料庫**
2. 位置選 **asia-east1（台灣）**
3. 先選 **「以正式版模式啟動」** → 建立
4. 上方切到 **「規則」** 分頁：
   - 打開本專案的 `firestore.rules`，把 `YOUR_EMAIL@gmail.com` 換成**你的 Google 帳號**
   - 全部複製，貼上覆蓋原本內容 → **發布**

## 步驟 3：開啟登入功能

左側 **建構 → Authentication** → **開始使用** → 「Sign-in method」分頁：

1. 啟用 **Google**（賣家登入用）→ 選你的 Email 當支援信箱 → 儲存
2. 啟用 **匿名（Anonymous）**（客人不用登入就能登記，靠這個辨識「這是誰的登記」）

> 客人只要用同一支手機、同一個瀏覽器，就能修改或取消自己還沒被審核的登記。

## 步驟 4：填設定檔

打開 `js/config.js`：

```js
export const SITE = { name: '小昕代購登記所', tagline: '想要什麼，先登記起來吧！' };
export const OWNER_EMAIL = '你的帳號@gmail.com';      // ← 跟 firestore.rules 一樣
export const FIREBASE_CONFIG = { ... };                // ← 貼上步驟 1 複製的內容
```

## 步驟 5：上傳到 GitHub 並開啟 GitHub Pages

1. 到 <https://github.com/new> 建立新的 repository，名稱例如 `daigou`，設 **Public**
2. 在新 repo 頁面按 **「uploading an existing file」** → 把整個資料夾內的檔案**連同 `css`、`js` 資料夾**一起拖進去 → Commit changes
3. repo 的 **Settings → Pages** → Source 選 **Deploy from a branch** → Branch 選 `main` / `(root)` → Save
4. 等 1～2 分鐘，網址會是：`https://你的GitHub帳號.github.io/daigou/`

## 步驟 6：讓 Firebase 允許你的網址＋設定 LINE 預覽

1. Firebase → **Authentication → 設定 → 授權網域** → 新增 `你的GitHub帳號.github.io`
   （沒加的話，Google 登入會失敗）
2. 打開 `index.html`，把這兩行的 `YOUR_GITHUB_NAME` 換成你的 GitHub 帳號（repo 名不是 daigou 的話也要改）：
   ```html
   <meta property="og:url"   content="https://YOUR_GITHUB_NAME.github.io/daigou/">
   <meta property="og:image" content="https://YOUR_GITHUB_NAME.github.io/daigou/og-image.png">
   ```
   標題、說明也可以順便改 `og:title`、`og:description`
3. 上傳修改後的檔案到 GitHub（在 GitHub 點檔案 → ✏️ 編輯 → Commit 也可以）
4. 想確認 LINE 預覽：用 [LINE Page Poker](https://poker.line.naver.jp/) 貼上網址，可清除 LINE 的預覽快取

> 每個代購分享出去的預覽圖都是同一張 `og-image.png`（GitHub Pages 是靜態網站，無法依每個代購換圖）。

---

## 🧑‍💼 賣家使用方式

### 登入
右上 **☰ → 🔑 賣家登入** → 選你的 Google 帳號。
⚠️ **LINE 內建瀏覽器無法 Google 登入**，按登入時網站會自動改用手機的 Safari / Chrome 開啟。

### 新增代購
首頁 **＋ 新增代購** → 輸入標題 → 自動進入「商品清單」。
新建的代購預設 **🙈 不公開**，整理好再到首頁卡片上按一下變成 **👀 公開中**。

### 首頁卡片上的權限控制（只有你看得到）
| 控制 | 效果 |
|---|---|
| 狀態：**代購進行中** | 客人可以看、可以登記 |
| 狀態：**純檢視中** | 客人只能看商品與登記總覽，不能登記 |
| 狀態：**已結束・鎖定** | 客人只看得到卡片，點了進不去 |
| **公開 / 不公開** | 不公開時客人在首頁完全看不到這張卡片 |

### 分頁 1：商品清單
- **上半部固定區域**：標題、代購說明、外幣幣別、匯率（下方會即時試算）、卡片封面 → 按 **儲存設定**
- 封面：選 5 種內建 SVG 插圖之一，或 📷 上傳自己的圖片
- **＋ 新增商品**：圖片（上傳或貼網址）、名稱、可登記數量、候補最高總數（非必填）、外幣金額 → 台幣自動算（外幣 × 匯率，四捨五入）
- ↑ ↓ 調整商品順序；🔗 **複製分享連結** 可直接貼到 LINE

> 上傳的圖片會自動壓縮後存進資料庫（Firebase 免費方案不支援 Storage，所以這樣做）。

### 分頁 2：登記清單
**「登記欄位設定」**：決定客人每一項要填什麼
| 格式 | 說明 |
|---|---|
| 輸入欄（文字／數字） | 一般填寫 |
| 下拉選單 | 讀取商品清單的某一欄（商品名稱／台幣金額／外幣金額）。**至少要有一個**，用來知道客人選哪個商品 |
| 日期 | 日期選擇器 |
| 金額 | 自動抓商品的台幣金額，可設定乘上某個數量欄；客人不能改 |

改完按 **儲存欄位設定**。登記人姓名是固定欄位，不用另外加。

**「審核登記」**：
- 每一項可以 **通過 / 拒絕**，也可以 **整筆通過 / 整筆拒絕**
- 拒絕時會請你填原因 → 客人在總覽上會看到「未通過」與原因
- **重設為待審核** 可以反悔；被拒絕的項目**不會**佔用商品名額
- 一旦開始審核，客人就不能再自己修改那筆登記

### 分頁 3：商品&登記總覽
跟客人看到的一模一樣。也可以從 ☰ 開 **👀 用客人視角預覽**，整個網站切換成客人看到的樣子。

---

## 🙋 客人看到的

- **登記表**：填登記人 → 每一項選商品、數量… → **＋ 再登記一項** 可一次登記多項 → 送出後自動跳到登記總覽
  - 選商品時會顯示「還可登記 N 個／候補剩 M 個」，額滿的商品不能選
- **商品&登記總覽**
  - 登記總覽：所有人的每一項、審核狀態、未通過原因；預設依**最後編輯時間 舊→新**，可改排序（時間／商品名稱）
  - 商品總覽：商品、價格、已登記數、剩餘、候補進度條
  - 自己還沒被審核的登記可以 **修改** 或 **取消登記**

---

## 🌙 免費額度用完時

Firebase 免費方案每天有讀寫上限（每天約 5 萬次讀取、2 萬次寫入）。
用完時，程式會攔截 Firestore 的 `resource-exhausted` 錯誤，顯示**無法關閉**的全螢幕提示：

> 今天的免費用量已滿，預計 11/28（六）16:00 後恢復，請到時重新整理。

額度是在**美國太平洋時間午夜**重置，台灣時間是 **16:00**（美國夏令時間期間是 **15:00**），網站會自動換算並倒數。
👉 想先看看長什麼樣子：在網址後面加 `?quota-test`，例如 `https://你的帳號.github.io/daigou/?quota-test`

用量可以在 Firebase → Firestore → **用量** 分頁查看。

---

## 🎨 之後想換風格

全部集中在 **`css/theme.css`**：

```css
--paper: #FFFCF6;   /* 底色 */
--ink:   #3E3A39;   /* 線框與文字 */
--line:  3px;       /* 線條粗細 */
--coral / --yellow / --water / --green   /* 主題四色 */
--r-lg / --r-md / --r-sm                  /* 圓角大小 */
--shadow: 4px 4px 0 var(--ink);           /* 貼紙感陰影，不要的話改成 none */
--font: 'Huninn', ...                     /* 字型 */
--speed: .45s;                            /* 彈跳動畫速度 */
```

換字型時，`index.html` 裡 Google Fonts 那行的 `family=Huninn` 也要一起換。

### 首頁插圖
`index.html` 裡有一段：
```html
<template id="hero-art-template">
  <!-- 在這裡貼上 SVG -->
</template>
```
把 `<svg …>…</svg>` 貼進去就會顯示在首頁標題旁（手機上在標題下方），建議比例 16:9。

### 卡片插圖
`js/illustrations.js` 照現有格式加一組即可，會自動出現在封面選單裡。

---

## ♿ 減少動態效果
- 手機／電腦有開「減少動態效果」（iPhone：設定 → 輔助使用 → 動態效果）時，彈跳動畫會自動關掉
- 也可以在網站 ☰ 選單裡手動開關 🐢 **減少動態效果**

## ❓ 常見問題
| 狀況 | 解法 |
|---|---|
| Google 登入跳錯誤 `auth/unauthorized-domain` | 步驟 6-1 沒加授權網域 |
| 客人畫面一直轉圈、跳錯誤 | 檢查步驟 3 有沒有開「匿名」登入 |
| 「沒有權限執行這個動作」 | `firestore.rules` 和 `config.js` 的 Email 不一致，或規則沒按發布 |
| LINE 預覽還是舊的 | 用 LINE Page Poker 清快取 |
| 想清掉示範模式的資料 | 瀏覽器開發者工具 → Application → Local Storage → 刪掉 `daigou-demo-v1` |
