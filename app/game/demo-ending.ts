export const DEMO_ENDING_STATES = [
  "B2_ALIVE", "B2_DEFEATED", "KEYCARD_DROPPED", "KEYCARD_COLLECTED", "CLEARANCE_REPORT_VIEWED",
  "RETURN_TO_OFFICE", "FLOOR10_BUTTON_DISCOVERED", "KEYCARD_DELIVERED", "POST_B2_FREE_ROAM",
  "FLOOR10_NOTICE_DISCOVERED", "DEMO_ENDING_STARTED", "DEMO_COMPLETED",
] as const;
export type DemoEndingState = typeof DEMO_ENDING_STATES[number];

const NEXT: Partial<Record<DemoEndingState, readonly DemoEndingState[]>> = {
  B2_ALIVE: ["B2_DEFEATED"], B2_DEFEATED: ["KEYCARD_DROPPED"], KEYCARD_DROPPED: ["KEYCARD_COLLECTED"],
  KEYCARD_COLLECTED: ["CLEARANCE_REPORT_VIEWED"], CLEARANCE_REPORT_VIEWED: ["RETURN_TO_OFFICE", "FLOOR10_BUTTON_DISCOVERED"],
  FLOOR10_BUTTON_DISCOVERED: ["RETURN_TO_OFFICE"], RETURN_TO_OFFICE: ["KEYCARD_DELIVERED"],
  KEYCARD_DELIVERED: ["POST_B2_FREE_ROAM"], POST_B2_FREE_ROAM: ["FLOOR10_NOTICE_DISCOVERED"],
  FLOOR10_NOTICE_DISCOVERED: ["DEMO_ENDING_STARTED"], DEMO_ENDING_STARTED: ["DEMO_COMPLETED"],
};

export function advanceDemoEnding(current: DemoEndingState, next: DemoEndingState): DemoEndingState {
  if (current === next) return current;
  if (!NEXT[current]?.includes(next)) throw new Error(`不合法的 Demo 收尾狀態：${current} → ${next}`);
  return next;
}

export function canAccessDemoFloor(floor: number, boundFloor: number, endingState: DemoEndingState) {
  if (floor === 6 && !["B2_ALIVE", "B2_DEFEATED", "KEYCARD_DROPPED"].includes(endingState)) return true;
  return floor <= Math.min(9, boundFloor + 3);
}

export const DEMO_ENDING_ZH_TW = {
  "demo.b2.defeat.objective_pickup": "拾取異常物件",
  "demo.b2.clearance.header": "無期租寓管理室｜異常處理紀錄",
  "demo.b2.clearance.title": "底層封鎖解除",
  "demo.b2.clearance.subtitle": "B1、B2 異常源已停止活動",
  "demo.b2.clearance.body": "最後一聲回響沉入地下後，停擺的電梯控制盤重新亮起。一枚從未出現在樓層表上的「10F」按鍵，正以微弱白光持續閃爍。",
  "demo.b2.clearance.status_b1": "B1 異常源｜已封鎖",
  "demo.b2.clearance.status_b2": "B2 異常主體｜已清除",
  "demo.b2.clearance.status_power": "地下電力系統｜部分恢復",
  "demo.b2.clearance.status_elevator": "電梯控制權｜已更新",
  "demo.b2.clearance.status_floor10": "10F 通行權限｜等待管理員核准",
  "demo.b2.clearance.hongyi_message": "做得不錯。你清掉的是地下室，不是這棟樓。",
  "demo.b2.clearance.reward_keycard": "特殊權限卡 ×1",
  "demo.return_office.title": "帶回權限卡",
  "demo.return_office.description": "返回六樓管理室，將特殊權限卡交給紅怡。",
  "demo.elevator.floor10.first_interaction": "現在還不能上去。\n把卡帶回來。\n我要先確認十樓為什麼認得你。",
  "demo.elevator.floor10.repeat_interaction": "我說過，先回管理室。",
  "demo.hongyi.keycard.intro": "門關上。\n卡放在櫃檯上。不要讓它碰到住戶名冊。",
  "demo.hongyi.keycard.floor10": "住戶名冊裡沒有十樓。\n但管理室每個月都會收到十樓的租金。",
  "demo.hongyi.keycard.registration": "這張卡製作的時間，比你入住還早。",
  "demo.hongyi.keycard.conclusion": "十樓已經開始等你了。\n不過今晚到此為止。",
  "demo.floor10.notice.header": "無期租寓｜入住補充通知",
  "demo.floor10.notice.title": "十樓候選住戶通知",
  "demo.floor10.notice.body": "你的底層清剿紀錄已被接受。十樓已將你的登記編號列入候選名冊。通行權限仍在審核。",
  "demo.floor10.notice.inspect": "這不是紅怡寫的。",
  "demo.ending.title": "本輪清剿紀錄已封存",
  "demo.ending.body": "地下室恢復了安靜。十樓卻第一次出現在公寓的樓層表上。",
  "demo.ending.teaser": "真正的租約，從十樓開始。",
  "demo.ending.return_title": "返回標題",
  "demo.ending.view_record": "查看本輪紀錄",
  "demo.ending.continue_explore": "繼續探索",
} as const;

export const DEMO_ENDING_EN_DRAFT = Object.fromEntries(Object.keys(DEMO_ENDING_ZH_TW).map(key => [key, `[EN TRANSLATION PENDING REVIEW] ${key}`]));

