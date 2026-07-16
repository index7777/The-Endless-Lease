# ACTIVE TASK

## 任務識別

- 任務名稱：建立《無期租寓》跨任務正式規格、任務帳本與自動驗收基礎
- 建立時間：2026-07-16（Asia/Taipei）
- Git 分支：`main`
- 起始 Commit：`5108add531105c82898c2670c78e74761d184ec9`
- Git 遠端：`https://github.com/index7777/The-Endless-Lease.git`
- 任務來源：使用者當前明確要求
- 任務狀態：IN_PROGRESS

## 使用者原始要求

### R01：找回並固定保存實測退改紀錄

製作人表示找不到先前實測後要求重改的內容。要求建立可長期追蹤的正式紀錄，保留既有不可回退項目、601 進房浮空、首頁 Ambient、紅怡 demo00–demo08 語音、音效素材、阻擋 Demo 流程問題，以及交接日期／路徑矛盾。舊對話無法還原逐字內容時，必須標明是依文件重建，不能冒充製作人原話。

### R02：UI 美術最高規則與七張 Design System 基準圖

所有 UI 都是管理室實體文件／印刷品，不是一般遊戲 HUD。只能使用黑色金屬、泛黃紙張、深色木頭；固定左右欄結構、留白、共用卡片、管理室按鈕、黑色單色線稿 Icon、H1／H2／Body／Caption 四級字體、指定五色、1–2 px 細框、無 CSS 圓角、真實場景背景及行政動畫。七張圖不是參考，而是正式 Component Library；新畫面只能由 PaperPanel、BlackFrame／MetalFrame、ArchiveCard、ManagementButton、ProgressHeader、Stamp、Divider 等共用元件組裝。

### R03：2.5D Animation Bible 與 Validator

AI 圖只能是 Animation Source，不能直接播放。固定成人 256 px、門高 312 px及頭頂淨空；Ground Line、Foot Lock、雙腳中心 Pivot、Hip／肩／眼／腳 Auto Align、IK、統一引擎陰影、光影正規化與補幀。Idle／Walk／Run／Attack／Hit／Die 必須達最低幀數與完整動作階段；紅怡 50% 速度、怪物 Move/Pause、追租者只走但快玩家 5%、怪物至少 24 FPS。建立 Animation Validator，自動檢查比例、Ground、Pivot、亮度、幀率、跳幀、縮放、變形與閃爍；任一失敗即 Rejected。

### R04：跨裝置與跨任務一致性

聊天只用於理解，不得作主要製作依據。正式工作以最高規則、approved 基準、共用元件、資料表、測試與最新 Git 為準。每次開始先核對 remote／branch／commit／worktree，乾淨時才 `pull --ff-only`；建立 `docs/references/approved/` 與 `REFERENCE_INDEX.md`、Design Token、共用元件、角色尺度、動畫驗收及三解析度視覺回歸。禁止因電腦、螢幕、GPU、對話或路徑不同而改變標準。完成必須可在另一台電腦重現。

### R05：任務記錄與完成驗收最高規則

每項使用者要求先寫入 `tasks/ACTIVE_TASK.md`，拆成可獨立驗收項目，保存原始原意、修改／禁止範圍、風險與證據。實作期間定期回讀；追加要求先更新帳本。狀態只用 TODO、IN_PROGRESS、BLOCKED、NEEDS_REVIEW、VERIFIED、CANCELLED。未驗收不得宣告完成。建立 `TASK_HISTORY.md`、`tasks/sessions/` 與 `scripts/validate-active-task.mjs`，檢查未完成項、VERIFIED 證據、Placeholder、日誌與起始 Commit；`package.json` 加入 `task:check` 及 `precommit:project`。

### R06：既有優先工作

首頁 Dark Ambient 六層系統與紅怡 demo00–demo08 語音最優先；先修阻擋遊戲進行的 bug。正式音效素材庫仍須依製作人附件規格完成來源、授權、分層、音量、EQ、空間與驗證，但因阻擋流程修正而暫停。

### R07：建立可供另一台電腦 Sync 測試的版本

製作人詢問「我可以 sync 測試？」。本輪必須先確認目前變更已通過必要測試、沒有憑證或未辨識檔案，再建立可追溯的 checkpoint commit 並推送至正確的 `origin/main`；回報確切 commit 後，製作人才可在另一台電腦安全 Sync 測試。

## Codex 對需求的理解

