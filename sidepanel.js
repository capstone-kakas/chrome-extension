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
  if (message.type === 'CHAT_DATA') {
    displayBunjangChat(message.chatData);
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
            // 채팅 화면 자동 확장
            expandChatScreen();
        } else if (currentUrl.includes('m.bunjang.co.kr/products')) {
            // 상품 상세 페이지인 경우
            toggleLoadingSpinner(true);
            loadIframe('sidepanel_product.html');
            // 채팅 화면 축소 (다른 페이지로 이동한 경우)
            collapseChatScreen();
        } else {
            // 기타 페이지인 경우 채팅 화면 축소
            collapseChatScreen();
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

// 채팅 화면 확장 함수
function expandChatScreen() {
    setTimeout(() => {
        const floatingBtn = document.getElementById('floatingBtn');
        const chatContainer = document.getElementById('chatContainer');
        
        if (floatingBtn && chatContainer) {
            // 플로팅 버튼 숨기기
            floatingBtn.style.display = 'none';
            // 채팅 화면 표시
            chatContainer.classList.add('active');
            chatContainer.style.display = 'flex';
            
            console.log('채팅 페이지 감지 - 채팅 화면 자동 확장');
        }
    }, 1000); // DOM이 로드될 시간을 충분히 기다림
}

// 채팅 화면 축소 함수
function collapseChatScreen() {
    const floatingBtn = document.getElementById('floatingBtn');
    const chatContainer = document.getElementById('chatContainer');
    const inputPanel = document.getElementById('inputPanel');
    
    if (chatContainer && chatContainer.classList.contains('active')) {
        // 채팅 화면 숨기기
        chatContainer.classList.remove('active');
        chatContainer.style.display = 'none';
        
        // 입력 패널도 숨기기
        if (inputPanel) {
            inputPanel.classList.remove('show');
            inputPanel.style.display = 'none';
        }
        
        // 플로팅 버튼 다시 표시
        if (floatingBtn) {
            floatingBtn.style.display = 'flex';
        }
        
        console.log('다른 페이지로 이동 - 채팅 화면 축소');
    }
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
            
            // 채팅 상태 초기화
            isChatConnected = false;
            checkedMessages = {};
            updateConnectButtonState();
            
            // 번개장터 채팅 컨테이너 초기화
            const container = document.getElementById('bunjangChatContainer');
            if (container) {
                container.innerHTML = '';
            }
            
            // 체크한 메시지 인용 상태 컨테이너 초기화
            const quotedContainer = document.getElementById('quotedMessagesContainer');
            if (quotedContainer) {
                quotedContainer.innerHTML = `
                    <div class="quoted-messages-header" id="quotedMessagesHeader">
                        체크한 메시지를 인용중입니다
                    </div>
                `;
            }
            
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

// LLMChatExtension 클래스 정의
class LLMChatExtension {
    constructor() {
        this.floatingBtn = document.getElementById('floatingBtn');
        this.inputPanel = document.getElementById('inputPanel');
        this.inputBar = document.getElementById('inputBar');
        this.inputIcon = document.getElementById('inputIcon');
        this.chatContainer = document.getElementById('chatContainer');
        this.backBtn = document.getElementById('backButton');
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.chatSendBtn = document.getElementById('chatSendBtn');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.expandChatBtn = document.getElementById('expandChatBtn');
        this.lastUserQuestion = ''; // 마지막 사용자 질문 저장
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // 플로팅 버튼 클릭 이벤트
        this.floatingBtn.addEventListener('click', () => {
            console.log('플로팅 버튼 클릭됨');
            this.floatingBtn.style.display = 'none';
            this.inputPanel.style.display = 'flex';
            this.inputPanel.classList.add('show');
            setTimeout(() => {
                this.inputBar.focus();
            }, 100);
        });

        // 입력 패널 클릭 이벤트
        this.inputPanel.addEventListener('click', (e) => {
            if (e.target === this.inputPanel || e.target === this.inputBar) {
                this.inputBar.focus();
            }
        });

        // 입력 패널 포커스 아웃 이벤트
        this.inputPanel.addEventListener('focusout', (e) => {
            // 포커스가 입력 패널 내부의 다른 요소로 이동하는지 확인
            if (!this.inputPanel.contains(e.relatedTarget)) {
                // 입력값이 없을 때만 패널 숨기기
                if (!this.inputBar.value.trim()) {
                    this.inputPanel.classList.remove('show');
                    setTimeout(() => {
                        this.inputPanel.style.display = 'none';
                        this.floatingBtn.style.display = 'flex';
                    }, 300);
                }
            }
        });

        // 입력 아이콘 클릭 이벤트
        this.inputIcon.addEventListener('click', () => {
            const message = this.inputBar.value.trim();
            if (message) {
                this.showChatScreen(message);
            }
        });

        // 엔터 키 이벤트
        this.inputBar.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const message = this.inputBar.value.trim();
                if (message) {
                    this.showChatScreen(message);
                }
            }
        });

        // 뒤로가기 버튼 이벤트
        this.backBtn.addEventListener('click', () => {
            console.log('뒤로가기 버튼 클릭');
            this.chatContainer.classList.remove('active');
            this.inputPanel.classList.remove('show');
            setTimeout(() => {
                this.inputPanel.style.display = 'none';
                this.inputBar.value = '';
                this.floatingBtn.style.display = 'flex';
            }, 300);
        });

        // 확장 버튼(▲) 클릭 시 채팅 화면 바로 진입
        if (this.expandChatBtn) {
            this.expandChatBtn.addEventListener('click', () => {
                expandChatScreen();
                this.inputPanel.style.display = 'none';
                this.floatingBtn.style.display = 'none';
            });
        }
        // 채팅 연결 버튼 이벤트 등록 (여기서 추가)
        this.connectBtn = document.getElementById('connectButton');
        if (this.connectBtn) {
            this.connectBtn.addEventListener('click', () => {
                // 연결 모달 띄우기
                const modal = document.getElementById('connectionModal');
                if (modal) modal.style.display = 'flex';
            });
        }
        // 연결 모달 내 버튼 이벤트
        const confirmBtn = document.getElementById('confirmConnection');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                isChatConnected = true;
                updateChatHeader();
                const modal = document.getElementById('connectionModal');
                if (modal) modal.style.display = 'none';
                showToast('채팅이 성공적으로 연결되었습니다');
            });
        }
        const cancelBtn = document.getElementById('cancelConnection');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                const modal = document.getElementById('connectionModal');
                if (modal) modal.style.display = 'none';
            });
        }
    }

    showChatScreen(initialMessage) {
        this.inputPanel.classList.remove('show');
        this.inputPanel.classList.add('expand-to-chat');
        this.chatContainer.classList.add('active');
        
        // 초기 메시지 추가
        if (initialMessage) {
            this.addMessage(initialMessage, 'user');
            this.inputBar.value = '';
        }
    }

    addMessage(text, type) {
        console.log('📝 메시지 추가:', { text, type });
        
        // 사용자 메시지인 경우 lastUserQuestion 업데이트
        if (type === 'user') {
            this.lastUserQuestion = text;
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';

        // bot 메시지 포맷팅: 항상 사람이 읽기 좋은 텍스트만 출력
        if (type === 'bot') {
            let displayText = '';
            if (typeof text === 'object' && text !== null) {
                displayText = text.response ? text.response : JSON.stringify(text);
            } else if (typeof text === 'string') {
                const responseIdx = text.indexOf('"response":');
                const latencyIdx = text.indexOf('"latency"');
                if (responseIdx !== -1 && latencyIdx !== -1 && latencyIdx > responseIdx) {
                    let extracted = text.substring(responseIdx + 11, latencyIdx);
                    extracted = extracted.replace(/^\s*"/, '').replace(/",?\s*$/, '');
                    try {
                        extracted = JSON.parse('"' + extracted.replace(/\\"/g, '"').replace(/"/g, '\\"') + '"');
                    } catch (e) {}
                    displayText = extracted;
                } else {
                    displayText = text;
                }
            } else {
                displayText = text;
            }
            // (출처: ... ) 패턴 하이라이트 적용
            bubbleDiv.innerHTML = this.highlightSource(this.escapeHtml(displayText)).replace(/\n/g, '<br>');
        } else {
            bubbleDiv.textContent = text;
        }

        messageDiv.appendChild(bubbleDiv);

        // bot 답변일 때 평가 버튼 추가
        if (type === 'bot') {
            const feedbackContainer = document.createElement('div');
            feedbackContainer.className = 'feedback-container';
            feedbackContainer.style.display = 'none'; // 기본 숨김
            feedbackContainer.style.justifyContent = 'center';
            feedbackContainer.style.alignItems = 'center';
            feedbackContainer.style.width = '100%';
            feedbackContainer.style.marginTop = '8px';

            const likeBtn = document.createElement('button');
            likeBtn.textContent = '👍';
            likeBtn.className = 'feedback-btn';

            const dislikeBtn = document.createElement('button');
            dislikeBtn.textContent = '👎';
            dislikeBtn.className = 'feedback-btn';

            let feedbackGiven = false;
            const handleFeedback = async (result) => {
                if (feedbackGiven) return;
                feedbackGiven = true;
                likeBtn.disabled = true;
                dislikeBtn.disabled = true;
                likeBtn.style.opacity = '0.5';
                dislikeBtn.style.opacity = '0.5';
                console.log('답변 평가:', result, text);

                // 타이핑 인디케이터 표시
                const typingIndicator = document.getElementById('typingIndicator');
                typingIndicator.classList.add('show');

                try {
                    // 체크된 메시지 확인 후 분기
                    chrome.storage.local.get(['checkedMessages', 'productStore', 'lastStoredProductId'], async (result) => {
                        const checkedMessages = result.checkedMessages || {};
                        const checkedList = Object.entries(checkedMessages).filter(([text, checked]) => checked).map(([text]) => text);
                        if (checkedList.length > 0) {
                            // 체크된 메시지가 있으면 isReal API 호출
                            const response = await API.sendIsReal(text, checkedList, result.productStore, result.lastStoredProductId);
                            typingIndicator.classList.remove('show');
                            if (window.llmInstance) window.llmInstance.addMessage(response, 'bot');
                        } else {
                            // 없으면 기존 API 호출
                            const response = await API.sendChat(text);
                            typingIndicator.classList.remove('show');
                            if (window.llmInstance) window.llmInstance.addMessage(response, 'bot');
                        }
                    });
                } catch (error) {
                    typingIndicator.classList.remove('show');
                    if (window.llmInstance) window.llmInstance.addMessage('죄송합니다. 응답을 받아오는 중에 오류가 발생했습니다.', 'bot');
                }
            };
            likeBtn.addEventListener('click', () => handleFeedback('like'));
            dislikeBtn.addEventListener('click', () => handleFeedback('dislike'));

            feedbackContainer.appendChild(likeBtn);
            feedbackContainer.appendChild(dislikeBtn);
            messageDiv.appendChild(feedbackContainer);

            // 답변이 추가된 후 0.5초 뒤에 버튼 표시
            setTimeout(() => {
                feedbackContainer.style.display = 'flex';
            }, 500);
        }

        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

        // 사용자 질문 저장
        messageDiv.dataset.question = text;
    }

    renderLLMResponse(rawObj) {
        if (!rawObj || !rawObj.response) return '';
        return this.escapeHtml(rawObj.response).replace(/\n/g, '<br>');
    }

    escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    highlightSource(text) {
        return text.replace(/\(출처:[^)]+?\)/g, function(match) {
            return '<span class="source-highlight">' + match + '</span>';
        });
    }
}

// 초기 로드
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    
    // 로딩 스피너 표시
    toggleLoadingSpinner(true);
    
    // 페이지 로드
    setTimeout(() => {
        loadAppropriatePage();
        // LLMChatExtension 초기화
        window.llmInstance = new LLMChatExtension();
        // 툴팁 초기화
        initializeTooltips();
    }, 1000);
});

