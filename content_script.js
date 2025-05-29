(() => {
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
})();
