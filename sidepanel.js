// 메시지를 받아서 화면에 표시하는 함수
function updateMessages(messages) {
  const messagesContainer = document.getElementById('messages');
  messagesContainer.innerHTML = messages
    .map((message, index) => `
      <div class="chat-message">
        [${index + 1}] ${message}
      </div>
    `)
    .join('');
}

// content script로부터 메시지 수신
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_CHAT') {
    updateMessages(message.messages);
  }
});

// 현재 URL에 따라 적절한 페이지를 로드하는 함수
function loadAppropriatePage() {
    const container = document.getElementById('container');
    
    // 현재 활성화된 탭의 URL을 가져옴
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentUrl = tabs[0].url;
        
        // URL 패턴에 따라 다른 페이지 로드
        if (currentUrl.includes('talk.bunjang.co.kr')) {
            // 채팅 페이지인 경우
            loadIframe('sidepanel_chat.html');
        } else if (currentUrl.includes('m.bunjang.co.kr/products')) {
            // 상품 상세 페이지인 경우
            loadIframe('sidepanel.html');
        }
    });
}

// iframe을 로드하는 함수
function loadIframe(page) {
    const container = document.getElementById('container');
    container.innerHTML = ''; // 기존 내용 제거
    
    const iframe = document.createElement('iframe');
    iframe.src = page;
    container.appendChild(iframe);
}

// URL 변경 감지
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        loadAppropriatePage();
    }
});

// 초기 로드
document.addEventListener('DOMContentLoaded', loadAppropriatePage); 