// 채팅 관련 요소들
const chatButton = document.getElementById('floatingBtn');
const chatInputContainer = document.getElementById('inputPanel');
const chatInput = document.getElementById('inputBar');
const chatWindow = document.getElementById('chatContainer');
const chatMessages = document.getElementById('chatMessages');
const chatWindowInput = document.getElementById('chatInput');
const backButton = document.getElementById('backButton');

// 채팅 상태 관리
let isChatExpanded = false;

// 채팅 관련 요소들이 모두 존재하는 경우에만 이벤트 리스너 등록
if (chatButton && chatInputContainer && chatInput && chatWindow && chatMessages && chatWindowInput && backButton) {
    console.log('✅ 채팅 UI 요소 초기화 완료');
    
    // 채팅 버튼 클릭 이벤트
    chatButton.addEventListener('click', () => {
        console.log('🖱️ 채팅 버튼 클릭');
        chatButton.style.display = 'none';
        chatInputContainer.style.display = 'block';
        chatInput.focus();
    });

    // 채팅 입력 필드에서 엔터 키 이벤트
    chatInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && chatInput.value.trim()) {
            const message = chatInput.value.trim();
            console.log('⌨️ 초기 입력 필드 메시지:', message);
            
            if (window.llmInstance) window.llmInstance.addMessage(message, 'user');
            chatInput.value = '';
            
            // 채팅 창으로 전환
            chatInputContainer.style.display = 'none';
            chatWindow.style.display = 'flex';
            
            // 타이핑 인디케이터 표시
            const typingIndicator = document.getElementById('typingIndicator');
            typingIndicator.classList.add('show');

            try {
                // 체크된 메시지 확인 후 분기
                chrome.storage.local.get(['checkedMessages', 'productStore', 'lastStoredProductId'], async (result) => {
                    const checkedMessages = result.checkedMessages || {};
                    const checkedList = Object.entries(checkedMessages).filter(([text, checked]) => checked).map(([text]) => text);
                    if (checkedList.length > 0) {
                        // 체크된 메시지가 있으면 isReal API 호출
                        const response = await API.sendIsReal(message, checkedList, result.productStore, result.lastStoredProductId);
                        typingIndicator.classList.remove('show');
                        if (window.llmInstance) window.llmInstance.addMessage(response, 'bot');
                    } else {
                        // 없으면 기존 API 호출
                        const response = await API.sendChat(message);
                        typingIndicator.classList.remove('show');
                        if (window.llmInstance) window.llmInstance.addMessage(response, 'bot');
                    }
                });
            } catch (error) {
                typingIndicator.classList.remove('show');
                if (window.llmInstance) window.llmInstance.addMessage('죄송합니다. 응답을 받아오는 중에 오류가 발생했습니다.', 'bot');
            }
        }
    });

    // 채팅 창에서 엔터 키 이벤트
    chatWindowInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && chatWindowInput.value.trim()) {
            e.preventDefault(); // 기본 엔터 동작 방지
            const message = chatWindowInput.value.trim();
            console.log('⌨️ 채팅 창 메시지:', message);
            
            if (window.llmInstance) window.llmInstance.addMessage(message, 'user');
            chatWindowInput.value = '';
            chatWindowInput.style.height = 'auto'; // 높이 초기화
            
            // 타이핑 인디케이터 표시
            const typingIndicator = document.getElementById('typingIndicator');
            typingIndicator.classList.add('show');

            try {
                // 체크된 메시지 확인 후 분기
                chrome.storage.local.get(['checkedMessages', 'productStore', 'lastStoredProductId'], async (result) => {
                    const checkedMessages = result.checkedMessages || {};
                    const checkedList = Object.entries(checkedMessages).filter(([text, checked]) => checked).map(([text]) => text);
                    if (checkedList.length > 0) {
                        // 체크된 메시지가 있으면 isReal API 호출
                        const response = await API.sendIsReal(message, checkedList, result.productStore, result.lastStoredProductId);
                        typingIndicator.classList.remove('show');
                        if (window.llmInstance) window.llmInstance.addMessage(response, 'bot');
                    } else {
                        // 없으면 기존 API 호출
                        const response = await API.sendChat(message);
                        typingIndicator.classList.remove('show');
                        if (window.llmInstance) window.llmInstance.addMessage(response, 'bot');
                    }
                });
            } catch (error) {
                typingIndicator.classList.remove('show');
                if (window.llmInstance) window.llmInstance.addMessage('죄송합니다. 응답을 받아오는 중에 오류가 발생했습니다.', 'bot');
            }
        }
    });

    // 전송 버튼 클릭 이벤트
    const sendButton = document.getElementById('chatSendBtn');
    if (sendButton) {
        sendButton.addEventListener('click', async () => {
            const message = chatWindowInput.value.trim();
            if (!message) return;
            
            console.log('🖱️ 전송 버튼 메시지:', message);
            
            if (window.llmInstance) window.llmInstance.addMessage(message, 'user');
            chatWindowInput.value = '';
            chatWindowInput.style.height = 'auto'; // 높이 초기화
            
            // 타이핑 인디케이터 표시
            const typingIndicator = document.getElementById('typingIndicator');
            typingIndicator.classList.add('show');

            try {
                // 체크된 메시지 확인 후 분기
                chrome.storage.local.get(['checkedMessages', 'productStore', 'lastStoredProductId'], async (result) => {
                    const checkedMessages = result.checkedMessages || {};
                    const checkedList = Object.entries(checkedMessages).filter(([text, checked]) => checked).map(([text]) => text);
                    if (checkedList.length > 0) {
                        // 체크된 메시지가 있으면 isReal API 호출
                        const response = await API.sendIsReal(message, checkedList, result.productStore, result.lastStoredProductId);
                        typingIndicator.classList.remove('show');
                        if (window.llmInstance) window.llmInstance.addMessage(response, 'bot');
                    } else {
                        // 없으면 기존 API 호출
                        const response = await API.sendChat(message);
                        typingIndicator.classList.remove('show');
                        if (window.llmInstance) window.llmInstance.addMessage(response, 'bot');
                    }
                });
            } catch (error) {
                typingIndicator.classList.remove('show');
                if (window.llmInstance) window.llmInstance.addMessage('죄송합니다. 응답을 받아오는 중에 오류가 발생했습니다.', 'bot');
            }
        });
    }

    // 뒤로가기 버튼 클릭 이벤트
    backButton.addEventListener('click', () => {
        console.log('🖱️ 뒤로가기 버튼 클릭');
        chatWindow.style.display = 'none';
        chatButton.style.display = 'flex';
        // sidepanel_product.html로 이동
        toggleLoadingSpinner(true);
        loadIframe('sidepanel_product.html');
    });
}

