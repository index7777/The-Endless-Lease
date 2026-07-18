# 製作人需求封存

- 接收日期：2026-07-17（Asia/Taipei）
- 狀態：只建檔，尚未實作
- 對應需求／任務：R22／T94
- 來源附件 SHA-256：`7baeb29f177fadb1e7391722ff75f3685db1f3f35d1caa90133a6d4ecb51f514`
- 保存原則：以下保留製作人附件原文，不以摘要取代。

---
《無期租寓》Demo：初次進入管理室對話流程 v1.0
一、演出目的

這段是玩家第一次正式見到紅怡，主要完成四件事：

建立紅怡冷靜、禮貌、難以理解的角色印象。
說明管理室能提供的基本服務。
告知玩家每日租金與欠租一天即啟動追租。
開放「挑戰管理員」選項，但不強迫玩家進入戰鬥。

Demo 版本保持簡單，不建立大型分支。玩家詢問不同問題後，最後都回到同一個主選單。

二、場景前置
觸發條件

玩家第一次進入管理層並走近管理室辦公桌。

紅怡坐在老式辦公桌後：

雙腿交疊。
一手握著鋼筆。
桌上放住戶名冊、黃銅鑰匙圈與老式電話。
她不主動起身。
住戶名冊會自行翻頁。
其他物件完全靜止。
所有時鐘停在同一時間。

玩家靠近後顯示：

紅怡

E　辦理住戶事項

不得顯示：

E　對話

「辦理住戶事項」更符合管理室的行政語言。

三、開始對話演出

玩家按下互動後：

玩家移動與攻擊輸入暫停。
HUD 降低透明度，但不要完全消失。
鏡頭緩慢推近辦公桌，時間約 0.6 秒。
Ambient 音量降低約 6 dB。
保留日光燈、紙張與時鐘聲。
紅怡寫完手上的一行字，再抬頭看向玩家。
停頓約 0.7 秒後開始說話。
紅怡初次開場

紅怡：

歡迎入住。

語音：

HY_MGMT_001
voice_hongyi_management_welcome_01.wav

停頓約 0.5 秒。

我是管理員，紅怡。

語音：

HY_MGMT_002
voice_hongyi_management_introduction_01.wav

紅怡將住戶名冊轉向自己，不需要遞給玩家。

你的住戶檔案，已經送到管理室。

新增語音：

HY_MGMT_016
voice_hongyi_management_record_arrived_01.wav

在租約有效期間，我會受理你的住戶事項。

新增語音：

HY_MGMT_017
voice_hongyi_management_services_available_01.wav

接著進入主選單。

四、初次對話主選單

畫面使用現有 ArchiveCard 或文件選項元件，不得新增一般 RPG 對話框。

選項：

想詢問每日租金

想詢問這棟公寓

想詢問管理室

辦理其他事項

挑戰管理員

暫時沒有問題

第一次進入時，建議前三個問題旁顯示很小的「未閱」印章；閱覽後移除。

不得使用驚嘆號、問號圖示或彩色提示。

五、分支 A：詢問每日租金
玩家選項
每日租金是怎麼回事？

玩家台詞可只顯示文字，不需要配音。

紅怡低頭翻到玩家檔案的租金頁。

紅怡：

每一天，都必須支付租金。

新增語音：

HY_RENT_016
voice_hongyi_rent_daily_required_01.wav

當日租金，會在一天結束時統一結算。

若遊戲正式設定使用「每日十二分鐘結算」，台詞仍不需要說出現實分鐘數。

新增語音：

HY_RENT_017
voice_hongyi_rent_daily_settlement_01.wav

欠租一天，追租程序就會啟動。

新增語音：

HY_RENT_018
voice_hongyi_rent_one_day_collection_01.wav

紅怡把頁面翻回原位。

管理室不會替住戶延期。

新增語音：

HY_RENT_019
voice_hongyi_rent_no_extension_01.wav
後續選項
追租程序是什麼？

我會準時繳納

返回
選擇「追租程序是什麼？」

紅怡看向桌上的鑰匙圈，但不碰它。

欠租已登記後，租約執行人員會前往尋找住戶。

建議語音：

HY_RENT_020
voice_hongyi_rent_enforcer_search_01.wav

他們可以進入房間、電梯，以及管理層。

新增語音：

HY_RENT_021
voice_hongyi_rent_enforcer_access_01.wav

停頓約 0.8 秒。

請不要讓他們等太久。

新增語音：

HY_RENT_022
voice_hongyi_rent_do_not_delay_01.wav

這句保持禮貌，不使用威脅語氣。

選擇「我會準時繳納」

很好。

新增語音：

HY_RENT_023
voice_hongyi_rent_acknowledged_01.wav

停頓。

多數住戶一開始也是這麼說的。

新增語音：

HY_RENT_024
voice_hongyi_rent_most_residents_01.wav

說完返回主選單。

