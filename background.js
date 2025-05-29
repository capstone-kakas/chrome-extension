// 확장 프로그램 아이콘 클릭 시 사이드탭 열기
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// content script에서 받은 SELECTED_TEXT 메시지를 사이드패널로 중계
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SELECTED_TEXT') {
    chrome.runtime.sendMessage(msg);
  }
}); 