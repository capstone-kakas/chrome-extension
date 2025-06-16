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

// 채팅 메시지 표시 함수
function displayChatMessages(messages, productInfo) {
  const chatContainer = document.querySelector('.chat-container');
  if (!chatContainer) return;

  // 기존 메시지 초기화 (중복 방지)
  chatContainer.innerHTML = '';

  // 새로운 메시지 추가
  messages.forEach(message => {
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${message.sender}`;
    messageElement.innerHTML = `
      <div class="message-content">
        <div class="message-text">${message.text}</div>
        <div class="message-time">${message.time || ''}</div>
      </div>
    `;
    chatContainer.appendChild(messageElement);
  });

  // 상품 정보 표시
  productInfo.forEach(info => {
    if (info.info || info.product) {
      const productElement = document.createElement('div');
      productElement.className = 'product-info-message';
      productElement.innerHTML = `
        <div class="product-content">
          ${info.info ? `<div class="info-text">${info.info}</div>` : ''}
          ${info.product ? `<div class="product-text">${info.product}</div>` : ''}
        </div>
      `;
      chatContainer.appendChild(productElement);
    }
  });

  // 스크롤을 최신 메시지로 이동
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

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

// 통합 메시지 리스너
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 선택된 텍스트를 받아 인용 UI에 표시
  if (msg.type === 'SELECTED_TEXT' && msg.text) {
    showQuoteRef(msg.text);
  }
  
  // 채팅 데이터 수신 처리
  if (msg.type === 'CHAT_DATA' && msg.chatData) {
    console.log('Received chat data:', msg.chatData);
    displayChatMessages(msg.chatData.messages || [], msg.chatData.productInfo || []);
  }

  // 상품 정보 수신 처리
  if (msg.type === 'PRODUCT_FOUND' && msg.productInfo) {
    displayProductInfo(msg.productInfo);
  }
  
  return true;
});

// 페이지 로드 시 상품 정보 매칭 시도
window.addEventListener('load', () => {
    // 현재 탭의 URL 가져오기
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) return;
        
        const url = tabs[0].url;
        if (url.includes('talk2/user') || url.includes('talk.bunjang.co.kr')) {
            // content script 연결 시도 (재시도 횟수 줄이기)
            function connectToContentScript() {
                chrome.tabs.sendMessage(tabs[0].id, {type: 'GET_PRODUCT_INFO'}, function(response) {
                    if (chrome.runtime.lastError) {
                        console.log('Content script not ready, will retry when needed');
                        return;
                    }
                    console.log('Successfully connected to content script');
                });
            }

            // 초기 연결 시도
            connectToContentScript();
            
            // 채팅 데이터 가져오기 버튼 추가
            const chatDataBtn = document.createElement('button');
            chatDataBtn.textContent = '채팅 내역 불러오기';
            chatDataBtn.className = 'chat-data-btn';
            chatDataBtn.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 1000;
                padding: 8px 12px;
                background: #007bff;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: background-color 0.2s;
            `;
            
            // 버튼 호버 효과
            chatDataBtn.addEventListener('mouseenter', () => {
                chatDataBtn.style.backgroundColor = '#0056b3';
            });
            chatDataBtn.addEventListener('mouseleave', () => {
                chatDataBtn.style.backgroundColor = '#007bff';
            });
            
            // 버튼 클릭 이벤트 (디바운싱 적용)
            let isRequesting = false;
            chatDataBtn.addEventListener('click', () => {
                if (isRequesting) {
                    console.log('Request already in progress, skipping...');
                    return;
                }
                
                isRequesting = true;
                chatDataBtn.disabled = true;
                chatDataBtn.textContent = '불러오는 중...';
                
                console.log('Requesting chat data...');
                chrome.tabs.sendMessage(tabs[0].id, {type: 'CHAT_DATA'}, function(response) {
                    isRequesting = false;
                    chatDataBtn.disabled = false;
                    chatDataBtn.textContent = '채팅 내역 불러오기';
                    
                    if (chrome.runtime.lastError) {
                        console.error('Error requesting chat data:', chrome.runtime.lastError);
                        chatDataBtn.textContent = '오류 발생 - 재시도';
                        setTimeout(() => {
                            chatDataBtn.textContent = '채팅 내역 불러오기';
                        }, 2000);
                        return;
                    }
                    
                    if (response && response.chatData) {
                        console.log('Received chat data response:', response.chatData);
                        displayChatMessages(response.chatData.messages || [], response.chatData.productInfo || []);
                        chatDataBtn.textContent = '✓ 불러오기 완료';
                        setTimeout(() => {
                            chatDataBtn.textContent = '채팅 내역 불러오기';
                        }, 2000);
                    } else if (response && response.error) {
                        console.error('Chat data error:', response.error);
                        chatDataBtn.textContent = '데이터 없음';
                        setTimeout(() => {
                            chatDataBtn.textContent = '채팅 내역 불러오기';
                        }, 2000);
                    }
                });
            });
            
            document.body.appendChild(chatDataBtn);
        }
    });
}); 