六、分支 B：詢問這棟公寓
玩家選項
這棟公寓到底是什麼地方？

紅怡不立刻回答。

她將鋼筆放回筆架，停頓約一秒。

紅怡：

這裡是提供居住權的公寓。

新增語音：

HY_STORY_001
voice_hongyi_story_apartment_definition_01.wav

住戶支付租金。

新增語音：

HY_STORY_002
voice_hongyi_story_residents_pay_01.wav

公寓提供房間。

新增語音：

HY_STORY_003
voice_hongyi_story_apartment_provides_01.wav

玩家選項：

就只有這樣？

為什麼不能退租？

返回
選擇「就只有這樣？」

紅怡重新拿起鋼筆。

對目前的你而言，是的。

新增語音：

HY_STORY_004
voice_hongyi_story_for_now_01.wav

這句說完直接返回上一層選項。

選擇「為什麼不能退租？」

紅怡看向玩家，沒有立刻翻文件。

很多住戶都問過我。

新增語音：

HY_STORY_005
voice_hongyi_story_many_asked_01.wav

停頓約 0.8 秒。

後來，他們就不再問了。

新增語音：

HY_STORY_006
voice_hongyi_story_stopped_asking_01.wav

說完後不做 Jump Scare，不改變表情。

畫面遠處的一個時鐘可短暫發出一次機械聲，但指針不動。

返回主選單。

七、分支 C：詢問管理室
玩家選項
管理室能替我做什麼？

紅怡翻開服務項目頁。

紅怡：

管理室受理一般住戶事項。

新增語音：

HY_MGMT_018
voice_hongyi_management_general_services_01.wav

你可以在這裡還債、申請換房，或贖回抵押。

新增語音：

HY_MGMT_019
voice_hongyi_management_service_list_01.wav

有欠款時，換房申請不會成立。

可沿用或新增：

HY_MGMT_012
voice_hongyi_management_debt_remains_01.wav

管理室不提供一般交易。

新增語音：

HY_MGMT_020
voice_hongyi_management_no_shop_01.wav

玩家選項：

欠租時你還會受理嗎？

你一直都在這裡？

返回
選擇「欠租時你還會受理嗎？」

會。

新增語音：

HY_MGMT_021
voice_hongyi_management_still_available_01.wav

欠租不會取消你的申請權。

新增語音：

HY_MGMT_022
voice_hongyi_management_debt_service_right_01.wav

只會改變處理方式。

新增語音：

HY_MGMT_023
voice_hongyi_management_changes_procedure_01.wav
選擇「你一直都在這裡？」

紅怡看向玩家。

管理室一直都在。

沿用：

HY_MGMT_010
voice_hongyi_management_always_present_01.wav

玩家追問：

我問的是你。

紅怡停頓約一秒。

我知道。

新增語音：

HY_STORY_007
voice_hongyi_story_i_know_01.wav

她不再回答，返回主選單。

八、分支 D：辦理其他事項

第一次進入管理室時，服務可以開放但依玩家狀態顯示可用性：

償還欠款
申請換房
贖回抵押
查看住戶檔案
返回

Demo 初次到達時通常：

償還欠款　目前沒有欠款
申請換房　今日暫不受理
贖回抵押　目前沒有抵押
查看住戶檔案　可使用

不可只做灰色禁用按鈕；玩家選擇禁用項目時，紅怡應有簡短回覆。

沒有欠款

目前沒有需要清償的欠款。

新增語音：

HY_MGMT_024
voice_hongyi_management_no_debt_01.wav
初次不可換房

你的房間才剛完成分配。

新增語音：

HY_MGMT_025
voice_hongyi_management_room_recently_assigned_01.wav

換房申請，請於下一個結算日後提出。

新增語音：

HY_MGMT_026
voice_hongyi_management_move_later_01.wav
沒有抵押

目前沒有抵押紀錄。

新增語音：

HY_MGMT_027
voice_hongyi_management_no_mortgage_01.wav
九、分支 E：挑戰管理員

此選項必須一直放在主選單最下方，與其他服務拉開距離。

使用 Warning 色票，但不得高亮、閃爍或像推薦選項。

挑戰管理員

玩家選擇後，紅怡停止翻頁。

你要挑戰管理員。

語音：

HY_CHAL_001
voice_hongyi_challenge_question_01.wav

桌上推出一張既有紙張元件組成的申請書：

管理室紀律違反申請

申請事項：
對管理員發起攻擊

申請一經成立，不可撤回。

選項：

撤回申請

提交申請

紅怡：

請確認你的申請。

HY_CHAL_002
voice_hongyi_challenge_confirm_request_01.wav

這項申請一旦成立，便無法撤回。

HY_CHAL_003
voice_hongyi_challenge_irreversible_01.wav
撤回申請

紅怡將申請書收回。

申請已撤回。

新增語音：

HY_CHAL_014
voice_hongyi_challenge_withdrawn_01.wav

管理室不會留下未成立的紀錄。

