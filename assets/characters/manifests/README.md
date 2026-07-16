# 角色動畫 Manifest

每個正式候選角色必須在此資料夾提供一份 JSON Manifest，並以逐幀透明 PNG 作為 Validator 輸入。未註冊的 `public/sprite-*.png` 只視為舊原型。

最低欄位示例：

```json
{
  "characterId": "player_male",
  "characterType": "player",
  "releaseCandidate": true,
  "renderHeightPx": 256,
  "pivot": "feet-center",
  "groundLine": true,
  "footLock": true,
  "rootMotionChecked": true,
  "collisionBoxChecked": true,
  "engineShadow": { "type": "ellipse", "opacity": 0.25 },
  "clips": [
    {
      "state": "Idle",
      "fps": 24,
      "frames": ["assets/characters/player_male/idle/0001.png"],
      "pivots": [{ "x": 128, "y": 256 }]
    },
    {
      "state": "Attack",
      "fps": 24,
      "phases": ["Prepare", "Swing", "Impact", "Recovery"],
      "frames": []
    }
  ]
}
```

正式 Manifest 的 `frames` 必須列出全部逐幀檔案；示例中的單幀與空陣列不會通過驗證。
