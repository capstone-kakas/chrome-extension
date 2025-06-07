// 메시지 타입 상수
const MESSAGE_TYPES = {
  SELECTED_TEXT: 'SELECTED_TEXT',
  UPDATE_PRODUCT_INFO: 'UPDATE_PRODUCT_INFO',
  GET_PRODUCT_INFO: 'GET_PRODUCT_INFO',
  CHECK_TAB_ACTIVE: 'CHECK_TAB_ACTIVE'
};

// 메시지 전송 함수 (재시도 로직 포함)
function sendMessageWithRetry(message, maxRetries = 3) {
  return new Promise((resolve, reject) => {
    let retryCount = 0;
    
    function trySend() {
      chrome.runtime.sendMessage(message, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Message send error:', chrome.runtime.lastError);
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying... (${retryCount}/${maxRetries})`);
            setTimeout(trySend, 1000);
          } else {
            reject(new Error('Max retries reached'));
          }
          return;
        }
        resolve(response);
      });
    }
    
    trySend();
  });
}

function sendChatroomRequest(productInfo) {
  fetch('http://13.125.148.205:8080/api/chatroom', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      memberId: productInfo.memberId ?? 0,
      chatRoomTitle: productInfo.productName ?? '제목 없음',
      content: productInfo.description ?? '',
      category: productInfo.categoryId ?? 0,
      deliveryFee: productInfo.deliveryFee ?? '',
      seller: Number(productInfo.sellerId) || 0,
      price: productInfo.price ?? '',
      status: productInfo.status ?? ''
    })
  })
  .then(res => res.json())
  .then(data => {
    console.log('✅ 서버 응답:', data);
  })
  .catch(err => {
    console.error('❗ API 호출 에러:', err);
  });
}

(() => {
  const url = window.location.href;
  console.log('Current URL:', url);
  
  // URL 패턴 수정
  const isTalkPage = /^https:\/\/m\.bunjang\.co\.kr\/talk2\/user\/\d+/.test(url) || 
                    /^https:\/\/talk\.bunjang\.co\.kr\/?$/.test(url);
  const isProductPage = /^https:\/\/m\.bunjang\.co\.kr\/products\/\d+/.test(url);
  
  console.log('Page type detection:', {
    isTalkPage,
    isProductPage,
    url,
    matchedTalkPattern: /^https:\/\/m\.bunjang\.co\.kr\/talk2\/user\/\d+/.test(url),
    matchedTalkPattern2: /^https:\/\/talk\.bunjang\.co\.kr\/?$/.test(url),
    matchedProductPattern: /^https:\/\/m\.bunjang\.co\.kr\/products\/\d+/.test(url)
  });

  // 현재 탭이 활성화되어 있는지 확인하는 함수
  async function checkIfTabActive() {
    try {
      const response = await sendMessageWithRetry({ type: MESSAGE_TYPES.CHECK_TAB_ACTIVE });
      return response && response.isActive;
    } catch (error) {
      console.error('Failed to check tab active status:', error);
      return false;
    }
  }

  // 메시지 리스너 추가
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);
    
    if (message.type === MESSAGE_TYPES.GET_PRODUCT_INFO) {
      if (isTalkPage) {
        // 채팅 페이지에서는 상품 정보 조회만 수행
        extractProductId();
        sendResponse({ success: true });
      } else if (isProductPage) {
        // 상품 페이지에서만 상품 정보 저장 수행
        const productInfo = getProductInfo();
        sendResponse({ productInfo });
      }
    }
    
    return true; // 비동기 응답을 위해 true 반환
  });

  if (!isTalkPage && !isProductPage) {
    console.log('Not a target page, exiting...');
    return;
  }

  if (isTalkPage) {
    console.log('Talk page loaded, attempting to find product name');
    // 채팅 페이지에서는 상품 정보 저장 시도하지 않음
    function extractProductId() {
      // URL에서 판매자 ID 추출
      const sellerId = window.location.pathname.split('/').pop();
      console.log('Found seller ID from URL:', sellerId);

      if (!sellerId) {
        console.log('No seller ID found in URL');
        return null;
      }

      // storage에서 해당 판매자의 상품 찾기
      chrome.storage.local.get(['productStore'], function(result) {
        const productStore = result.productStore || {};
        const matchedProduct = Object.values(productStore).find(product => 
          product.sellerId === sellerId
        );
        
        if (matchedProduct) {
          console.log('Found matching product for seller:', matchedProduct);
          // 사이드패널에 상품 정보 전달
           // 👇 여기 아래에 추가!
          fetch('http://13.125.148.205:8080/api/chatroom', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              memberId: matchedProduct.memberId ?? 0,
              chatRoomTitle: matchedProduct.productName ?? '제목 없음',
              content: matchedProduct.description ?? '',
              category: matchedProduct.categoryId ?? 0,
              deliveryFee: matchedProduct.deliveryFee ?? '',
              seller: Number(matchedProduct.sellerId) || 0,
              price: matchedProduct.price ?? '',
              status: matchedProduct.status ?? ''
            })
          })
          .then(res => res.json())
          .then(data => {
            console.log('✅ 채팅 생성 응답:', data);
            if (data.isSuccess) {
              const suggestedNames = data.result.suggestedProductNames || [];
              console.log('💡 추천 상품명:', suggestedNames);
            }
          })
          .catch(err => {
            console.error('❗ API 호출 실패:', err);
          });
          chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.UPDATE_PRODUCT_INFO,
            productInfo: matchedProduct
          });
        } else {
          console.log('No matching product found for seller ID:', sellerId);
        }
      });

      return null;
    }

    // 초기화
    function initialize() {
      observeChatMessages();
      extractProductId(); // 초기 로드 시에도 실행
    }

    // 페이지 로드 완료 후 초기화
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initialize);
    } else {
      initialize();
    }

    document.addEventListener('mouseup', () => {
      const selection = window.getSelection();
      const selectedText = selection ? selection.toString().trim() : '';
      if (selectedText.length > 0) {
        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SELECTED_TEXT, text: selectedText });
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
  } else if (isProductPage) {
    // 상품 페이지에서만 실행되는 코드
    console.log('Product page loaded, starting to store product info');
    
    // 상품 정보를 가져오는 함수
    function getProductInfo() {
      console.log('Getting product info from product page');
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

      // ✅ 8. 사용자 ID 목업
      const memberId = 1;

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
        sellerId,
        memberId
      };

      console.log('Extracted product info:', data);
      return data;
    }

    // 페이지 로드 완료 후 상품 정보 저장
    function storeProductInfo(productInfo) {
      console.log('Attempting to store product info');
      
      // 필수 정보가 모두 있는지 확인
      if (!productInfo.productId || !productInfo.productName || !productInfo.price) {
        console.log('Waiting for product info to be fully loaded...');
        setTimeout(() => storeProductInfo(productInfo), 1000); // 1초 후 다시 시도
        return;
      }
      
      // storage에서 기존 상품 정보 가져오기
      chrome.storage.local.get(['productStore'], function(result) {
        let productStore = result.productStore || {};
        
        // 새로운 상품 정보 추가
        productStore = {
          ...productStore,
          [productInfo.productId]: productInfo
        };
        
        // storage에 저장
        chrome.storage.local.set({ productStore }, function() {
          console.log('Product info stored:', productInfo);
          console.log('Current product store:', productStore);
          console.log('Sending chatroom request...');
          sendChatroomRequest(productInfo);
        });
      });
    }

    // URL 변경 감지 로직
    function watchUrlChanges(callback) {
      let lastUrl = window.location.href;
      if (!(document.body instanceof Node)) return;
      const observer = new MutationObserver(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
          lastUrl = currentUrl;
          callback(currentUrl);
        }
      });

      // document.body가 없는 경우를 처리
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      } else {
        // body가 아직 없으면 DOMContentLoaded 후 시도
        document.addEventListener('DOMContentLoaded', function onBodyReady() {
          if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
            document.removeEventListener('DOMContentLoaded', onBodyReady);
          }
        });
      }

      window.addEventListener('popstate', () => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
          lastUrl = currentUrl;
          callback(currentUrl);
        }
      });
    }

    watchUrlChanges((newUrl) => {
      const isNowTalkPage = /^https:\/\/m\.bunjang\.co\.kr\/talk2\/user\/\d+/.test(newUrl);
      const isNowProductPage = /^https:\/\/m\.bunjang\.co\.kr\/products\/\d+/.test(newUrl);

      if (isNowTalkPage) {
        console.log('Switched to Talk Page, skipping product info store.');
      } else if (isNowProductPage) {
        console.log('Switched to Product Page, triggering product info store.');
        const productInfo = getProductInfo();
        storeProductInfo(productInfo);
      }
    });

    // 페이지 로드 완료 후 상품 정보 저장 시도
    window.addEventListener('load', () => {
      const productInfo = getProductInfo();
      storeProductInfo(productInfo);
    });
  }
})();
