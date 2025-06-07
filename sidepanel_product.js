// 상품 정보를 업데이트하는 함수
function updateProductInfo(productInfo) {
    // 기본 정보 업데이트
    document.getElementById('product-name').textContent = productInfo.productName || '-';
    document.getElementById('product-price').textContent = productInfo.price || '-';
    document.getElementById('product-status').textContent = productInfo.status || '-';
    document.getElementById('deliveryFee').textContent = productInfo.deliveryFee || '-';
    
    // 판매자 정보 업데이트
    document.getElementById('seller-name').textContent = productInfo.sellerName || '-';
    
    // 상품 설명 업데이트
    document.getElementById('description').textContent = productInfo.description || '-';
    
    // 카테고리 업데이트
    const categoriesContainer = document.getElementById('categories');
    if (productInfo.categories && productInfo.categories.length > 0) {
        categoriesContainer.innerHTML = productInfo.categories
            .map(category => `<span class="category-tag">${category}</span>`)
            .join('');
    } else {
        categoriesContainer.textContent = '-';
    }
}

// content script로부터 메시지 수신
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_PRODUCT_INFO') {
        updateProductInfo(message.productInfo);
    }
});

// 초기 로드 시 content script에 상품 정보 요청
document.addEventListener('DOMContentLoaded', () => {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {type: 'GET_PRODUCT_INFO'});
    });
}); 