- 先建立可追溯的規格、任務帳本與 Validator，再繼續大量 UI／動畫或音訊製作。
- 既有單張 AI 角色圖仍可暫時維持 Demo 運作，但一律標為 `Rejected／Prototype Only`，不能聲稱正式動畫完成。
- 七張 UI 圖必須進入 `docs/references/approved/ui/`、重新命名並寫入索引後，才是跨裝置正式基準。
- 現有工作樹含大量使用者／前序任務修改，禁止 reset、checkout、覆蓋或在不乾淨狀態強制 pull。

## 不確定或可能衝突

- 舊交接曾要求建立新 Sites，較早文件又禁止新站點；本次不處理部署，避免擴大範圍。
- UI 最高規則指定色票與跨裝置規則示例 token 有少量色碼差異；最高 UI 文件優先，Design Token 應採 UI 正式五色。
- 完整三解析度自動視覺回歸需要瀏覽器截圖基礎；本輪先建立規格與可執行入口，未產生全部基準前不得標記 VERIFIED。

## 本次必做項目

- [VERIFIED] T01：建立任務帳本最高規則並更新 AGENTS.md 最上方簡版條款。
- [VERIFIED] T02：建立 `tasks/` 固定結構與 `scripts/validate-active-task.mjs`，接入 package scripts。
- [VERIFIED] T03：集中實測回饋紀錄，修正交接日期與正式／歷史路徑判斷。
- [VERIFIED] T04：建立 UI 美術最高規則、approved 七圖與 `REFERENCE_INDEX.md`。
- [VERIFIED] T05：建立 UI Design Token 與最低共用元件庫，不改寫尚未排入的正式頁面。
- [VERIFIED] T06：建立 2.5D Animation Bible、角色 Manifest 規格與 Animation Validator。
- [VERIFIED] T07：建立集中角色尺度 `app/game/characterScale.ts` 與驗證測試。
- [VERIFIED] T08：建立跨裝置與跨任務一致性最高規則並接入必讀順序。
- [NEEDS_REVIEW] T09：驗證首頁 Ambient 與紅怡 demo00–demo08 接入未回退。
- [NEEDS_REVIEW] T10：驗證三個 Demo 阻擋流程修正及完整自動測試。
- [TODO] T11：建立視覺回歸工作的固定解析度／場景清單與執行入口。
- [TODO] T12：正式音效素材庫；保留為後續工作，不得誤標完成。
- [IN_PROGRESS] T13：建立並推送可供跨裝置 Sync 測試的 checkpoint commit。

## 每項驗收條件

### T01

- 修改內容：正式規格文件、AGENTS 簡版規則與任務紀錄流程。
- 影響檔案：`無期租寓_任務記錄與完成驗收最高規則_v1.0.md`、`AGENTS.md`。
- 完成條件：規則完整落地並列入必讀第一層。
- 測試方式：文字引用與路徑檢查。
- 驗收截圖：不適用。
- 驗收證據：`AGENTS.md` 第 3–9 行、`無期租寓_任務記錄與完成驗收最高規則_v1.0.md`；必讀引用檢查通過。
- 禁止回退：不得再以聊天摘要取代 ACTIVE_TASK。

### T02

- 修改內容：建立任務檢查器與封存結構。
- 影響檔案：`tasks/**`、`scripts/validate-active-task.mjs`、`package.json`。
- 完成條件：檢查器能偵測起始 commit、日誌、未完成必做項、VERIFIED 證據及 Placeholder；package scripts 可執行。
- 測試方式：`npm run task:check`；未完成任務應回報而非錯誤宣告完成，precommit 嚴格模式須阻擋。
- 驗收截圖：不適用。
- 驗收證據：`npm run task:check` 成功解析 12 項、起始 Commit、工作日誌與 Placeholder；因四項尚未完成而按設計阻擋。
- 禁止回退：不可刪除舊項目或覆蓋 session。

### T03

- 修改內容：建立根目錄退改紀錄；修正 v2.0 日期與路徑。
- 影響檔案：`無期租寓_實測回饋與重改紀錄_v1.0.md`、總交接、AGENTS。
- 完成條件：Git 可追蹤、必讀連結正確、日期 2026-07-16、以 remote／branch／commit／worktree 判斷版本。
- 測試方式：路徑存在、文字搜尋、`git diff --check`。
- 驗收截圖：不適用。
- 驗收證據：根目錄紀錄檔存在且受 Git 辨識；`git diff --check` exit 0；總交接最後更新為 2026-07-16。
- 禁止回退：不得只寫硬編碼電腦路徑。

### T04

