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
    // 상품 정보를 가져오는 함수
    function getProductInfo() {
      // ✅ 0. 상품 ID 추출
      const pathParts = window.location.pathname.split('/');
      const productId = pathParts[2] || null;

      // ✅ 1. 상품명
      const titleEl = document.querySelector(
        '.ProductSummarystyle__Name-sc-oxz0oy-3.dZBHcg'
      );
      const productName = titleEl ? titleEl.textContent.trim() : null;

      // ✅ 2. 가격
      const priceEl = document.querySelector(
        '.ProductSummarystyle__Price-sc-oxz0oy-5.cspsrp'
      );
      const price = priceEl ? priceEl.textContent.trim() : null;

      // ✅ 3. 상품상태
      const valueEls = document.querySelectorAll(
        '.ProductSummarystyle__Value-sc-oxz0oy-21.eLyjky'
      );
      const status = valueEls[0] ? valueEls[0].textContent.trim() : null;

      // ✅ 4. 배송비
      let deliveryFee = null;
      if (valueEls[1]) {
        const span = valueEls[1].querySelector('span');
        deliveryFee = span ? span.textContent.trim() : valueEls[1].textContent.trim();
      }

      // ✅ 5. 상품설명
      const descEl = document.querySelector(
        '.ProductInfostyle__DescriptionContent-sc-ql55c8-3.eJCiaL p'
      );
      const description = descEl ? descEl.textContent.trim() : null;

      // ✅ 6. 카테고리
      const categoryEls = document.querySelectorAll(
        '.ProductInfostyle__Category-sc-ql55c8-8.EVvbD a'
      );
      const categories = Array.from(categoryEls).map(a => a.textContent.trim());

      // ✅ 6-1. 카테고리 id
      const categoryId = 0;
      if (categories[2] == '닌텐도/NDS/Wii') {
        categoryId = 1;
      } else if (categories[2] == '소니/플레이스테이션') {
        categoryId = 2;
      } else if (categories[2] == 'XBOX') {
        categoryId = 3;
      } else if (categories[2] == 'PC게임') {
        categoryId = 4;
      } else if (categories[2] == '기타 게임/타이틀') {
        categoryId = 5;
      }

      // ✅ 7. 판매자 이름 및 ID
      const sellerLink = document.querySelector(
        'a.ProductSellerstyle__Name-sc-1qnzvgu-7.cCIWgL'
      );
      const sellerName = sellerLink ? sellerLink.textContent.trim() : null;
      const sellerHref = sellerLink ? sellerLink.getAttribute('href') : null;
      const sellerId = sellerHref ? sellerHref.split('/')[2] : null;


      // ✅ 결과 객체 생성
      const data = {
        productId,
        productName,
        price,
        status,
        deliveryFee,
        description,
        categories,
        categoryId,
        sellerName,
        sellerId
      };

      return data;
    }

    // 메시지 리스너 추가
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'GET_PRODUCT_INFO') {
        const productInfo = getProductInfo();
        chrome.runtime.sendMessage({
          type: 'UPDATE_PRODUCT_INFO',
          productInfo: productInfo
        });
      }
    });

    // 페이지 로드 완료 후 상품 정보 전송
    window.addEventListener('load', () => {
      const productInfo = getProductInfo();
      chrome.runtime.sendMessage({
        type: 'UPDATE_PRODUCT_INFO',
        productInfo: productInfo
      });
    });

  }
})();
