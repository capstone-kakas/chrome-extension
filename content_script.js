// 상수 정의
const MESSAGE_TYPES = {
  SELECTED_TEXT: 'SELECTED_TEXT',
  UPDATE_PRODUCT_INFO: 'UPDATE_PRODUCT_INFO',
  GET_PRODUCT_INFO: 'GET_PRODUCT_INFO',
  CHECK_TAB_ACTIVE: 'CHECK_TAB_ACTIVE',
  CHAT_DATA: 'CHAT_DATA'  // 추가
};

const URL_PATTERNS = {
  TALK_PAGE: /^https:\/\/m\.bunjang\.co\.kr\/talk2\/user\/\d+/,
  TALK_PAGE_ALT: /^https:\/\/talk\.bunjang\.co\.kr/,  // 더 유연하게 수정
  PRODUCT_PAGE: /^https:\/\/m\.bunjang\.co\.kr\/products\/\d+/
};

const CATEGORY_MAPPING = {
  '닌텐도/NDS/Wii': 1,
  '소니/플레이스테이션': 2,
  'XBOX': 3,
  'PC게임': 4,
  '기타 게임/타이틀': 5
};

// 디버그 모드 설정 (개발 시에만 true로 설정)
const DEBUG_MODE = false;

function log(...args) {
  if (DEBUG_MODE) {
    console.log(...args);
  }
}

function logError(...args) {
  console.error(...args); // 에러는 항상 출력
}

function logWarn(...args) {
  if (DEBUG_MODE) {
    console.warn(...args);
  }
}

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

function getChatData() {
  // 캐시된 결과를 저장 (중복 호출 방지)
  if (getChatData._lastCall && Date.now() - getChatData._lastCall < 500) {
    return getChatData._lastResult || { messages: [], productInfo: [] };
  }
  
  // iframe 내부의 채팅 데이터를 가져오는 함수
  function extractChatFromIframe(doc = document) {
    const myMessageClassNames = ['hBurlc', 'eJlLdf', 'fkdpNC'];
    const chatBlocks = Array.from(doc.querySelectorAll('div.sc-aNeao'));
    const messages = [];
    const productInfo = [];
    let lastTime = null;

    // 채팅 블록이 없으면 빈 결과 반환
    if (chatBlocks.length === 0) {
      return { messages: [], productInfo: [] };
    }

    chatBlocks.forEach(chatBlock => {
      try {
        const messageElem = chatBlock.querySelector('.sc-jBeBSR .sc-feUZmu p');
        const msgBox = chatBlock.querySelector('.sc-jBeBSR');
        const span = chatBlock.querySelector('.sc-feUZmu');
        const classList = [
          ...(msgBox?.classList || []),
          ...(span?.classList || [])
        ];
        const timeElem = chatBlock.querySelector('.sc-ezreuY');
        const time = timeElem ? timeElem.innerText.trim() : null;

        // 1. 일반 채팅 메시지
        if (messageElem) {
          const isMine = classList.some(cls => myMessageClassNames.includes(cls));
          // 시간 보정: time이 없으면 마지막 시간(lastTime) 사용
          const appliedTime = time || lastTime;
          if (time) lastTime = time; // 새로운 시간 등장 시 갱신
          messages.push({
            text: messageElem.innerText.trim(),
            sender: isMine ? 'me' : 'other',
            time: appliedTime
          });
          return;
        }

        // 2. 상품 안내 블록
        const infoElem = chatBlock.querySelector('.sc-eONNys');
        const productElem = chatBlock.querySelector('.sc-bStcSt');
        if (infoElem || productElem) {
          productInfo.push({
            info: infoElem ? infoElem.innerText.trim() : null,
            product: productElem ? productElem.innerText.trim() : null
          });
          return;
        }
      } catch (error) {
        console.warn('Error processing chat block:', error);
      }
    });

    return { messages, productInfo };
  }

  try {
    let result = { messages: [], productInfo: [] };
    
    // 현재 페이지가 iframe 내부인지 확인
    if (window !== window.top) {
      // iframe 내부에서 실행되는 경우
      log('Running inside iframe, extracting chat data directly');
      result = extractChatFromIframe();
    } else {
      // 부모 페이지에서 실행되는 경우
      log('Running in parent page, looking for chat data');
      
      // 먼저 현재 페이지에서 직접 시도
      result = extractChatFromIframe();
      
      // 데이터가 없으면 iframe 탐색
      if (result.messages.length === 0 && result.productInfo.length === 0) {
        const iframes = document.querySelectorAll('iframe');
        log(`Found ${iframes.length} iframes`);
        
        for (let i = 0; i < iframes.length && result.messages.length === 0; i++) {
          const iframe = iframes[i];
          
          try {
            // 같은 도메인의 iframe인 경우 직접 접근 가능
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            
            if (iframeDoc) {
              const chatBlocks = iframeDoc.querySelectorAll('div.sc-aNeao');
              if (chatBlocks.length > 0) {
                log(`Found chat blocks in iframe ${i}, extracting data`);
                result = extractChatFromIframe(iframeDoc);
                break; // 데이터를 찾으면 중단
              }
            }
          } catch (error) {
            logWarn(`Cannot access iframe ${i}: ${error.message}`);
            // 크로스 오리진 iframe의 경우 postMessage 사용
            if (error.name === 'SecurityError') {
              try {
                iframe.contentWindow.postMessage({
                  type: 'GET_CHAT_DATA',
                  source: 'content_script'
                }, '*');
              } catch (postError) {
                logWarn(`Failed to send postMessage to iframe ${i}:`, postError.message);
              }
            }
          }
        }
      }
    }

    // 결과 캐싱
    getChatData._lastCall = Date.now();
    getChatData._lastResult = result;
    
    log('Chat data extracted:', result);
    return result;
    
  } catch (error) {
    logError('Error in getChatData:', error);
    return { messages: [], productInfo: [] };
  }
}