- 修改內容：UI 最高規則、approved 基準與索引。
- 影響檔案：UI 規則、`docs/references/approved/ui/*`、`REFERENCE_INDEX.md`。
- 完成條件：七圖皆存在、雜湊可核對、索引含用途／沿用／禁止／版本／取代關係。
- 測試方式：檔案存在與 hash 清單。
- 驗收截圖：七張 approved 原圖。
- 驗收證據：`docs/references/REFERENCE_INDEX.md` 與七張 `docs/references/approved/ui/*.png`；七個 SHA-256 均與索引一致。
- 禁止回退：不得把 user-provided 或聊天附件當唯一基準。

### T05

- 修改內容：集中 token 與共用元件接口。
- 影響檔案：`app/design/**`。
- 完成條件：正式五色、四級字體、spacing／border／shadow／duration／z-index 集中；十個元件可由 React 引用。
- 測試方式：型別檢查與元件測試。
- 驗收截圖：本輪只建基礎庫，正式頁面重製另立任務。
- 驗收證據：`app/design/tokens.ts`、`components.tsx`、`design-system.css`；Node 24 正式 build 通過。
- 禁止回退：不新增圓角、漸層、霓虹或第四材質。

### T06

- 修改內容：Animation Bible、config、Manifest 與 Validator。
- 影響檔案：動畫最高規範、`assets/characters/**`、`tools/validate-character-animation.mjs`、`package.json`。
- 完成條件：Validator 產生 JSON／Markdown；舊單張素材列為 Rejected；正式候選任一失敗可阻擋。
- 測試方式：`npm run validate:animation`、`npm run validate:animation:strict`。
- 驗收截圖：Validator 報告。
- 驗收證據：`assets/characters/reports/validation_report.json`／`.md`；一般與 candidate strict 執行成功，`--strict` 對 22 張舊單圖按預期 exit 1。
- 禁止回退：不得把單張 AI 圖標成正式動畫。

### T07

- 修改內容：統一角色尺度表。
- 影響檔案：`app/game/characterScale.ts`、測試。
- 完成條件：player／normalAdultNpc／tallNpc／normalMonster／rentPursuer／boss 集中定義並可對門高計算。
- 測試方式：數值單元測試。
- 驗收截圖：門高比較圖列為後續視覺驗收。
- 驗收證據：`tests/character-scale.test.mjs` 兩項通過；完整測試確認遊戲渲染使用集中尺度表。
- 禁止回退：角色不得散落自行設定高度。

### T08

- 修改內容：跨裝置最高規則、必讀與 approved 流程。
- 影響檔案：跨裝置規則、AGENTS、總交接。
- 完成條件：規則列入任務第一讀取層，路徑與衝突處理明確。
- 測試方式：引用與路徑檢查。
- 驗收截圖：不適用。
- 驗收證據：`無期租寓_跨裝置與跨任務一致性最高規則_v1.0.md`、AGENTS 必讀第 3 項與 approved 索引均存在。
- 禁止回退：不得以聊天、本機路徑或 work/ 作正式來源。

### T09

- 修改內容：確認六層 Ambient 與九段紅怡語音。
- 影響檔案：既有音訊程式與測試；本階段不擴寫素材庫。
- 完成條件：九檔映射、隨機區間、首頁淡出與靜音控制測試通過。
- 測試方式：`tests/audio-director.test.mjs` 及完整測試。
- 驗收截圖：音訊不適用；仍需製作人實機聽感驗收。
- 禁止回退：不得恢復瀏覽器 TTS 或傳統首頁主題曲。

### T10

- 修改內容：6F 管理室權限、Overlay 凍結、合法返回標題與管理室離場樓層。
- 影響檔案：既有流程程式與測試。
- 完成條件：型別、建置與完整測試通過；仍標待製作人實測。
- 測試方式：`npm test`。
- 驗收截圖：後續實機流程。
- 禁止回退：不得讓 Overlay 背景繼續日租／敵人／輸入。

### T11

- 修改內容：固定三解析度與場景回歸清單／執行入口。
- 影響檔案：`tests/visual/**`、package scripts 或驗收文件。
- 完成條件：能列出或擷取 1920×1080、1366×768、手機橫向指定場景；尚無基準時清楚標 TEMP。
- 測試方式：視覺回歸指令。
- 驗收截圖：`outputs/validation/` 或正式可追蹤位置。
- 禁止回退：不得只憑肉眼口頭宣告。

### T12

