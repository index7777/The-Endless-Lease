# 《無期租寓》正式音訊索引

## 使用中的專案原創環境音

以下 WAV 由 `scripts/generate-environment-audio.py` 程序生成，沒有第三方錄音或音樂取樣；授權歸專案，可隨遊戲散布。

| 場景 | 檔案 | 內容 | 播放規則 |
|---|---|---|---|
| 一般樓層 | `public/audio/ambience/floor-common-v1.wav` | 日光燈、管線、建物低頻 | 持續、低音量 |
| B1 | `public/audio/ambience/b1-machinery-v1.wav` | 地下機械、滴水、通風 | 持續、低音量 |
| B2 | `public/audio/ambience/b2-records-v1.wav` | 紙張、檔案庫通風、低頻 | 持續、低音量 |
| 電梯 | `public/audio/ambience/elevator-cabin-v1.wav` | 馬達、繼電器、金屬轎廂 | 進入轎廂後持續 |
| 管理室 | `public/audio/ambience/management-office-v1.wav` | 掛鐘、室內電流、遠距紙張 | 管理室內持續 |

首頁的 Drone、空調、日光燈、電梯、鑰匙與單音鋼琴由 `app/game/title-ambient.ts` 即時生成，各事件使用獨立隨機計時，不是歌曲循環。遊戲內日光燈 Flicker、物件落袋與金屬管攻擊聲由 Web Audio 產生，均使用噪音／物理衰減，禁止電子 UI 嗶聲。

## 製作人提供的紅怡語音

`public/audio/voice/hongyi/demo00.mp3` 至 `demo08.mp3` 為製作人提供素材。程式只依事件播放，不進行重混、語音合成或替換。字幕來源為 `app/game/demo-content.ts` 與 `app/game/demo-ending.ts`。

## 舊素材

根目錄舊 CC0 環境檔仍保留以避免歷史引用遺失，但目前場景 Ambient 不再映射到 `abandoned-passages-cc0.ogg` 或 `narrow-corridors-cc0.ogg`。若日後重新啟用，必須先補來源網址、作者、授權快照及音量／EQ 驗收紀錄。
