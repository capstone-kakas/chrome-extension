// 상수 정의
const MESSAGE_TYPES = {
  SELECTED_TEXT: 'SELECTED_TEXT',
  UPDATE_PRODUCT_INFO: 'UPDATE_PRODUCT_INFO',
  GET_PRODUCT_INFO: 'GET_PRODUCT_INFO',
  CHECK_TAB_ACTIVE: 'CHECK_TAB_ACTIVE',
  CHAT_DATA_UPDATED: 'CHAT_DATA_UPDATED'
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

const API_ENDPOINTS = {
  CHATROOM: 'https://13.125.148.205:443/api/chatroom'
};

const SELECTORS = {
  PRODUCT: {
    TITLE: '.ProductSummarystyle__Name-sc-oxz0oy-3.dZBHcg',
    PRICE: '.ProductSummarystyle__Price-sc-oxz0oy-5.cspsrp',
    DESCRIPTION: '.ProductInfostyle__DescriptionContent-sc-ql55c8-3.eJCiaL p',
    SELLER: 'a.ProductSellerstyle__Name-sc-1qnzvgu-7.cCIWgL',
    VALUES: '.ProductSummarystyle__Value-sc-oxz0oy-21.eLyjky',
    CATEGORIES: '.ProductInfostyle__Category-sc-ql55c8-8.EVvbD a'
  },
  CHAT: {
    MESSAGE_CLASSES: ['hBurlc', 'eJlLdf', 'fkdpNC'],
    CHAT_BLOCKS: 'div.sc-aNeao',
    MESSAGE: '.sc-jBeBSR .sc-feUZmu p',
    TIME: '.sc-ezreuY',
    INFO: '.sc-eONNys',
    PRODUCT: '.sc-bStcSt'
  }
};

// 유틸리티 클래스
class Utils {
  static async waitForElement(selector, timeout = 10000) {
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

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found`));
      }, timeout);
    });
  }

  static sendMessageWithRetry(message, maxRetries = 3) {
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
}

// API 서비스 클래스
class ApiService {
  static async sendChatroomRequest(productInfo) {
    try {
      const response = await fetch(API_ENDPOINTS.CHATROOM, {
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
}

// 스토리지 서비스 클래스
class StorageService {
  static async getProductStore() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['productStore', 'lastStoredProductId'], resolve);
    });
  }

  static async setProductStore(productStore, lastStoredProductId) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ 
        productStore,
        lastStoredProductId
      }, resolve);
    });
  }
}

// 채팅 데이터 수집 클래스
class ChatDataCollector {
  static collectChatData() {
    console.log('🔄 채팅 데이터 수집 시작');
    
    const chatBlocks = Array.from(document.querySelectorAll(SELECTORS.CHAT.CHAT_BLOCKS));
    console.log(`📝 발견된 채팅 블록 수: ${chatBlocks.length}`);
    
    const messages = [];
    const productInfo = [];
    let lastTime = null;

    chatBlocks.forEach((chatBlock, index) => {
      const messageElem = chatBlock.querySelector(SELECTORS.CHAT.MESSAGE);
      const msgBox = chatBlock.querySelector('.sc-jBeBSR');
      const span = chatBlock.querySelector('.sc-feUZmu');
      const classList = [
        ...(msgBox?.classList || []),
        ...(span?.classList || [])
      ];
      const timeElem = chatBlock.querySelector(SELECTORS.CHAT.TIME);
      const time = timeElem ? timeElem.innerText.trim() : null;

      // 1. 일반 채팅 메시지
      if (messageElem) {
        const isBuyer = classList.some(cls => SELECTORS.CHAT.MESSAGE_CLASSES.includes(cls));
        const appliedTime = time || lastTime;
        if (time) lastTime = time;
        const message = {
          text: messageElem.innerText.trim(),
          sender: isBuyer ? 'buyer' : 'seller',
          time: appliedTime
        };
        messages.push(message);
        console.log(`💬 메시지 ${index + 1}:`, message);
        return;
      }

      // 2. 상품 안내 블록
      const infoElem = chatBlock.querySelector(SELECTORS.CHAT.INFO);
      const productElem = chatBlock.querySelector(SELECTORS.CHAT.PRODUCT);
      if (infoElem || productElem) {
        const info = {
          info: infoElem ? infoElem.innerText.trim() : null,
          product: productElem ? productElem.innerText.trim() : null
        };
        productInfo.push(info);
        console.log(`🛍️ 상품 정보 ${index + 1}:`, info);
        return;
      }
    });

    return { messages, productInfo };
  }

  static watchChatChanges() {
    console.log('👀 채팅 변경 감지 시작');
    let lastMessages = [];
    let lastProductInfo = [];

    const checkChanges = () => {
      const { messages, productInfo } = this.collectChatData();
      
      const messagesChanged = JSON.stringify(messages) !== JSON.stringify(lastMessages);
      const productInfoChanged = JSON.stringify(productInfo) !== JSON.stringify(lastProductInfo);
      
      if (messagesChanged || productInfoChanged) {
        console.log('🔄 변경 감지됨:', {
          messagesChanged,
          productInfoChanged,
          newMessageCount: messages.length,
          newProductInfoCount: productInfo.length
        });
        
        lastMessages = messages;
        lastProductInfo = productInfo;
        
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.CHAT_DATA_UPDATED,
          data: { messages, productInfo }
        });
      }
    };

    const observer = new MutationObserver(checkChanges);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setInterval(checkChanges, 2000);
  }
}

// 상품 정보 관리 클래스
class ProductManager {
  static async getProductInfo() {
    console.log('Getting product info from product page');
    
    try {
      const pathParts = window.location.pathname.split('/');
      const productId = pathParts[2] || null;

      await Promise.all([
        Utils.waitForElement(SELECTORS.PRODUCT.TITLE),
        Utils.waitForElement(SELECTORS.PRODUCT.PRICE),
        Utils.waitForElement(SELECTORS.PRODUCT.DESCRIPTION),
        Utils.waitForElement(SELECTORS.PRODUCT.SELLER)
      ]);

      const titleEl = document.querySelector(SELECTORS.PRODUCT.TITLE);
      const priceEl = document.querySelector(SELECTORS.PRODUCT.PRICE);
      const valueEls = document.querySelectorAll(SELECTORS.PRODUCT.VALUES);
      const descEl = document.querySelector(SELECTORS.PRODUCT.DESCRIPTION);
      const categoryEls = document.querySelectorAll(SELECTORS.PRODUCT.CATEGORIES);
      const sellerLink = document.querySelector(SELECTORS.PRODUCT.SELLER);

      const categories = Array.from(categoryEls).map(a => a.textContent.trim());
      const categoryId = CATEGORY_MAPPING[categories[2]] || 0;

      const sellerHref = sellerLink?.getAttribute('href');
      const sellerId = sellerHref ? sellerHref.split('/')[2] : null;

      return {
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
    } catch (error) {
      console.error('Error getting product info:', error);
      return null;
    }
  }

  static async storeProductInfo(productInfo) {
    console.log('Attempting to store product info');
    
    if (!productInfo?.productId || !productInfo?.productName || !productInfo?.price) {
      console.log('Waiting for product info to be fully loaded...');
      const updatedInfo = await this.getProductInfo();
      return this.storeProductInfo(updatedInfo);
    }
    
    const { productStore = {}, lastStoredProductId } = await StorageService.getProductStore();
    
    if (lastStoredProductId === productInfo.productId) {
      const existingProduct = productStore[productInfo.productId];
      if (existingProduct && 
          existingProduct.productName === productInfo.productName &&
          existingProduct.price === productInfo.price) {
        console.log('Product info already stored and unchanged, skipping...');
        return;
      }
    }
    
    const updatedProductStore = {
      ...productStore,
      [productInfo.productId]: productInfo
    };
    
    await StorageService.setProductStore(updatedProductStore, productInfo.productId);
    console.log('Product info stored:', productInfo);
    
    try {
      await ApiService.sendChatroomRequest(productInfo);
    } catch (error) {
      console.error('Failed to send chatroom request:', error);
    }
  }
}

// URL 감시 클래스
class UrlWatcher {
  constructor(callback) {
    this.lastUrl = window.location.href;
    this.isProcessing = false;
    this.callback = callback;
    this.observer = null;
  }

  start() {
    this.observer = new MutationObserver(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== this.lastUrl && !this.isProcessing) {
        this.isProcessing = true;
        this.lastUrl = currentUrl;
        this.callback(currentUrl);
        setTimeout(() => {
          this.isProcessing = false;
        }, 1000);
      }
    });

    if (document.body) {
      this.observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (document.body) {
          this.observer.observe(document.body, { childList: true, subtree: true });
        }
      });
    }

    window.addEventListener('popstate', () => {
      const currentUrl = window.location.href;
      if (currentUrl !== this.lastUrl && !this.isProcessing) {
        this.isProcessing = true;
        this.lastUrl = currentUrl;
        this.callback(currentUrl);
        setTimeout(() => {
          this.isProcessing = false;
        }, 1000);
      }
    });
  }

  stop() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// iframe 관리 클래스
class IframeManager {
  static watchIframeSrc() {
    console.log('👀 iframe src 변경 감지 시작');
    let iframeFound = false;
    let iframeLoadAttempted = false;
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
          const iframe = mutation.target;
          console.log('🔄 iframe src 변경 감지:', iframe.src);
          
          if (!iframeLoadAttempted) {
            iframeLoadAttempted = true;
            iframe.addEventListener('load', () => {
              console.log('✅ iframe 로드 완료');
              this.injectContentScript(iframe);
            });
          }
        }
      });
    });

    const waitForIframe = setInterval(() => {
      const iframe = document.querySelector('iframe.sc-TFwJa');
      if (iframe) {
        console.log('✅ iframe 발견:', iframe.src);
        iframeFound = true;
        clearInterval(waitForIframe);
        
        observer.observe(iframe, {
          attributes: true,
          attributeFilter: ['src']
        });
        
        if (iframe.contentWindow && !iframeLoadAttempted) {
          iframeLoadAttempted = true;
          iframe.addEventListener('load', () => {
            console.log('✅ 초기 iframe 로드 완료');
            this.injectContentScript(iframe);
          });
        }
      }
    }, 1000);

    setTimeout(() => {
      if (!iframeFound) {
        clearInterval(waitForIframe);
        console.log('⚠️ iframe을 찾지 못했습니다. 30초 타임아웃');
      }
    }, 30000);
  }

  static injectContentScript(iframe) {
    console.log('💉 content script 주입 시도');
    
    try {
      const injectScript = () => {
        const script = document.createElement('script');
        script.textContent = `
          // 채팅 데이터 수집 함수
          function collectChatData() {
            const chatBlocks = Array.from(document.querySelectorAll('div.sc-aNeao'));
            const messages = [];
            const productInfo = [];
            let lastTime = null;

            chatBlocks.forEach((chatBlock) => {
              const messageElem = chatBlock.querySelector('.sc-jBeBSR .sc-feUZmu p');
              const msgBox = chatBlock.querySelector('.sc-jBeBSR');
              const span = chatBlock.querySelector('.sc-feUZmu');
              const classList = [
                ...(msgBox?.classList || []),
                ...(span?.classList || [])
              ];
              const timeElem = chatBlock.querySelector('.sc-ezreuY');
              const time = timeElem ? timeElem.innerText.trim() : null;

              if (messageElem) {
                const isBuyer = classList.some(cls => ['hBurlc', 'eJlLdf', 'fkdpNC'].includes(cls));
                const appliedTime = time || lastTime;
                if (time) lastTime = time;
                messages.push({
                  text: messageElem.innerText.trim(),
                  sender: isBuyer ? 'buyer' : 'seller',
                  time: appliedTime
                });
                return;
              }

              const infoElem = chatBlock.querySelector('.sc-eONNys');
              const productElem = chatBlock.querySelector('.sc-bStcSt');
              if (infoElem || productElem) {
                productInfo.push({
                  info: infoElem ? infoElem.innerText.trim() : null,
                  product: productElem ? productElem.innerText.trim() : null
                });
              }
            });

            return { messages, productInfo };
          }

          // 채팅 변경 감지
          function watchChatChanges() {
            let lastMessages = [];
            let lastProductInfo = [];

            const checkChanges = () => {
              const { messages, productInfo } = collectChatData();
              
              const messagesChanged = JSON.stringify(messages) !== JSON.stringify(lastMessages);
              const productInfoChanged = JSON.stringify(productInfo) !== JSON.stringify(lastProductInfo);
              
              if (messagesChanged || productInfoChanged) {
                lastMessages = messages;
                lastProductInfo = productInfo;
                
                window.parent.postMessage({
                  type: 'CHAT_DATA_UPDATED',
                  data: { messages, productInfo }
                }, '*');
              }
            };

            const observer = new MutationObserver(checkChanges);
            observer.observe(document.body, {
              childList: true,
              subtree: true
            });

            setInterval(checkChanges, 2000);
          }

          // 초기화
          watchChatChanges();
        `;
        iframe.contentDocument.head.appendChild(script);
        console.log('✅ content script 주입 성공');
      };

      if (iframe.contentDocument?.readyState === 'complete') {
        injectScript();
      } else {
        console.log('⏳ iframe 로딩 대기 중...');
        iframe.addEventListener('load', injectScript);
      }
    } catch (error) {
      console.error('❌ content script 주입 실패:', error);
    }
  }
}

// 메인 애플리케이션 클래스
class BunjangExtension {
  constructor() {
    this.url = window.location.href;
    this.isTalkPage = URL_PATTERNS.TALK_PAGE.test(this.url) || URL_PATTERNS.TALK_PAGE_ALT.test(this.url);
    this.isProductPage = URL_PATTERNS.PRODUCT_PAGE.test(this.url);
  }

  async init() {
    console.log('Current URL:', this.url);
    console.log('Page type detection:', {
      isTalkPage: this.isTalkPage,
      isProductPage: this.isProductPage,
      url: this.url,
      matchedTalkPattern: URL_PATTERNS.TALK_PAGE.test(this.url),
      matchedTalkPattern2: URL_PATTERNS.TALK_PAGE_ALT.test(this.url),
      matchedProductPattern: URL_PATTERNS.PRODUCT_PAGE.test(this.url)
    });

    this.setupMessageListener();
    this.setupUrlWatcher();

    if (!this.isTalkPage && !this.isProductPage) {
      console.log('Not a target page, exiting...');
      return;
    }

    if (this.isTalkPage) {
      console.log('Talk page loaded, attempting to find product name');
      await this.handleTalkPage();
      IframeManager.watchIframeSrc();
    } else if (this.isProductPage) {
      console.log('Product page loaded, starting to store product info');
      await this.handleProductPage();
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === MESSAGE_TYPES.GET_PRODUCT_INFO) {
        this.handleGetProductInfo(sendResponse);
        return true;
      } else if (message.type === MESSAGE_TYPES.CHAT_DATA_UPDATED) {
        this.handleChatDataUpdated(message.data);
      }
      
      return true;
    });

    window.addEventListener('message', (event) => {
      const allowedOrigins = ['https://talk.bunjang.co.kr', 'https://m.bunjang.co.kr'];
      if (!allowedOrigins.some(origin => event.origin.includes(origin))) {
        return;
      }

      const { type, data } = event.data;
      
      if (type === 'CHAT_DATA_UPDATED') {
        console.log('📥 채팅 데이터 수신:', {
          messageCount: data.messages.length,
          productInfoCount: data.productInfo.length
        });
        
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.CHAT_DATA_UPDATED,
          data
        });
      }
    });
  }

  setupUrlWatcher() {
    const urlWatcher = new UrlWatcher(async (newUrl) => {
      const isNowTalkPage = URL_PATTERNS.TALK_PAGE.test(newUrl);
      const isNowProductPage = URL_PATTERNS.PRODUCT_PAGE.test(newUrl);

      if (isNowTalkPage) {
        console.log('Switched to Talk Page, skipping product info store.');
      } else if (isNowProductPage) {
        console.log('Switched to Product Page, triggering product info store.');
        const productInfo = await ProductManager.getProductInfo();
        await ProductManager.storeProductInfo(productInfo);
      }
    });

    urlWatcher.start();
  }

  async handleGetProductInfo(sendResponse) {
    if (this.isTalkPage) {
      console.log('💬 채팅 페이지에서 상품 정보 요청');
      await this.handleTalkPage();
      sendResponse({ success: true });
    } else if (this.isProductPage) {
      console.log('🛍️ 상품 페이지에서 상품 정보 요청');
      try {
        const productInfo = await ProductManager.getProductInfo();
        console.log('📤 상품 정보 전송:', productInfo);
        sendResponse({ productInfo });
      } catch (error) {
        console.error('❌ 상품 정보 조회 실패:', error);
        sendResponse({ error: error.message });
      }
    }
  }

  async handleChatDataUpdated(data) {
    console.log('📥 채팅 데이터 업데이트 수신:', {
      messageCount: data.messages.length,
      productInfoCount: data.productInfo.length
    });
    
    try {
      await Utils.sendMessageWithRetry({
        type: MESSAGE_TYPES.UPDATE_PRODUCT_INFO,
        chatData: data
      });
      console.log('✅ Sidepanel로 데이터 전송 성공');
    } catch (error) {
      console.error('❌ Sidepanel로 데이터 전송 실패:', error);
    }
  }

  async handleTalkPage() {
    const sellerId = window.location.pathname.split('/').pop();
    if (!sellerId) return;

    const { productStore = {} } = await StorageService.getProductStore();
    const matchedProduct = Object.values(productStore).find(product => 
      product.sellerId === sellerId
    );
    
    if (matchedProduct) {
      try {
        const response = await ApiService.sendChatroomRequest(matchedProduct);
        if (response.isSuccess) {
          const suggestedNames = response.result.suggestedProductNames || [];
          console.log('💡 추천 상품명:', suggestedNames);
        }
      } catch (error) {
        console.error('Failed to send chatroom request:', error);
      }
      
      await Utils.sendMessageWithRetry({
        type: MESSAGE_TYPES.UPDATE_PRODUCT_INFO,
        productInfo: matchedProduct
      });
    }
  }

  async handleProductPage() {
    const productInfo = await ProductManager.getProductInfo();
    await ProductManager.storeProductInfo(productInfo);
  }
}

// 애플리케이션 초기화
const app = new BunjangExtension();
app.init();
