// 메시지 타입 상수
const MESSAGE_TYPES = {
  SELECTED_TEXT: 'SELECTED_TEXT',
  UPDATE_PRODUCT_INFO: 'UPDATE_PRODUCT_INFO',
  GET_PRODUCT_BY_NAME: 'GET_PRODUCT_BY_NAME',
  CHECK_TAB_ACTIVE: 'CHECK_TAB_ACTIVE',
  CHAT_DATA: 'CHAT_DATA'
};

// 확장 프로그램 아이콘 클릭 시 사이드탭 열기
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// 상품 정보 저장소
let productStore = new Map();

// 통합된 메시지 리스너
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('Background received message:', msg);

  try {
    switch (msg.type) {
      case MESSAGE_TYPES.SELECTED_TEXT:
        chrome.runtime.sendMessage(msg);
        break;

      case MESSAGE_TYPES.UPDATE_PRODUCT_INFO:
        const productInfo = msg.productInfo;
        console.log('Storing product info:', productInfo);
        if (productInfo && productInfo.productId) {
          productStore.set(productInfo.productId, productInfo);
          console.log('Current product store:', Array.from(productStore.entries()));
        }
        break;

      case MESSAGE_TYPES.GET_PRODUCT_BY_NAME:
        const productName = msg.productName;
        console.log('Searching for product:', productName);
        let matchedProduct = null;
        
        for (const [_, product] of productStore) {
          if (product.productName === productName) {
            matchedProduct = product;
            break;
          }
        }
        
        console.log('Found product:', matchedProduct);
        sendResponse({ product: matchedProduct });
        break;

      case MESSAGE_TYPES.CHECK_TAB_ACTIVE:
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          sendResponse({ isActive: tabs[0]?.id === sender.tab?.id });
        });
        break;

      case MESSAGE_TYPES.CHAT_DATA:
        console.log('Received chat data:', msg.chatData);
        // 사이드패널로 채팅 데이터 전송
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.CHAT_DATA,
          chatData: msg.chatData,
          timestamp: Date.now()
        });
        break;
    }
  } catch (error) {
    console.error('Error in message handler:', error);
  }
  
  return true; // 비동기 응답을 위해 true 반환
}); 