// ===== API 모듈화 시작 =====
const API = {
    async request(url, options = {}) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                console.error('❌ API 응답 에러:', {
                    status: response.status,
                    statusText: response.statusText
                });
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('❌ API 호출 에러:', {
                message: error.message,
                stack: error.stack
            });
            throw error;
        }
    },
    async sendChat(question) {
        console.log('📤 API 요청 시작:', { question });
        const storageData = await chrome.storage.local.get(['productStore', 'lastStoredProductId']);
        const productStore = storageData.productStore || {};
        const lastStoredProductId = storageData.lastStoredProductId;
        let chatRoomId = 0;
        if (lastStoredProductId && productStore[lastStoredProductId]) {
            const currentProduct = productStore[lastStoredProductId];
            if (currentProduct.chatRoomId) {
                chatRoomId = currentProduct.chatRoomId;
            }
        }
        const url = 'https://13.125.148.205/api/chatroom/chat';
        const body = JSON.stringify({ chatRoomId, question });
        const data = await this.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        });
        if (data.isSuccess) return data.result;
        throw new Error(data.message || 'API 호출 실패');
    },
    async analyzeMessages(chatRoomId, messages) {
        const url = 'https://13.125.148.205/api/chatroom/message';
        const body = JSON.stringify({ chatRoomId, message: messages });
        const data = await this.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        });
        if (data.isSuccess) return data.result;
        throw new Error(data.message || '채팅 분석 API 호출 실패');
    },
    async sendIsReal(question, checkedList, productStore, lastStoredProductId) {
        let chatRoomId = 0;
        if (lastStoredProductId && productStore && productStore[lastStoredProductId]) {
            const currentProduct = productStore[lastStoredProductId];
            if (currentProduct.chatRoomId) {
                chatRoomId = currentProduct.chatRoomId;
            }
        }
        const seller_chat = checkedList.join('\n');
        const url = 'https://13.125.148.205/api/chatroom/isReal';
        const body = JSON.stringify({ chatRoomId, seller_chat, question });
        const data = await this.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        });
        if (data.isSuccess) return data.result;
        throw new Error(data.message || 'isReal API 호출 실패');
    },
    async getChatroomByProductId(productId) {
        const url = `https://13.125.148.205:443/api/chatroom/product/${productId}`;
        const data = await this.request(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        return data;
    },
    async sendMessage(message) {
        const { currentChatroomId } = await chrome.storage.local.get(['currentChatroomId']);
        if (!currentChatroomId) {
            throw new Error('채팅방 ID를 찾을 수 없음');
        }
        const url = 'https://13.125.148.205:443/api/chatroom/message';
        const body = JSON.stringify({
            chatroomId: currentChatroomId,
            content: message,
            sender: 'buyer'
        });
        const data = await this.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        });
        return data;
    },
    async getRecommendQuestions(chatRoomId) {
        const url = `https://13.125.148.205/api/chatroom/recommend/${chatRoomId}`;
        const data = await this.request(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (data.isSuccess) return data.result;
        throw new Error(data.message || '추천 질문 API 호출 실패');
    }
};
// ===== API 모듈화 끝 =====

