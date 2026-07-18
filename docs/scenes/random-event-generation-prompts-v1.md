# 隨機事件場景登記與生成提詞 v1

## 共通生成與綁定規則

- 每個事件以穩定 ID 登記名稱、描述、選項、背景素材、互動範圍、碰撞設定及入口門向。
- 每輪新入住時，從本輪可抵達的住宅樓層與 1–9 號房一次抽出三個不同房號；排除承租房。
- 同輪跨日、換樓、離房重進及讀檔均沿用原分配；輪迴、死亡重開或重新入住才重抽。
- 已解決事件保留原房間與背景，之後互動只回覆「目前沒有發現異樣。」
- 所有場景固定左側公寓出口門、門把位於門片右側、前景可走；異空間內容不受一般住宅合理性限制。

## 目前正式事件

| 事件 ID | 名稱 | 場景素材 | 生成／來源方式 |
|---|---|---|---|
| `seepage_wall` | 滲水牆面 | `public/scene-event-seepage-wall-v1.png` | 2026-07-18 使用內建影像生成，依下列正式提詞生成 |
| `sealed_wall` | 封鎖牆面 | `public/scene-event-sealed-wall-v1.png` | 2026-07-18 使用內建影像生成，依下列正式提詞生成 |
| `resident_clinic` | 住戶診療台 | `public/scene-clinic-v3.png` | 既有專屬生成場景；專案未保存原始逐字提詞，不得偽造來源 |

## seepage_wall

Use case: stylized-concept. Production 2.5D game room background for 《無期租寓》, no characters or UI. Create the dedicated random-event scene for 「滲水牆面」: a vast impossible damp memory-echo chamber reached through an old apartment door. The central-right wall bulges with translucent wet membrane and warm clear liquid seeping from inside masonry; old unpaid rent-paper shapes are half absorbed into the wall and scattered at its base. Cinematic photorealistic 35mm still, 1990–2005 decaying East Asian mixed-use apartment horror, restrained analog realism. Exact wide side-on 16:9 view for a 1600×900 canvas, fixed adult eye-height camera. One old apartment exit door at far left with handle on the door's right edge; keep the left exit lane and lower foreground clear; interaction landmark around 58% width. Dim stained fluorescent practical light; dirty green-gray, nicotine amber, black moisture and muted brown; no cyan. No people, monsters, furniture, readable text, numbers, HUD, logos, watermark, ordinary bedroom, duplicate door, staircase or window.

## sealed_wall

Use case: stylized-concept. Production 2.5D game room background for 《無期租寓》, no characters or UI. Create the dedicated random-event scene for 「封鎖牆面」: a vast impossible concrete chamber reached through an old apartment door. The far wall is completely sealed by damp masonry, welded metal bracing, buried door frames and old paper traces absorbed into the surface; the central-right sealed wall is the interaction subject. Cinematic photorealistic 35mm still, 1990–2005 decaying East Asian mixed-use apartment horror, restrained analog realism. Exact wide side-on 16:9 view for a 1600×900 canvas, fixed adult eye-height camera. One old apartment exit door at far left with handle on the door's right edge; keep the left exit lane and lower foreground clear; interaction landmark around 58% width. Dim sickly fluorescent practical light; charcoal concrete, dirty green-gray, aged brown metal and weak nicotine amber. No people, monsters, furniture, readable text, signs, numbers, HUD, logos, watermark, ordinary bedroom, duplicate door, staircase or window; no fantasy glow, neon, cyan, sci-fi machinery, fisheye, Dutch angle, gore or excessive fog.

## resident_clinic

既有 `scene-clinic-v3.png` 已具中央診療床、左側一致出口與可走前景。本輪只依實際畫面重測並校正中央診療床互動範圍；因原始逐字生成提詞不在目前專案紀錄中，後續如需重製，必須先建立新版本提詞與新素材檔名，不得覆寫或冒稱還原原提詞。
