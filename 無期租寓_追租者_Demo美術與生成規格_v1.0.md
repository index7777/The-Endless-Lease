# 《無期租寓》追租者 Demo 美術與生成規格 v1.0

更新日期：2026-07-15  
用途：將完整角色設定收斂為 Demo 可直接產出、可接入遊戲且容易維持一致性的素材規格。

## 一、Demo 採用的角色定案

追租者是公寓租約的安靜執行者，不是殭屍、持武器殺手或血肉怪物。

固定辨識元素：

- 40–55 歲亞洲男性，高瘦、筆直、接近正常人類比例。
- 老式深色西裝、皮鞋，以及由受潮租約逐漸覆蓋的長大衣。
- 冷淡疲倦的表情，部分臉部藏在瀏海與日光燈陰影中。
- 一手拿厚重租約名冊，一手拿大量老式金屬鑰匙。
- 皮膚只有輕微潮濕牆漆、壁紙與細裂紋，不出現傷口或腐屍特徵。
- 始終維持安靜、端正、行政人員般的姿勢。

角色恐怖感來自「過度正常、知道所有房號、擁有所有鑰匙」，不是外觀獵奇。

## 二、Demo 最小素材包

### A. 角色視覺錨點圖（1 張）

用途：先確認人物身分、年齡、臉、身形、服裝與材質；後續所有圖片都引用這張維持一致性。

規格：

- 單一人物，不做正側背多人排版。
- 全身三分之四角度，頭、雙手、鑰匙與雙腳完整可見。
- 簡單老公寓走廊背景。
- 靜態站姿，不呈現追逐、攻擊、死亡或技能演出。
- 只表現「第二階段：巡樓員」，兼顧正常人形與租約異化辨識度。

### B. 遊戲用完整角色 PNG（1 張）

用途：Canvas 內的追租者角色素材。

規格：

- 以已核准的視覺錨點圖作為人物參考。
- 單一全身人物、正面略偏三分之四角度、靜態站姿。
- 頭、鞋、手、名冊與鑰匙圈都不可裁切。
- 角色與背景完全分離，輪廓在縮小後仍清楚。
- 首次生成使用單色去背背景，完成後再於本機轉為透明 PNG。
- 不直接要求模型製作動畫影格或多視角轉身圖。

### C. 高欠租外觀變體（1 張，可延後）

用途：欠租天數較高時切換角色外觀。

製作方法：對 B 的角色圖進行定向編輯，不重新生成另一個人。

只允許改變：

- 租約覆蓋面積增加。
- 鑰匙數量增加。
- 大衣與皮膚的牆面化程度提高。
- 臉部陰影加深。

必須保持：臉、身高、體型、站姿、服裝剪裁、攝影角度與光源完全一致。

### D. 走廊宣傳情境圖（非 Demo 必要）

不影響遊戲功能，待角色 PNG 接入並驗證後再製作。

## 三、Demo 不生成的素材

以下內容先不交給圖像模型：

- 正面、側面、背面、臉部、衣料、鑰匙、走廊共存的一張大型設定板。
- 四個威脅階段各自獨立生成的四名角色。
- 攻擊、死亡、破門、按住玩家或拖入結算畫面的情境圖。
- 多格動畫或完整 sprite sheet。
- 大量帶有房號、日期、簽名或催繳內容的可閱讀小字。

上述需求容易造成漏項、人物變臉、錯字或安全系統誤判。Demo 先使用靜態角色 PNG，移動、陰影、鑰匙聲、紙張飄動與能力特效由程式處理。

## 四、遊戲內階段表現方式

Demo 不需要四張完全不同的追租者。

| 欠租狀態 | 使用圖片 | 程式層表現 |
|---|---|---|
| 欠租 1 日 | 基礎 PNG | 少量紙屑、正常角色尺寸 |
| 欠租 2–3 日 | 基礎 PNG | 鑰匙聲提高、陰影拉長、紙屑增加 |
| 欠租 4–6 日 | 高欠租變體 | 牆面紋理提高、燈光短暫閃爍 |
| 欠租 7 日以上 | 高欠租變體 | 更深陰影、更多紙張粒子、門鎖異常特效 |

數值成長、跨空間追擊、破門、電梯跟隨與管理層進入能力全部由程式控制，不要求圖片直接表現。

## 五、精準生成流程

1. 先產出一張視覺錨點圖，只確認角色設計。
2. 使用錨點圖作為人物參考，產出單一去背用角色圖。
3. 檢查頭、鞋、雙手、鑰匙圈是否完整，縮小後輪廓是否清楚。
4. 本機去背並驗證透明邊緣。
5. 需要高欠租變體時，只編輯核准的基礎角色圖。
6. 最後才製作非必要的走廊宣傳圖。

每次提示只要求一種成品。不要同時要求角色板、Sprite、情境圖和動畫。

## 六、提詞撰寫原則

### 保留在生成提示中的資訊

