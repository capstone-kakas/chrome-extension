// 상품 정보를 업데이트하는 함수
function updateProductInfo(productInfo) {
    console.log('사이드 패널: 상품 정보 업데이트 시작', productInfo);
    
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

    // 추천 상품명 요청
    if (productInfo.productName && productInfo.price) {
        requestSuggestedNames(productInfo);
    }
    
    console.log('사이드 패널: 상품 정보 업데이트 완료');
}

// 추천 상품명을 요청하는 함수
async function requestSuggestedNames(productInfo) {
    const loadingEl = document.querySelector('.loading');
    const suggestedListEl = document.querySelector('.suggested-list');
    
    try {
        loadingEl.style.display = 'block';
        suggestedListEl.innerHTML = '';
        
        // storage에서 상품 정보 가져오기
        const result = await new Promise(resolve => {
            chrome.storage.local.get(['productStore'], resolve);
        });
        
        const productStore = result.productStore || {};
        const storedProductInfo = productStore[productInfo.productId];
        
        if (!storedProductInfo) {
            throw new Error('저장된 상품 정보를 찾을 수 없습니다.');
        }
        
        const response = await fetch('https://13.125.148.205:443/api/chatroom', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                memberId: 1,
                chatRoomTitle: storedProductInfo.productName,
                content: storedProductInfo.description || '',
                category: storedProductInfo.categoryId || 0,
                deliveryFee: storedProductInfo.deliveryFee || '0',
                seller: Number(storedProductInfo.sellerId) || 0,
                price: storedProductInfo.price || '0',
                status: storedProductInfo.status || '판매중'
            })
        });
        
        const data = await response.json();
        console.log('추천 상품명 응답:', data);
        
        if (data.isSuccess && data.result.suggestedProductNames) {
            // chatRoomId와 관련 정보를 storage에 저장
            storedProductInfo.chatRoomId = data.result.chatRoomId;
            storedProductInfo.originalProductName = storedProductInfo.productName; // 원래 상품명 저장
            storedProductInfo.suggestedProductNames = data.result.suggestedProductNames; // 추천 상품명 목록 저장
            storedProductInfo.lastUpdated = new Date().toISOString(); // 마지막 업데이트 시간 저장
            
            productStore[productInfo.productId] = storedProductInfo;
            await new Promise(resolve => {
                chrome.storage.local.set({ productStore }, resolve);
            });
            
            console.log('저장된 상품 정보:', storedProductInfo);
            displaySuggestedNames(data.result.suggestedProductNames, productInfo.productId);
        } else {
            throw new Error('추천 상품명을 가져오는데 실패했습니다.');
        }
    } catch (error) {
        console.error('추천 상품명 요청 에러:', error);
        suggestedListEl.innerHTML = '<div class="error">추천 상품명을 불러오는데 실패했습니다.</div>';
    } finally {
        loadingEl.style.display = 'none';
    }
}

// 추천 상품명을 표시하는 함수
function displaySuggestedNames(suggestedNames, productId) {
    const suggestedListEl = document.querySelector('.suggested-list');
    suggestedListEl.innerHTML = '';
    
    suggestedNames.forEach(name => {
        const nameEl = document.createElement('div');
        nameEl.className = 'suggested-name-item';
        nameEl.textContent = name;
        nameEl.onclick = () => selectSuggestedName(name, productId);
        suggestedListEl.appendChild(nameEl);
    });
}

// 추천 상품명을 선택하는 함수
async function selectSuggestedName(selectedName, productId) {
    try {
        // 모든 추천 상품명 항목에서 selected 클래스 제거
        document.querySelectorAll('.suggested-name-item').forEach(el => {
            el.classList.remove('selected');
        });
        
        // 선택된 항목에 selected 클래스 추가
        event.target.classList.add('selected');
        
        // storage에서 현재 상품 정보 가져오기
        const result = await new Promise(resolve => {
            chrome.storage.local.get(['productStore'], resolve);
        });
        
        const productStore = result.productStore || {};
        const productInfo = productStore[productId];
        
        if (productInfo) {
            // 선택된 상품명 추가
            productInfo.actualProductName = selectedName;
            
            // storage 업데이트
            await new Promise(resolve => {
                chrome.storage.local.set({ productStore }, resolve);
            });
            
            // API 호출하여 선택된 상품명 전송
            const response = await fetch('https://13.125.148.205:443/api/chatroom', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chatRoomId: productInfo.chatRoomId,
                    productName: selectedName
                })
            });
            
            const data = await response.json();
            console.log('선택된 상품명 API 응답:', data);
            
            if (!data.isSuccess) {
                throw new Error(data.message || '상품명 선택 처리에 실패했습니다.');
            }
            
            console.log('선택된 상품명 저장 완료:', selectedName);
        }
    } catch (error) {
        console.error('상품명 선택 처리 중 에러:', error);
        // 에러 메시지 표시
        const errorEl = document.createElement('div');
        errorEl.className = 'error';
        errorEl.textContent = '상품명 선택 처리에 실패했습니다.';
        document.querySelector('.suggested-list').appendChild(errorEl);
    }
}

// content script로부터 메시지 수신
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('사이드 패널: 메시지 수신', message);
    
    if (message.type === 'UPDATE_PRODUCT_INFO') {
        updateProductInfo(message.productInfo);
        sendResponse({ success: true });
    }
    return true; // 비동기 응답을 위해 true 반환
});

// content script에 메시지를 보내고 응답을 기다리는 함수
function sendMessageToContentScript(message) {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (chrome.runtime.lastError) {
                console.error('탭 쿼리 에러:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
                return;
            }
            
            if (!tabs[0]) {
                console.error('활성 탭을 찾을 수 없음');
                reject(new Error('활성 탭을 찾을 수 없음'));
                return;
            }
            
            chrome.tabs.sendMessage(tabs[0].id, message, function(response) {
                if (chrome.runtime.lastError) {
                    console.error('메시지 전송 에러:', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                    return;
                }
                resolve(response);
            });
        });
    });
}

// 초기 로드 시 content script에 상품 정보 요청
document.addEventListener('DOMContentLoaded', async () => {
    console.log('사이드 패널: 초기 로드 시작');
    try {
        const response = await sendMessageToContentScript({type: 'GET_PRODUCT_INFO'});
        console.log('사이드 패널: 상품 정보 응답 수신', response);
        
        if (response && response.productInfo) {
            updateProductInfo(response.productInfo);
        }
    } catch (error) {
        console.error('사이드 패널: 상품 정보 요청 실패', error);
    }
}); 