- 修改內容：完整正式音效素材庫。
- 影響檔案：未開始。
- 完成條件：依附件規格完成來源、授權、清單、分層、混音參數與驗證。
- 測試方式：音訊 validator 與實機聽感。
- 驗收截圖：素材／授權報告。
- 禁止回退：不得以程式振盪音冒充正式音效。

### T13

- 修改內容：稽核工作樹、建立 checkpoint commit、推送 `origin/main`。
- 影響檔案：本輪所有已確認的程式、測試、規格、approved 基準、任務帳本與驗證報告。
- 完成條件：無秘密或未辨識檔案；測試結果已知；遠端 `main` 存在相同 commit。
- 測試方式：`git status`、秘密字串檢查、`git commit`、`git push origin main`、遠端 commit 核對。
- 驗收截圖：不適用。
- 禁止回退：不得推送 `work/` 中繼檔、發布憑證、權杖或未辨識的本機檔案。

## 本次禁止修改

- 不建立或部署 Sites 站點。
- 不執行 `git reset --hard`、`git checkout --` 或覆蓋既有工作樹。
- 不重新生成七張已批准 UI 基準圖。
- 不把現有單張 AI 角色圖改標為正式完成。
- 不在建立共用元件時順手重做所有正式頁面。
- 不修改未列入 T09／T10 的玩法、經濟或敘事規則。

## 已知風險

- 工作樹起始即不乾淨，因此本輪不能安全執行 `git pull --ff-only`。
- 現有角色動畫全部不符合新 Bible；若立即對所有舊素材啟用 strict build gate，Demo 會完全阻斷，因此舊素材先標 Prototype Only，strict gate 只接受正式候選 Manifest。
- 視覺回歸、共用元件與完整音效庫工作量大，可能需要分批封存，未驗證部分不得宣告完成。

## 新發現但不在本次範圍

- D01：舊 Sites 帳號／新站點規則互相衝突；不阻擋本次規格與驗證工作，本輪不部署。

## 工作日誌

### 2026-07-16 任務帳本建立

- 因製作人新增任務記錄最高規則，暫停其他修改。
- 核對分支 `main`、起始 commit `5108add531105c82898c2670c78e74761d184ec9` 與 origin。
- 工作樹已有前序任務修改，未執行 pull、reset 或覆蓋。
- 建立 T01–T12，尚未將任何項目標記 VERIFIED。

### 2026-07-16 開始實作

- 完整回讀 ACTIVE_TASK；確認共 12 項必做項目與六項禁止修改範圍。
- 任務狀態由 PLANNING 更新為 IN_PROGRESS。
- 開始 T01、T02：任務記錄最高規則與提交前檢查器。

### 2026-07-16 T01／T02 程式完成待驗證

- 建立任務記錄最高規則、ACTIVE TASK、TASK HISTORY 與 sessions 目錄。
- AGENTS 最上方已加入製作人指定的任務記錄強制規則。
- 建立 `scripts/validate-active-task.mjs` 並加入 `task:check`、`precommit:project`。
- 尚未執行檢查器；T01、T02 狀態為 NEEDS_REVIEW。

### 2026-07-16 T04–T08 程式完成待驗證

- 七張 UI 圖已複製到 `docs/references/approved/ui/`，固定命名並記錄 SHA-256。
- 建立 `REFERENCE_INDEX.md`、正式五色 Design Token 與十個共用 UI 元件。
- 建立集中角色尺度表，玩家由散落 270 px 調整為 Bible 指定的 256 px；普通怪物亦由集中表取得高度。
- 建立 2.5D Animation Validator 與 Manifest 規格；尚未執行。
- T04–T08 皆為 NEEDS_REVIEW，測試前不標 VERIFIED。

### 2026-07-16 自動驗收結果

- 系統預設 Node 20.16 無法建置 Vinext；依專案 Node 22.x 規則改用工作區 Node 24.14，未修改 lockfile 標準。
- Node 24.14 下正式 build 成功，23 項自動測試全部通過。
- Animation Validator 將 22 張未註冊單張 AI 圖列為 Rejected／Prototype Only；`--strict` 按預期阻擋。
- `git diff --check` 通過；七張 approved UI 圖雜湊與索引一致。
- T01–T08 具備證據，更新為 VERIFIED；T09、T10 仍等製作人實機驗收，T11、T12 尚未完成。

### 2026-07-16 追加 Sync 測試需求

- 製作人詢問是否可以 Sync 測試。
- 新增 T13，先稽核、提交並推送 checkpoint；完成前不會誤稱另一台電腦已可取得本輪內容。
