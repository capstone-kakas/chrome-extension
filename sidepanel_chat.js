// 추천 버튼 클릭 시 입력창에 텍스트 삽입
const suggestionBtns = document.querySelectorAll('.suggestion-btn');
const chatInput = document.querySelector('.chat-input');

suggestionBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    chatInput.value = btn.textContent;
    chatInput.focus();
  });
});

// 엔터 또는 전송 버튼 클릭 시 입력값 초기화 (실제 전송 기능은 없음)
const sendBtn = document.querySelector('.send-btn');
const chatInputBox = document.querySelector('.chat-input-box');

function sendMessage() {
  if (chatInput.value.trim() !== '') {
    // 실제로는 메시지 전송 로직이 들어갈 자리
    chatInput.value = '';
    chatInput.focus();
  }
}

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
});

// ----------- 인용(참고중) 기능 -----------
const quoteRef = document.querySelector('.quote-ref');

function showQuoteRef(text) {
  quoteRef.innerHTML = `
    <span class="quote-text">"${text}"</span>
    <span class="quote-meta">(참고중)</span>
    <button class="quote-cancel" title="인용 취소" id="quote-cancel">✕</button>
  `;
  quoteRef.style.display = 'flex';
  document.getElementById('quote-cancel').onclick = () => {
    quoteRef.style.display = 'none';
    quoteRef.innerHTML = '';
  };
}

// content script에서 선택된 텍스트를 받아 인용 UI에 표시
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SELECTED_TEXT' && msg.text) {
    showQuoteRef(msg.text);
  }
  return true;
});

// 상품 정보 표시 함수
function displayProductInfo(productInfo) {
    const container = document.getElementById('productInfoContainer');
    if (!container) return;

    // 상품 정보 업데이트
    container.querySelector('.price').textContent = `가격: ${productInfo.price}`;
    container.querySelector('.status').textContent = `상태: ${productInfo.status}`;
    container.querySelector('.delivery').textContent = `배송비: ${productInfo.deliveryFee}`;
    container.querySelector('.category').textContent = `카테고리: ${productInfo.categories.join(' > ')}`;

    // 컨테이너 표시
    container.style.display = 'block';

    // 닫기 버튼 이벤트 리스너
    const closeBtn = container.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            container.style.display = 'none';
        };
    }
}

// 페이지 로드 시 상품 정보 매칭 시도
window.addEventListener('load', () => {
    // 현재 탭의 URL 가져오기
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) return;
        
        const url = tabs[0].url;
        if (url.includes('talk2/user')) {
            // content script가 준비될 때까지 재시도
            function trySendMessage(retryCount = 0) {
                if (retryCount > 5) {
                    console.log('Max retries reached, giving up...');
                    return;
                }

                chrome.tabs.sendMessage(tabs[0].id, {type: 'GET_PRODUCT_INFO'}, function(response) {
                    if (chrome.runtime.lastError) {
                        console.log(`Attempt ${retryCount + 1}: Content script not ready, retrying in 1 second...`);
                        setTimeout(() => trySendMessage(retryCount + 1), 1000);
                        return;
                    }
                    
                    console.log('Successfully connected to content script');
                });
            }

            // 첫 시도
            trySendMessage();
        }
    });
});

// content script로부터 상품 정보를 받아 처리
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PRODUCT_FOUND' && message.productInfo) {
        displayProductInfo(message.productInfo);
    }
    return true;
}); 