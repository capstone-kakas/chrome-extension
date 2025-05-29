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