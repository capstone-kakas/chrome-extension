// 상수 정의
const MESSAGE_TYPES = {
  SELECTED_TEXT: 'SELECTED_TEXT',
  UPDATE_PRODUCT_INFO: 'UPDATE_PRODUCT_INFO',
  GET_PRODUCT_INFO: 'GET_PRODUCT_INFO',
  CHECK_TAB_ACTIVE: 'CHECK_TAB_ACTIVE'
};

const URL_PATTERNS = {
  TALK_PAGE: /^https:\/\/m\.bunjang\.co\.kr\/talk2\/user\/\d+/,
  TALK_PAGE_ALT: /^https:\/\/talk\.bunjang\.co\.kr\/?$/,
  PRODUCT_PAGE: /^https:\/\/m\.bunjang\.co\.kr\/products\/\d+/
};

const CATEGORY_MAPPING = {
  '닌텐도/NDS/Wii': 1,
  '소니/플레이스테이션': 2,
  'XBOX': 3,
  'PC게임': 4,
  '기타 게임/타이틀': 5
};

// API 관련 함수
async function sendChatroomRequest(productInfo) {
  try {
    const response = await fetch('https://13.125.148.205:443/api/chatroom', {
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
    });
    
    const data = await response.json();
    console.log('✅ 서버 응답:', data);
    return data;
  } catch (err) {
    console.error('❗ API 호출 에러:', err);
    throw err;
  }
}

// 메시지 전송 유틸리티
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

// 상품 정보 관련 함수
function getProductInfo() {
  console.log('Getting product info from product page');
  
  return new Promise((resolve) => {
    const pathParts = window.location.pathname.split('/');
    const productId = pathParts[2] || null;

    // DOM이 준비될 때까지 대기하는 함수
    const waitForElement = (selector, timeout = 10000) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(selector)) {
          return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(() => {
          if (document.querySelector(selector)) {
            observer.disconnect();
            resolve(document.querySelector(selector));
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true
        });

        // 타임아웃 설정
        setTimeout(() => {
          observer.disconnect();
          reject(new Error(`Element ${selector} not found`));
        }, timeout);
      });
    };

    // 모든 필요한 요소가 로드될 때까지 대기
    Promise.all([
      waitForElement('.ProductSummarystyle__Name-sc-oxz0oy-3.dZBHcg'),
      waitForElement('.ProductSummarystyle__Price-sc-oxz0oy-5.cspsrp'),
      waitForElement('.ProductInfostyle__DescriptionContent-sc-ql55c8-3.eJCiaL p'),
      waitForElement('a.ProductSellerstyle__Name-sc-1qnzvgu-7.cCIWgL')
    ]).then(() => {
      const titleEl = document.querySelector('.ProductSummarystyle__Name-sc-oxz0oy-3.dZBHcg');
      const priceEl = document.querySelector('.ProductSummarystyle__Price-sc-oxz0oy-5.cspsrp');
      const valueEls = document.querySelectorAll('.ProductSummarystyle__Value-sc-oxz0oy-21.eLyjky');
      const descEl = document.querySelector('.ProductInfostyle__DescriptionContent-sc-ql55c8-3.eJCiaL p');
      const categoryEls = document.querySelectorAll('.ProductInfostyle__Category-sc-ql55c8-8.EVvbD a');
      const sellerLink = document.querySelector('a.ProductSellerstyle__Name-sc-1qnzvgu-7.cCIWgL');

      const categories = Array.from(categoryEls).map(a => a.textContent.trim());
      const categoryId = CATEGORY_MAPPING[categories[2]] || 0;

      const sellerHref = sellerLink?.getAttribute('href');
      const sellerId = sellerHref ? sellerHref.split('/')[2] : null;

      const data = {
        productId,
        productName: titleEl?.textContent.trim() || null,
        price: priceEl?.textContent.trim() || null,
        status: valueEls[0]?.textContent.trim() || null,
        deliveryFee: valueEls[1]?.querySelector('span')?.textContent.trim() || valueEls[1]?.textContent.trim() || null,
        description: descEl?.textContent.trim() || null,
        categories,
        categoryId,
        sellerName: sellerLink?.textContent.trim() || null,
        sellerId,
        memberId: 1
      };

      console.log('Extracted product info:', data);
      resolve(data);
    }).catch(error => {
      console.error('Error waiting for elements:', error);
      resolve({
        productId,
        productName: null,
        price: null,
        status: null,
        deliveryFee: null,
        description: null,
        categories: [],
        categoryId: 0,
        sellerName: null,
        sellerId: null,
        memberId: 1
      });
    });
  });
}