// 체크된 메시지 상태를 저장할 객체
let checkedMessages = {};
// 채팅 연결 상태 변수 추가
let isChatConnected = false;

// 체크박스 상태에 따라 헤더 표시 여부 업데이트
function updateChatHeader() {
    const header = document.getElementById('quotedMessagesHeader');
    if (!header) return;

    const hasCheckedMessages = Object.values(checkedMessages).some(checked => checked);
    header.classList.toggle('show', hasCheckedMessages);
}

// 연결 버튼 상태 업데이트 함수 추가
function updateConnectButtonState() {
    const connectBtn = document.getElementById('connectButton');
    if (!connectBtn) return;
    
    if (isChatConnected) {
        connectBtn.textContent = '연결';
        connectBtn.style.background = '#e9ecef';
        connectBtn.style.color = '#495057';
    } else {
        connectBtn.textContent = '판매자 채팅 연결';
        connectBtn.style.background = '#007bff';
        connectBtn.style.color = 'white';
    }
}

// 번개장터 채팅 메시지 표시 함수
function displayBunjangChat(chatData) {
    const container = document.getElementById('bunjangChatContainer');
    if (!container) return;

    // 채팅 데이터가 있으면 연결 상태로 변경
    if (chatData && chatData.messages && chatData.messages.length > 0) {
        isChatConnected = true;
        updateConnectButtonState();
    }

    // 추천 질문 컨테이너가 없으면 생성
    let recommendContainer = document.getElementById('recommendQuestionsContainer');
    if (!recommendContainer) {
        recommendContainer = document.createElement('div');
        recommendContainer.id = 'recommendQuestionsContainer';
        recommendContainer.style.display = 'flex';
        recommendContainer.style.flexDirection = 'row';
        recommendContainer.style.gap = '10px';
        recommendContainer.style.alignItems = 'center';
        recommendContainer.style.justifyContent = 'flex-start';
        recommendContainer.style.padding = '0 24px 8px 24px';
        recommendContainer.style.background = 'transparent';
        // 헤더 바로 아래에 붙이기
        const header = document.getElementById('bunjangChatHeader');
        if (header && header.parentNode) {
            header.parentNode.insertBefore(recommendContainer, header.nextSibling);
        } else {
            container.parentNode.insertBefore(recommendContainer, container);
        }
    }
    // 새로고침 버튼 생성 (없으면)
    let refreshBtn = document.getElementById('recommendRefreshBtn');
    if (!refreshBtn) {
        refreshBtn = document.createElement('button');
        refreshBtn.id = 'recommendRefreshBtn';
        refreshBtn.textContent = '⟳';
        refreshBtn.style.background = 'linear-gradient(135deg, #fffbe7 60%, #ffe0b2 100%)';
        refreshBtn.style.border = '1.2px solid #ffd54f';
        refreshBtn.style.color = '#ff9800';
        refreshBtn.style.fontWeight = '700';
        refreshBtn.style.fontSize = '18px';
        refreshBtn.style.borderRadius = '50%';
        refreshBtn.style.width = '32px';
        refreshBtn.style.height = '32px';
        refreshBtn.style.display = 'flex';
        refreshBtn.style.alignItems = 'center';
        refreshBtn.style.justifyContent = 'center';
        refreshBtn.style.cursor = 'pointer';
        refreshBtn.style.boxShadow = '0 2px 8px rgba(255, 193, 7, 0.10)';
        refreshBtn.style.transition = 'background 0.18s, box-shadow 0.18s';
        refreshBtn.style.marginLeft = '8px';
        recommendContainer.appendChild(refreshBtn);
    }
    // 추천 질문 상태 관리
    let recommendQuestions = [];
    let recommendIndex = 0;
    function renderRecommendButtons() {
        // 기존 버튼 제거
        Array.from(recommendContainer.querySelectorAll('.recommend-animated-btn')).forEach(btn => btn.remove());
        // 최대 2개만 노출
        const showQuestions = recommendQuestions.slice(recommendIndex, recommendIndex + 2);
        showQuestions.forEach((q, idx) => {
            const btn = document.createElement('button');
            btn.className = 'recommend-animated-btn';
            btn.style.background = '#ffffff';
            btn.style.border = '1.2px solid #ffd54f';
            btn.style.color = '#ff9800';
            btn.style.fontWeight = '600';
            btn.style.marginRight = '8px';
            btn.style.fontSize = '15px';
            btn.style.padding = '10px 18px';
            btn.style.borderRadius = '16px';
            btn.style.boxShadow = '0 2px 8px rgba(255, 193, 7, 0.10)';
            btn.style.transition = 'transform 0.18s cubic-bezier(0.4,0,0.2,1), box-shadow 0.18s cubic-bezier(0.4,0,0.2,1), background 0.18s';
            btn.textContent = q.split(':').pop().trim();
            btn.onmouseenter = () => {
                btn.style.transform = 'scale(1.07)';
                btn.style.background = '#fffde7';
                btn.style.boxShadow = '0 8px 32px rgba(255, 193, 7, 0.18)';
            };
            btn.onmouseleave = () => {
                btn.style.transform = 'scale(1)';
                btn.style.background = 'linear-gradient(135deg, #fffbe7 60%, #ffe0b2 100%)';
                btn.style.boxShadow = '0 2px 8px rgba(255, 193, 7, 0.10)';
            };
            btn.onmousedown = () => {
                btn.style.transform = 'scale(0.97)';
            };
            btn.onmouseup = () => {
                btn.style.transform = 'scale(1.07)';
            };
            btn.onclick = () => {
                navigator.clipboard.writeText(btn.textContent).then(() => {
                    showToast('복사되었습니다');
                });
            };
            recommendContainer.insertBefore(btn, refreshBtn);
        });
    }
    // storage에서 chatRoomId 가져오기
    chrome.storage.local.get(['productStore', 'lastStoredProductId'], async (result) => {
        let chatRoomId = 0;
        const productStore = result.productStore || {};
        const lastStoredProductId = result.lastStoredProductId;
        if (lastStoredProductId && productStore[lastStoredProductId]) {
            const currentProduct = productStore[lastStoredProductId];
            if (currentProduct.chatRoomId) {
                chatRoomId = currentProduct.chatRoomId;
            }
        }
        if (chatRoomId) {
            try {
                const questions = await API.getRecommendQuestions(chatRoomId);
                if (Array.isArray(questions) && questions.length > 0) {
                    recommendQuestions = questions;
                    recommendIndex = 0;
                    renderRecommendButtons();
                } else {
                    recommendContainer.innerHTML = '<div style="color:#aaa;font-size:13px;">추천 질문이 없습니다.</div>';
                }
            } catch (e) {
                recommendContainer.innerHTML = '<div style="color:#aaa;font-size:13px;">추천 질문을 불러오지 못했습니다.</div>';
            }
        } else {
            recommendContainer.innerHTML = '<div style="color:#aaa;font-size:13px;">추천 질문을 불러올 수 없습니다.</div>';
        }
    });
    // 새로고침 버튼 동작
    refreshBtn.onclick = () => {
        if (!recommendQuestions.length) return;
        recommendIndex += 2;
        if (recommendIndex >= recommendQuestions.length) recommendIndex = 0;
        renderRecommendButtons();
    };

    // 판매자 메시지만 필터링
    const sellerMessages = chatData.messages.filter(msg => msg.sender === 'seller');

    // 컨테이너 내용 초기화 (헤더는 유지)
    const header = container.querySelector('.bunjang-chat-header');
    container.innerHTML = '';
    if (header) container.appendChild(header);

    // 메시지 추가
    sellerMessages.forEach((msg, index) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'bunjang-message';
        
        // 체크박스 생성
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'bunjang-message-checkbox';
        checkbox.checked = checkedMessages[msg.text] || false;
        
        // 체크박스 이벤트 리스너
        checkbox.addEventListener('change', (e) => {
            checkedMessages[msg.text] = e.target.checked;
            // 체크 상태 저장
            chrome.storage.local.set({ checkedMessages });
            // 헤더 상태 업데이트
            updateChatHeader();
        });
        
        const messageContent = document.createElement('div');
        messageContent.className = 'bunjang-message-content';
        messageContent.textContent = msg.text;
        
        messageDiv.appendChild(checkbox);
        messageDiv.appendChild(messageContent);
        container.appendChild(messageDiv);
    });

    // 헤더 상태 업데이트
    updateChatHeader();

    // 스크롤을 최신 메시지로 이동
    container.scrollTop = container.scrollHeight;
}

