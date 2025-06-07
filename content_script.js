(() => {
  const url = window.location.href;
  const isTalkPage = /^https:\/\/m\.bunjang\.co\.kr\/talk2\/user\/.*$/.test(url);
  const isProductPage = /^https:\/\/m\.bunjang\.co\.kr\/products\/.*$/.test(url);
  if (!isTalkPage && !isProductPage) {
    return;
  }
// 0. DOM이 완전히 로드된 이후에 실행
  if (isTalkPage) {
  // 0. DOM이 완전히 로드된 이후에 실행
  window.addEventListener('load', () => {
    // 1. 메시지 추출·업데이트 함수
    function updateLog() {
      const spans = document.querySelectorAll("span.sc-izQBue");
      const messages = Array.from(spans)
        .map(span => span.querySelector("p"))
        .filter(p => p)
        .map(p => p.innerText);

      // 사이드탭에 메시지 전송
      chrome.runtime.sendMessage({
        type: 'UPDATE_CHAT',
        messages: messages
      });
    }

    // 2. 초기 한 번 실행
    updateLog();

    // 3. 관찰 대상: 가능한 채팅 컨테이너로 한정하세요.
    const chatContainer = document.body;

    // 4. 옵저버 설정
    const observer = new MutationObserver(mutations => {
      let needsUpdate = false;
      for (const m of mutations) {
        if (m.type === "childList") {
          for (const node of m.addedNodes) {
            needsUpdate = true;
            break;
          }
        }
        if (needsUpdate) break;
      }
      if (needsUpdate) updateLog();
    });

    // 5. 실제 관찰 시작
    observer.observe(chatContainer, {
      childList: true,
      subtree: true
    });

    // (선택) 일정 시간 후 자동 해제
    setTimeout(() => observer.disconnect(), 90_000);
  });

  document.addEventListener('mouseup', () => {
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';
    if (selectedText.length > 0) {
      chrome.runtime.sendMessage({ type: 'SELECTED_TEXT', text: selectedText });
    }
  });

  // 중요 키워드 목록
  const KEYWORDS = {
    '가격': ['가격', '원', '만원', '천원', '비용', '금액', '가격협의', '가격제안'],
    '하자': ['하자', '흠집', '스크래치', '기스', '파손', '고장', '불량'],
    '배송': ['배송', '택배', '배달', '직거래', '만나서', '수령'],
    '상태': ['상태', '새상품', '중고', '사용감', '깨끗', '깨끗함'],
    '교환': ['교환', '반품', '환불', '취소']
  };

  // 채팅 메시지 모니터링
  function observeChatMessages() {
    const chatContainer = document.querySelector('.chat-messages-container');
    if (!chatContainer) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const messageElements = node.querySelectorAll('.message-content');
              messageElements.forEach(element => {
                if (!element.dataset.kakasHighlighted) {
                  const originalText = element.innerHTML;
                  const highlightedText = originalText;
                  if (highlightedText !== originalText) {
                    element.innerHTML = highlightedText;
                    element.dataset.kakasHighlighted = 'true';
                  }
                }
              });
            }
          });
        }
      });
    });

    observer.observe(chatContainer, {
      childList: true,
      subtree: true
    });
  }

  // 초기화
  function initialize() {
    observeChatMessages();
  }

  // 페이지 로드 완료 후 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  } else if (isProductPage) {
    // TODO: Implement product page script here
  }
})();