// postMessage 리스너 추가 (iframe과의 통신용)
window.addEventListener('message', function(event) {
  if (event.data.type === 'GET_CHAT_DATA' && event.data.source === 'content_script') {
    console.log('Received chat data request from parent');
    const chatData = getChatData();
    event.source.postMessage({
      type: 'CHAT_DATA_RESPONSE',
      data: chatData,
      source: 'iframe'
    }, '*');
  } else if (event.data.type === 'CHAT_DATA_RESPONSE' && event.data.source === 'iframe') {
    console.log('Received chat data from iframe:', event.data.data);
    // 사이드패널로 데이터 전송
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.CHAT_DATA,
      chatData: event.data.data
    });
  }
});

// 채팅 데이터 모니터링 함수
function startChatDataMonitoring() {
  log('Starting chat data monitoring...');
  
  let isMonitoring = false;
  let lastChatDataHash = null;
  
  // 채팅 데이터 해시 생성 (중복 전송 방지용)
  function generateChatDataHash(chatData) {
    if (!chatData || (!chatData.messages.length && !chatData.productInfo.length)) return null;
    return JSON.stringify({
      messageCount: chatData.messages.length,
      lastMessage: chatData.messages[chatData.messages.length - 1]?.text || '',
      productCount: chatData.productInfo.length
    });
  }
  
  // 채팅 데이터 확인 및 전송 함수 (디바운싱 적용)
  let debounceTimeout = null;
  function checkAndSendChatData() {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    
    debounceTimeout = setTimeout(() => {
      if (isMonitoring) return; // 이미 처리 중이면 스킵
      
      isMonitoring = true;
      try {
        const chatData = getChatData();
        const currentHash = generateChatDataHash(chatData);
        
        // 데이터가 변경되었을 때만 전송
        if (currentHash && currentHash !== lastChatDataHash) {
          log('New chat data detected, sending to sidepanel');
          lastChatDataHash = currentHash;
          chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.CHAT_DATA,
            chatData: chatData
          });
        }
      } catch (error) {
        logError('Error checking chat data:', error);
      } finally {
        isMonitoring = false;
      }
    }, 1000); // 1초 디바운싱
  }
  
  // DOM 변경 감지로 실시간 업데이트 (범위를 더 구체적으로 제한)
  const observer = new MutationObserver((mutations) => {
    let shouldUpdate = false;
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        // 채팅 관련 클래스가 포함된 노드가 추가되었는지 확인
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 더 구체적인 선택자로 제한
            if (node.matches && (
                node.matches('div.sc-aNeao') || 
                node.matches('.sc-jBeBSR') ||
                node.matches('.sc-feUZmu') ||
                node.querySelector && (
                  node.querySelector('div.sc-aNeao') ||
                  node.querySelector('.sc-jBeBSR')
                )
              )) {
              shouldUpdate = true;
              break;
            }
          }
        }
        if (shouldUpdate) break;
      }
    }
    
    if (shouldUpdate) {
      log('Chat DOM updated, refreshing data');
      checkAndSendChatData();
    }
  });
  
  // 더 구체적인 관찰 대상 설정
  function startObserving() {
    const chatContainer = document.querySelector('[class*="chat"]') || 
                         document.querySelector('[id*="chat"]') || 
                         document.body;
    
    if (chatContainer) {
      observer.observe(chatContainer, {
        childList: true,
        subtree: true,
        // 속성 변경은 관찰하지 않음 (성능 향상)
        attributes: false,
        characterData: false
      });
      log('Started observing chat container for changes');
    }
  }
  
  // iframe 내부 관찰 (더 안전하게)
  function observeIframes() {
    const iframes = document.querySelectorAll('iframe');
    let observedIframes = 0;
    
    iframes.forEach((iframe, index) => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc && iframeDoc.body) {
          // iframe 내부에 채팅 관련 요소가 있는지 확인
          const chatElements = iframeDoc.querySelectorAll('div.sc-aNeao, .sc-jBeBSR');
          if (chatElements.length > 0) {
            observer.observe(iframeDoc.body, {
              childList: true,
              subtree: true,
              attributes: false,
              characterData: false
            });
            observedIframes++;
            log(`Observing iframe ${index} for changes`);
          }
        }
      } catch (error) {
        logWarn(`Cannot observe iframe ${index}:`, error.message);
      }
    });
    
    log(`Observing ${observedIframes} iframes`);
  }
  
  // 초기 관찰 시작
  startObserving();
  observeIframes();
  
  // 초기 데이터 확인 (한 번만)
  setTimeout(() => {
    checkAndSendChatData();
  }, 2000);
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
    url
  });

  // 타겟 페이지가 아니면 조기 종료
  if (!isTalkPage && !isProductPage) {
    console.log('Not a target page, exiting...');
    return;
  }

  // 메시지 리스너 (한 번만 등록)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);
    
    try {
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
      
      // 채팅 데이터 요청 처리
      if (message.type === MESSAGE_TYPES.CHAT_DATA) {
        if (isTalkPage) {
          console.log('Chat data requested from sidepanel');
          const chatData = getChatData();
          console.log('Sending chat data to sidepanel:', chatData);
          sendResponse({ chatData });
        } else {
          sendResponse({ error: 'Not on talk page' });
        }
      }
      
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error in message listener:', error);
      sendResponse({ error: error.message });
    }
    
    return true;
  });

  // URL 변경 감지 설정 (필요한 경우에만)
  if (isTalkPage || isProductPage) {
    watchUrlChanges((newUrl) => {
      const isNowTalkPage = URL_PATTERNS.TALK_PAGE.test(newUrl) || URL_PATTERNS.TALK_PAGE_ALT.test(newUrl);
      const isNowProductPage = URL_PATTERNS.PRODUCT_PAGE.test(newUrl);

      if (isNowTalkPage && !isTalkPage) {
        console.log('Switched to Talk Page');
        // 페이지 새로고침이 필요할 수 있음
        window.location.reload();
      } else if (isNowProductPage && !isProductPage) {
        console.log('Switched to Product Page, triggering product info store.');
        getProductInfo().then(productInfo => {
          storeProductInfo(productInfo);
        }).catch(error => {
          console.error('Error storing product info:', error);
        });
      }
    });
  }

  // 페이지 타입별 초기화
  if (isTalkPage) {
    console.log('Talk page loaded, initializing...');
    try {
      extractProductId();
      // 채팅 데이터 모니터링 시작 (지연 실행으로 페이지 로드 부담 줄이기)
      setTimeout(() => {
        console.log('Starting chat data monitoring for talk page');
        startChatDataMonitoring();
      }, 3000); // 3초 후 시작
    } catch (error) {
      console.error('Error initializing talk page:', error);
    }
  } else if (isProductPage) {
    console.log('Product page loaded, storing product info...');
    try {
      getProductInfo().then(productInfo => {
        storeProductInfo(productInfo);
      }).catch(error => {
        console.error('Error storing product info:', error);
      });
    } catch (error) {
      console.error('Error initializing product page:', error);
    }
  }
})();