// 저장된 체크 상태 불러오기
chrome.storage.local.get(['checkedMessages'], (result) => {
    if (result.checkedMessages) {
        checkedMessages = result.checkedMessages;
        // 초기 헤더 상태 업데이트
        updateChatHeader();
    }
});

// 채팅 연결 버튼 클릭 시 연결 상태 true로 변경
document.addEventListener('DOMContentLoaded', () => {
    const connectBtn = document.getElementById('connectButton');
    if (connectBtn) {
        connectBtn.addEventListener('click', () => {
            isChatConnected = true;
            updateChatHeader();
        });
    }
});

// 토스트 메시지 함수 추가 (파일 하단에)
function showToast(message) {
    let toast = document.getElementById('customToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'customToast';
        toast.style.position = 'fixed';
        toast.style.bottom = '48px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.background = 'rgba(50,50,50,0.95)';
        toast.style.color = '#fff';
        toast.style.padding = '14px 32px';
        toast.style.borderRadius = '24px';
        toast.style.fontSize = '16px';
        toast.style.fontWeight = '600';
        toast.style.zIndex = '9999';
        toast.style.opacity = '0';
        toast.style.pointerEvents = 'none';
        toast.style.transition = 'opacity 0.3s';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 1200);
}

// 툴팁 초기화 함수
function initializeTooltips() {
    const tooltips = document.querySelectorAll('.tooltip');
    tooltips.forEach(tooltip => {
        const tooltipText = tooltip.querySelector('.tooltip-text');
        if (tooltipText) {
            // 툴팁 위치 조정
            const updateTooltipPosition = () => {
                const rect = tooltip.getBoundingClientRect();
                const tooltipRect = tooltipText.getBoundingClientRect();
                
                // 화면 왼쪽 경계 체크
                if (rect.left < tooltipRect.width / 2) {
                    tooltipText.style.left = '0';
                    tooltipText.style.transform = 'translateX(0)';
                }
                // 화면 오른쪽 경계 체크
                else if (rect.right + tooltipRect.width / 2 > window.innerWidth) {
                    tooltipText.style.left = 'auto';
                    tooltipText.style.right = '0';
                    tooltipText.style.transform = 'none';
                }
                // 화면 위쪽 경계 체크
                if (rect.top < tooltipRect.height) {
                    tooltipText.style.bottom = 'auto';
                    tooltipText.style.top = '125%';
                    tooltipText.style.transform = 'translateX(-50%)';
                }
            };

            // 마우스 진입 시 위치 업데이트
            tooltip.addEventListener('mouseenter', updateTooltipPosition);
            // 창 크기 변경 시 위치 업데이트
            window.addEventListener('resize', updateTooltipPosition);
        }
    });
} 