- 素材用途。
- 單一主體的年齡、外形與服裝。
- 三至五個最重要的識別物。
- 鏡位、裁切、姿勢與背景。
- 光線、色調與材質。
- 必須保持的項目。
- 簡短的避免項目。

### 不放入生成提示的資訊

- 傷害數值、生成條件、AI、欠款公式與掉落。
- 長篇世界觀。
- 攻擊、擊殺、死亡與玩家受害描述。
- 同一張圖無法同時完成的多種輸出需求。
- 重複且過長的負面詞列表。

功能規格與美術提示分開，可以降低誤判，也能讓模型把注意力集中在人物一致性。

## 七、視覺錨點圖提示詞

```text
Use case: stylized-concept
Asset type: game character visual anchor for 《無期租寓》
Primary request: a single full-body character design of an adult East Asian apartment lease administrator in an aging residential building
Scene/backdrop: a simple narrow 1990–2005 East Asian apartment corridor with peeling damp walls, old fluorescent lights, stained tile, a rusted metal door, and a vintage elevator
Subject: a tall thin East Asian man, age 40–55, standing perfectly upright in a neutral administrative pose; tired emotionless face partly shaded by dark hair; worn old-fashioned dark suit and leather shoes; a long coat partially formed from layered yellowed damp rental papers fused into the fabric; subtle peeling-wallpaper texture on pale skin; one hand holds a thick aged ledger and the other holds a large ring of old iron and oxidized brass apartment keys
Style/medium: photorealistic cinematic game character concept, restrained Asian urban psychological horror, realistic anatomy and fabric, analog 35mm film grain, low contrast, slight lens grime
Composition/framing: one character only, full body in a three-quarter front view, centered, both feet, both hands, ledger, and key ring fully visible
Lighting/mood: old green-gray fluorescent ceiling light, muted gray-green, dirty yellow, brown-black palette, quiet formal atmosphere
Constraints: ordinary human scale; static neutral pose; papers use only blurred tables and stamp-like marks; no readable text; no logo; no watermark
Avoid: action scene, weapons, injuries, zombie features, fantasy armor, anime, neon lighting, modern luxury apartment
```

## 八、Demo 角色 PNG 提示詞

這一步必須附上已核准的視覺錨點圖，並把它標成「人物身分與服裝參考」。

```text
Use case: identity-preserve
Asset type: full-body game character cutout for 《無期租寓》
Input images: Image 1 is the approved identity, face, body-proportion, outfit, and material reference
Primary request: reproduce the same character as one isolated full-body game character in a static neutral standing pose
Subject: preserve the exact face, age, hairstyle, tall thin proportions, old dark suit, rental-paper coat, aged ledger, and large metal key ring from Image 1
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for local background removal
Style/medium: same photorealistic 35mm aging-apartment game style as Image 1
Composition/framing: single character only, centered, front three-quarter view, generous padding; head, both hands, ledger, key ring, coat hem, and both shoes completely visible and separated
Lighting/mood: soft old fluorescent light from above, restrained low contrast
Constraints: preserve identity and clothing exactly; background must be one uniform color with no shadows, gradient, texture, floor plane, reflection, or lighting variation; crisp readable silhouette; no cast shadow; no readable text; no logo; no watermark; do not use #00ff00 on the character
Avoid: environment objects, frame, labels, extra people, redesigning the face or outfit, action pose, weapons, injuries, anime
```

生成後使用去背工具處理，不把模型宣稱的透明背景直接視為完成品。

## 九、高欠租變體編輯提示詞

```text
Use case: identity-preserve
Asset type: higher-overdue visual variant of the existing game character
Input images: Image 1 is the approved base character and edit target
Primary request: create a more weathered administrative-contract variant of the same character
Change only: increase the rental-paper coverage on the existing coat; add more old metal keys to the same key ring; deepen the face shadow; add subtle damp wall-paint texture to exposed skin and coat edges
Preserve exactly: identity, face, age, hairstyle, height, body proportions, pose, camera angle, outfit cut, ledger, lighting direction, full-body framing, and chroma-key background
Constraints: restrained material change only; realistic human anatomy; no readable text; no logo; no watermark
Avoid: changing the person, changing the pose, enlarging the body, adding extra limbs, action, weapons, injuries, zombie features, gore, fantasy elements
```

## 十、驗收清單

- 一眼可辨識高瘦人形、租約大衣與巨大鑰匙圈。
- 看起來仍是曾經的普通人，而不是殭屍或惡魔。
- 頭、手、鞋、名冊及鑰匙沒有裁切。
- 縮小到遊戲尺寸時，鑰匙與紙張輪廓仍可辨認。
- 沒有多餘人物、場景碎片、設定板框線或錯誤文字。
- 高欠租變體仍是同一個人，而不是重新設計的新怪物。
- 圖片只負責外觀；追擊、破門、跨空間與數值成長由程式負責。

