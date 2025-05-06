setTimeout(() => {
    // 1. span 태그 중 class에 "sc-izQBue"가 포함된 것들 선택
    const chatElements = document.querySelectorAll("span.sc-izQBue");
  
    // 2. 메시지를 저장할 배열
    const chatMessages = [];
  
    // 3. 각 span에서 <p> 태그를 찾아서 텍스트 추출
    chatElements.forEach(span => {
      const p = span.querySelector("p");
      if (p) {
        chatMessages.push(p.innerText);
      }
    });
  
    // 4. 하단에 표시할 메시지 박스 생성
    const logBox = document.createElement("div");
    logBox.style.position = "fixed";
    logBox.style.bottom = "0";
    logBox.style.left = "0";
    logBox.style.width = "100%";
    logBox.style.maxHeight = "200px";
    logBox.style.overflowY = "auto";
    logBox.style.backgroundColor = "#111";
    logBox.style.color = "#0f0";
    logBox.style.fontSize = "12px";
    logBox.style.padding = "10px";
    logBox.style.zIndex = "9999";
  
    // 5. 메시지를 HTML로 변환
    logBox.innerHTML = "<strong>📩 채팅 메시지:</strong><br>" + chatMessages.map(
      (msg, i) => `[${i + 1}] ${msg}`
    ).join("<br>");
  
    // 6. 페이지에 추가
    document.body.appendChild(logBox);
  
    // 7. 디버깅용 alert
    alert(`✅ 메시지 개수: ${chatMessages.length}`);
  }, 3000); // 3초 후 실행 (DOM + React 렌더링이 다 끝나도록 여유 시간 줌)