新增語音：

HY_CHAL_015
voice_hongyi_challenge_no_record_01.wav

返回主選單。

提交申請

進入既有的紅怡挑戰演出：

住戶已提出挑戰申請。

HY_CHAL_004

申請內容已確認。

HY_CHAL_005

申請成立。

HY_CHAL_006

依管理規定，管理員有權進行自我防衛。

HY_CHAL_007

接著關閉對話介面，恢復玩家戰鬥控制，紅怡可被攻擊。

不得在確認前允許玩家自由攻擊她。

十、離開對話
玩家選項
暫時沒有問題

紅怡將住戶名冊闔上一半，但不完全關閉。

初次對話尚未問完任何核心問題時：

建議你先確認每日租金。

新增語音：

HY_MGMT_028
voice_hongyi_management_check_rent_01.wav

玩家已讀過租金分支後：

本次辦理已完成。

沿用：

HY_MGMT_015
voice_hongyi_management_service_complete_01.wav

停頓約 0.4 秒。

請妥善保管你的租屋資格。

新增語音：

HY_MGMT_029
voice_hongyi_management_keep_qualification_01.wav

演出：

鏡頭慢慢退回遊戲視角，約 0.5 秒。
HUD 恢復正常透明度。
Ambient 在 0.6 秒內恢復。
玩家重新取得移動與攻擊控制。
設定 metHongYi = true。
日後再次互動時略過自我介紹，直接進主選單。
十一、Demo 建議最小實作版本

為避免 Demo 對話過於龐大，第一版只需完整實作：

每日租金
這棟公寓
管理室能做什麼
辦理其他事項
挑戰管理員
離開

每個分支控制在兩層以內。

不要加入：

好感度。
隱藏說服數值。
複雜身份專屬對話。
多次追問樹。
對話時間限制。
玩家配音。
隨機答覆。
大量 Lore 選項。
十二、程式資料結構

Codex 不應把所有文本寫死在 JSX 裡。

建議：

type DialogueChoice = {
  id: string;
  label: string;
  nextNode?: string;
  action?: string;
  condition?: string;
  warning?: boolean;
};

type DialogueLine = {
  speaker: "hongyi" | "player" | "system";
  text: string;
  voiceId?: string;
  pauseAfterMs?: number;
  animation?: string;
};

type DialogueNode = {
  id: string;
  lines: DialogueLine[];
  choices?: DialogueChoice[];
  onEnter?: string[];
  onExit?: string[];
};

範例：

const hongYiFirstMeeting: DialogueNode = {
  id: "hongyi_first_meeting",
  lines: [
    {
      speaker: "hongyi",
      text: "歡迎入住。",
      voiceId: "HY_MGMT_001",
      pauseAfterMs: 500,
      animation: "look_up",
    },
    {
      speaker: "hongyi",
      text: "我是管理員，紅怡。",
      voiceId: "HY_MGMT_002",
      pauseAfterMs: 450,
    },
  ],
  choices: [
    {
      id: "ask_rent",
      label: "想詢問每日租金",
      nextNode: "hongyi_rent_intro",
    },
    {
      id: "ask_apartment",
      label: "想詢問這棟公寓",
      nextNode: "hongyi_apartment_intro",
    },
    {
      id: "ask_services",
      label: "想詢問管理室",
      nextNode: "hongyi_services_intro",
    },
    {
      id: "services",
      label: "辦理其他事項",
      action: "open_management_services",
    },
    {
      id: "challenge",
      label: "挑戰管理員",
      nextNode: "hongyi_challenge_confirm",
      warning: true,
    },
    {
      id: "leave",
      label: "暫時沒有問題",
      nextNode: "hongyi_goodbye",
    },
  ],
};
十三、語音播放規則
同一時間只播放一句紅怡語音。
玩家按確認時，若語音仍在播放，可以快進到該句結束，但不要立刻跳過兩句。
進入選項時必須等待當前語音結束。
每句字幕與音訊同步顯示。
紅怡說話時 Ambient Ducking 約 -6 dB。
玩家離開對話或進入戰鬥時清空一般對話 Queue。
「挑戰管理員」的確認台詞不得被一般操作中斷。
缺少正式語音時顯示字幕，但不得改用瀏覽器系統 TTS。
十四、初次對話完成後的紀錄

完成對話後記錄：

hongYiState = {
  met: true,
  askedRent: boolean,
  askedApartment: boolean,
  askedServices: boolean,
  challengeExplained: boolean,
};

後續再次進入管理室：

不再播放自我介紹。
已詢問選項移除「未閱」標記。
租金、欠款與服務回答依當前狀態更新。
「挑戰管理員」仍保留。
紅怡不主動重複長篇說明。

這一版足以讓玩家在第一次管理室互動中理解核心規則、感受到紅怡的角色魅力，也能自然把挑戰 Boss 的入口埋在正常行政服務裡，而不需要把 Demo 對話做得過度複雜。

