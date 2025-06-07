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

// 로딩 스피너 표시/숨김 함수
function toggleLoadingSpinner(show) {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
        overlay.style.display = show ? 'block' : 'none';
    }
}

// 현재 URL에 따라 적절한 페이지를 로드하는 함수
function loadAppropriatePage() {
    const container = document.getElementById('container');
    
    // 현재 활성화된 탭의 URL을 가져옴
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentUrl = tabs[0].url;
        
        // URL 패턴에 따라 다른 페이지 로드
        if (currentUrl.includes('m.bunjang.co.kr/talk2')) {
            // 채팅 페이지인 경우
            toggleLoadingSpinner(true);
            loadIframe('sidepanel_chat.html');
        } else if (currentUrl.includes('m.bunjang.co.kr/products')) {
            // 상품 상세 페이지인 경우
            toggleLoadingSpinner(true);
            loadIframe('sidepanel_product.html');
        }
    });
}

// iframe을 로드하는 함수
function loadIframe(page) {
    const container = document.getElementById('container');
    
    // 기존 iframe 제거
    const existingIframe = container.querySelector('iframe');
    if (existingIframe) {
        existingIframe.remove();
    }
    
    const iframe = document.createElement('iframe');
    iframe.src = page;
    
    // iframe 로드 완료 시 스피너 숨김
    iframe.onload = () => {
        setTimeout(() => {
            toggleLoadingSpinner(false);
        }, 500); // iframe이 로드된 후 0.5초 더 기다림
    };
    
    container.appendChild(iframe);
}

// URL 변경 감지 (더 자주 체크)
let lastUrl = '';
let isPageLoading = false;

function checkUrlChange() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentUrl = tabs[0].url;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            isPageLoading = true;
            toggleLoadingSpinner(true);
            // 페이지 로드가 완료될 때까지 기다림
            setTimeout(() => {
                isPageLoading = false;
                loadAppropriatePage();
            }, 500);
        }
    });
}

// 주기적으로 URL 체크 (페이지 로딩 중이 아닐 때만)
setInterval(() => {
    if (!isPageLoading) {
        checkUrlChange();
    }
}, 1000);

// URL 변경 감지 (페이지 로드 완료 시)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        toggleLoadingSpinner(true);
        setTimeout(loadAppropriatePage, 500);
    }
});

// 초기 로드
document.addEventListener('DOMContentLoaded', () => {
    toggleLoadingSpinner(true);
    setTimeout(loadAppropriatePage, 1000);
}); 