// 스토리지 관련 함수
async function storeProductInfo(productInfo) {
  console.log('Attempting to store product info');
  
  if (!productInfo.productId || !productInfo.productName || !productInfo.price) {
    console.log('Waiting for product info to be fully loaded...');
    const updatedInfo = await getProductInfo();
    return storeProductInfo(updatedInfo);
  }
  
  // 이미 저장된 상품인지 확인
  return new Promise((resolve) => {
    chrome.storage.local.get(['productStore', 'lastStoredProductId'], function(result) {
      const { productStore = {}, lastStoredProductId } = result;
      
      // 이미 저장된 상품이고 정보가 동일한 경우 저장하지 않음
      if (lastStoredProductId === productInfo.productId) {
        const existingProduct = productStore[productInfo.productId];
        if (existingProduct && 
            existingProduct.productName === productInfo.productName &&
            existingProduct.price === productInfo.price) {
          console.log('Product info already stored and unchanged, skipping...');
          resolve();
          return;
        }
      }
      
      // 새로운 상품 정보 추가
      const updatedProductStore = {
        ...productStore,
        [productInfo.productId]: productInfo
      };
      
      // storage에 저장
      chrome.storage.local.set({ 
        productStore: updatedProductStore,
        lastStoredProductId: productInfo.productId
      }, async function() {
        console.log('Product info stored:', productInfo);
        console.log('Current product store:', updatedProductStore);
        console.log('Sending chatroom request...');
        try {
          await sendChatroomRequest(productInfo);
        } catch (error) {
          console.error('Failed to send chatroom request:', error);
        }
        resolve();
      });
    });
  });
}

// 채팅 페이지 관련 함수
function extractProductId() {
  const sellerId = window.location.pathname.split('/').pop();
  console.log('Found seller ID from URL:', sellerId);

  if (!sellerId) {
    console.log('No seller ID found in URL');
    return null;
  }

  chrome.storage.local.get(['productStore'], async function(result) {
    const productStore = result.productStore || {};
    const matchedProduct = Object.values(productStore).find(product => 
      product.sellerId === sellerId
    );
    
    if (matchedProduct) {
      console.log('Found matching product for seller:', matchedProduct);
      try {
        const response = await sendChatroomRequest(matchedProduct);
        if (response.isSuccess) {
          const suggestedNames = response.result.suggestedProductNames || [];
          console.log('💡 추천 상품명:', suggestedNames);
        }
      } catch (error) {
        console.error('Failed to send chatroom request:', error);
      }
      
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

// URL 변경 감지
function watchUrlChanges(callback) {
  let lastUrl = window.location.href;
  let isProcessing = false; // URL 변경 처리 중 플래그
  
  const observer = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl && !isProcessing) {
      isProcessing = true;
      lastUrl = currentUrl;
      callback(currentUrl);
      // 1초 후에 다시 URL 변경을 감지할 수 있도록 플래그 초기화
      setTimeout(() => {
        isProcessing = false;
      }, 1000);
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', function onBodyReady() {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
        document.removeEventListener('DOMContentLoaded', onBodyReady);
      }
    });
  }

  window.addEventListener('popstate', () => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl && !isProcessing) {
      isProcessing = true;
      lastUrl = currentUrl;
      callback(currentUrl);
      setTimeout(() => {
        isProcessing = false;
      }, 1000);
    }
  });
}

// 메인 실행 함수
(() => {
  const url = window.location.href;
  console.log('Current URL:', url);
  
  const isTalkPage = URL_PATTERNS.TALK_PAGE.test(url) || URL_PATTERNS.TALK_PAGE_ALT.test(url);
  const isProductPage = URL_PATTERNS.PRODUCT_PAGE.test(url);
  
  console.log('Page type detection:', {
    isTalkPage,
    isProductPage,
    url,
    matchedTalkPattern: URL_PATTERNS.TALK_PAGE.test(url),
    matchedTalkPattern2: URL_PATTERNS.TALK_PAGE_ALT.test(url),
    matchedProductPattern: URL_PATTERNS.PRODUCT_PAGE.test(url)
  });

  // 메시지 리스너
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);
    
    if (message.type === MESSAGE_TYPES.GET_PRODUCT_INFO) {
      if (isTalkPage) {
        extractProductId();
        sendResponse({ success: true });
      } else if (isProductPage) {
        getProductInfo().then(productInfo => {
          console.log('Sending product info to sidepanel:', productInfo);
          sendResponse({ productInfo });
        }).catch(error => {
          console.error('Error getting product info:', error);
          sendResponse({ error: error.message });
        });
        return true; // 비동기 응답을 위해 true 반환
      }
    }
    
    return true;
  });

  if (!isTalkPage && !isProductPage) {
    console.log('Not a target page, exiting...');
    return;
  }

  // URL 변경 감지 설정
  watchUrlChanges((newUrl) => {
    const isNowTalkPage = URL_PATTERNS.TALK_PAGE.test(newUrl);
    const isNowProductPage = URL_PATTERNS.PRODUCT_PAGE.test(newUrl);

    if (isNowTalkPage) {
      console.log('Switched to Talk Page, skipping product info store.');
    } else if (isNowProductPage) {
      console.log('Switched to Product Page, triggering product info store.');
      getProductInfo().then(productInfo => {
        storeProductInfo(productInfo);
      });
    }
  });

  // 페이지 타입별 초기화
  if (isTalkPage) {
    console.log('Talk page loaded, attempting to find product name');
    extractProductId();
  } else if (isProductPage) {
    console.log('Product page loaded, starting to store product info');
    getProductInfo().then(productInfo => {
      storeProductInfo(productInfo);
    });
  }
})();
