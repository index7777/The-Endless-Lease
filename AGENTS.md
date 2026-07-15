# 《無期租寓》專案接手指引

本專案的絕對工作路徑：

`C:\The Endless Lease`

任何新的 Codex 任務或開發者開始修改前，必須依序完整閱讀：

1. `C:\The Endless Lease\outputs\無期租寓_開發交接文件.md`
2. `C:\The Endless Lease\outputs\無期租寓_系統待補清單_v0.2.md`
3. `C:\The Endless Lease\app\game.tsx`
4. `C:\The Endless Lease\app\globals.css`

不可只依賴舊對話摘要。以交接文件、目前檔案內容與使用者最新要求為準。

重要約束：

- 所有遊戲文字與生成圖像使用繁體中文。
- 維持 1990–2005 亞洲老舊商住公寓、35mm 膠片寫實微恐怖風格。
- 不可建立新的 Sites 站點；必須重用 `.openai/hosting.json` 既有專案。
- 修改後執行交接文件中的回歸測試清單。
- 不得把發布憑證、權杖或其他秘密寫入檔案。
