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
    <span class="quote-text">“${text}”</span>
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
}); 