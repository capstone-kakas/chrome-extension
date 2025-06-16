// 상품 정보를 업데이트하는 함수
async function updateProductInfo(productInfo) {
    console.log('사이드 패널: 상품 정보 업데이트 시작', productInfo);
    
    // storage에 상품 정보 저장
    const result = await new Promise(resolve => {
        chrome.storage.local.get(['productStore', 'lastStoredProductId'], resolve);
    });
    
    const productStore = result.productStore || {};
    
    // 기존 상품 정보가 있다면 유지하고, 새로운 정보로 업데이트
    const existingInfo = productStore[productInfo.productId] || {};
    productStore[productInfo.productId] = {
        ...existingInfo,
        ...productInfo,
        lastUpdated: new Date().toISOString()
    };
    
    // lastStoredProductId 업데이트
    await new Promise(resolve => {
        chrome.storage.local.set({ 
            productStore,
            lastStoredProductId: productInfo.productId 
        }, resolve);
    });
    
    // 기본 정보 업데이트
    const productNameEl = document.getElementById('product-name');
    const productTitleEl = document.getElementById('product-title');
    
    if (productNameEl) {
        productNameEl.value = productInfo.productName || '';
        productNameEl.placeholder = '상품명을 입력하세요';
    }
    if (productTitleEl) {
        productTitleEl.textContent = productInfo.productName || '-';
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
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            mode: 'cors',
            credentials: 'omit',
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
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
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
        suggestedListEl.innerHTML = `<div class="error">추천 상품명을 불러오는데 실패했습니다. (${error.message})</div>`;
    } finally {
        loadingEl.style.display = 'none';
    }
}

// 추천 상품명을 표시하는 함수
function displaySuggestedNames(suggestedNames, productId) {
    const suggestedListEl = document.getElementById('suggestedList');
    suggestedListEl.innerHTML = '';
    
    suggestedNames.forEach(name => {
        const nameEl = document.createElement('div');
        nameEl.className = 'product-item';
        nameEl.innerHTML = `
            <div class="product-content">
                <div class="product-name">${name}</div>
                <div class="arrow-icon"></div>
            </div>
        `;
        nameEl.onclick = () => selectSuggestedName(name, productId);
        suggestedListEl.appendChild(nameEl);
    });
}

// 상품명을 선택하는 함수
async function selectSuggestedName(selectedName, productId) {
    try {
        // 모든 추천 상품명 항목에서 selected 클래스 제거
        document.querySelectorAll('.product-item').forEach(el => {
            el.classList.remove('selected');
        });
        
        // 선택된 항목에 selected 클래스 추가
        event.currentTarget.classList.add('selected');
        
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
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                mode: 'cors',
                credentials: 'omit',
                body: JSON.stringify({
                    chatRoomId: productInfo.chatRoomId,
                    productName: selectedName
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('선택된 상품명 API 응답:', data);
            
            if (!data.isSuccess) {
                throw new Error(data.message || '상품명 선택 처리에 실패했습니다.');
            }

            // 가격 정보 가져오기
            await fetchPriceInfo(selectedName, productInfo);
            
            // 상품명 선택 뷰 숨기기
            document.getElementById('productSelectionView').classList.add('hidden');
            
            // 분석 결과 뷰 표시
            const analysisView = document.getElementById('analysisView');
            analysisView.classList.add('visible');
            
            // 분석 결과 업데이트
            updateAnalysisView(productInfo);
        }
    } catch (error) {
        console.error('상품명 선택 처리 중 에러:', error);
        // 에러 메시지 표시
        const errorEl = document.createElement('div');
        errorEl.className = 'error';
        errorEl.textContent = `상품명 선택 처리에 실패했습니다. (${error.message})`;
        document.getElementById('suggestedList').appendChild(errorEl);
    }
}

// 가격 정보를 가져오는 함수
async function fetchPriceInfo(productName, productInfo) {
    try {
        // URL에 상품명을 쿼리 파라미터로 추가
        const encodedProductName = encodeURIComponent(productName);
        const response = await fetch(`https://13.125.148.205/salePrices?productName=${encodedProductName}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            mode: 'cors',
            credentials: 'omit'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('가격 정보 API 응답:', data);

        if (data.isSuccess && data.result) {
            // 각 쇼핑몰의 가격 정보 저장
            productInfo.priceInfo = {
                gmarket: data.result.gmarket,
                elevenstreet: data.result.elevenstreet,
                coupang: data.result.coupang,
                auction: data.result.auction
            };

            // 최저가 계산
            const prices = [
                parsePriceString(data.result.gmarket),
                parsePriceString(data.result.elevenstreet),
                parsePriceString(data.result.coupang),
                parsePriceString(data.result.auction)
            ].filter(price => price !== null && !isNaN(price));

            console.log('파싱된 가격 목록:', prices);

            if (prices.length > 0) {
                const minPrice = Math.min(...prices);
                console.log('최저가:', minPrice);
                productInfo.newPrice = minPrice;
            } else {
                console.log('유효한 가격 정보가 없음');
                productInfo.newPrice = null;
            }

            // storage 업데이트
            const result = await new Promise(resolve => {
                chrome.storage.local.get(['productStore'], resolve);
            });
            
            const productStore = result.productStore || {};
            productStore[productInfo.productId] = productInfo;
            
            await new Promise(resolve => {
                chrome.storage.local.set({ productStore }, resolve);
            });
        }
    } catch (error) {
        console.error('가격 정보 가져오기 실패:', error);
    }
}

// 분석 결과 뷰 업데이트 함수
async function updateAnalysisView(productInfo) {
    // 상품명 업데이트
    const productNameEl = document.getElementById('product-name');
    const productTitleEl = document.getElementById('product-title');
    
    if (productNameEl) {
        productNameEl.textContent = productInfo.actualProductName || productInfo.productName || '-';
    }
    if (productTitleEl) {
        productTitleEl.textContent = productInfo.actualProductName || productInfo.productName || '-';
    }

    // 가격 비율 업데이트 (새제품 최저가 대비)
    const priceRatioEl = document.getElementById('priceRatio');
    const newPriceEl = document.getElementById('newPrice');
    const currentPriceDetailEl = document.getElementById('currentPriceDetail');
    const discountRateEl = document.getElementById('discountRate');
    
    // 온라인 쇼핑몰 가격 정보 업데이트
    const gmarketPriceEl = document.getElementById('gmarketPrice');
    const elevenstreetPriceEl = document.getElementById('elevenstreetPrice');
    const coupangPriceEl = document.getElementById('coupangPrice');
    const auctionPriceEl = document.getElementById('auctionPrice');
    
    console.log("현재 가격:", productInfo.price);
    console.log("새제품 최저가:", productInfo.newPrice); 
    
    if (priceRatioEl && productInfo.price && productInfo.newPrice) {
        const currentPrice = parsePriceString(productInfo.price);
        const newPrice = parsePriceString(productInfo.newPrice);
        
        console.log("파싱된 현재 가격:", currentPrice);
        console.log("파싱된 새제품 최저가:", newPrice);
        
        if (currentPrice !== null && newPrice !== null && !isNaN(currentPrice) && !isNaN(newPrice)) {
            // 가격 비율 계산
            const ratio = Math.round((currentPrice / newPrice) * 100);
            console.log("계산된 가격 비율:", ratio);
            priceRatioEl.textContent = `${ratio}%`;
            
            // 새제품 최저가 표시
            if (newPriceEl) {
                newPriceEl.textContent = `${newPrice.toLocaleString()}원`;
            }
            
            // 현재 가격 표시
            if (currentPriceDetailEl) {
                currentPriceDetailEl.textContent = `${currentPrice.toLocaleString()}원`;
            }
            
            // 할인율 계산 및 표시
            if (discountRateEl) {
                const discountRate = Math.round((1 - currentPrice / newPrice) * 100);
                console.log("계산된 할인율:", discountRate);
                discountRateEl.textContent = `${discountRate}%`;
            }
            
            // 온라인 쇼핑몰 가격 정보 표시
            if (productInfo.priceInfo) {
                if (gmarketPriceEl) {
                    gmarketPriceEl.textContent = productInfo.priceInfo.gmarket || '-';
                }
                if (elevenstreetPriceEl) {
                    elevenstreetPriceEl.textContent = productInfo.priceInfo.elevenstreet || '-';
                }
                if (coupangPriceEl) {
                    coupangPriceEl.textContent = productInfo.priceInfo.coupang || '-';
                }
                if (auctionPriceEl) {
                    auctionPriceEl.textContent = productInfo.priceInfo.auction || '-';
                }
            }
            
            // 프로그레스 바 업데이트
            const progressPath = document.getElementById('progressPath');
            if (progressPath) {
                const pathLength = progressPath.getTotalLength();
                const offset = pathLength - (ratio / 100) * pathLength;
                progressPath.style.strokeDashoffset = offset;
            }
        } else {
            console.log("가격 계산 실패: 유효하지 않은 가격 데이터");
            priceRatioEl.textContent = '-';
            if (newPriceEl) newPriceEl.textContent = '-';
            if (currentPriceDetailEl) currentPriceDetailEl.textContent = '-';
            if (discountRateEl) discountRateEl.textContent = '-';
        }
    } else {
        console.log("가격 정보 누락");
        priceRatioEl.textContent = '-';
        if (newPriceEl) newPriceEl.textContent = '-';
        if (currentPriceDetailEl) currentPriceDetailEl.textContent = '-';
        if (discountRateEl) discountRateEl.textContent = '-';
    }

    // 관심도 정보 업데이트
    const { wishCount = 0, viewCount = 0, timeElapsed } = productInfo;
    const interestLevel = getInterestLevel(wishCount, viewCount);
    
    elements.interestLevel.textContent = interestLevel;
    elements.viewCount.textContent = `조회수 ${viewCount.toLocaleString()}회`;
    elements.wishCount.textContent = `찜 ${wishCount.toLocaleString()}회`;
}

function getInterestLevel(wishCount, viewCount) {
    const ratio = viewCount > 0 ? (wishCount / viewCount) * 100 : 0;
    
    if (ratio >= 30) return '매우 높음';
    if (ratio >= 20) return '높음';
    if (ratio >= 10) return '보통';
    if (ratio >= 5) return '낮음';
    return '매우 낮음';
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

// 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', () => {
    // 뒤로가기 버튼 이벤트
    document.getElementById('backButton').addEventListener('click', goBack);
    document.getElementById('analysisBackButton').addEventListener('click', goBack);

    // 검색바 이벤트
    const searchBar = document.getElementById('searchBar');
    const productNameInput = document.getElementById('product-name');
    
    productNameInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            const newProductName = e.target.value.trim();
            if (newProductName) {
                // storage에서 현재 상품 정보 가져오기
                const result = await new Promise(resolve => {
                    chrome.storage.local.get(['productStore'], resolve);
                });
                
                const productStore = result.productStore || {};
                const currentProductId = Object.keys(productStore)[0]; // 현재 상품 ID
                
                if (currentProductId) {
                    const productInfo = productStore[currentProductId];
                    productInfo.actualProductName = newProductName;
                    
                    // storage 업데이트
                    await new Promise(resolve => {
                        chrome.storage.local.set({ productStore }, resolve);
                    });
                    
                    // 상품명 선택 뷰 숨기기
                    document.getElementById('productSelectionView').classList.add('hidden');
                    
                    // 분석 결과 뷰 표시
                    const analysisView = document.getElementById('analysisView');
                    analysisView.classList.add('visible');
                    
                    // 분석 결과 업데이트
                    updateAnalysisView(productInfo);
                }
            }
        }
    });

    // 분석 결과 뷰의 뒤로가기 버튼 이벤트
    document.getElementById('analysisBackButton').addEventListener('click', () => {
        document.getElementById('analysisView').classList.remove('visible');
        document.getElementById('productSelectionView').classList.remove('hidden');
    });

    // 초기 로드 시 content script에 상품 정보 요청
    sendMessageToContentScript({type: 'GET_PRODUCT_INFO'})
        .then(response => {
            if (response && response.productInfo) {
                updateProductInfo(response.productInfo);
            }
        })
        .catch(error => {
            console.error('사이드 패널: 상품 정보 요청 실패', error);
        });
});

// DOM 요소
const elements = {
    backButton: document.getElementById('backButton'),
    searchBar: document.getElementById('searchBar'),
    dealArrow: document.getElementById('dealArrow'),
    priceStatCard: document.getElementById('priceStatCard'),
    activityStatCard: document.getElementById('activityStatCard'),
    productName: document.getElementById('product-name'),
    productTitle: document.getElementById('product-title'),
    currentPrice: document.getElementById('currentPrice'),
    priceRatio: document.getElementById('priceRatio'),
    newPrice: document.getElementById('newPrice'),
    currentPriceDetail: document.getElementById('currentPriceDetail'),
    discountRate: document.getElementById('discountRate'),
    viewCount: document.getElementById('viewCount'),
    wishCount: document.getElementById('wishCount'),
    interestLevel: document.getElementById('interestLevel'),
    priceFill: document.getElementById('priceFill'),
    progressPath: document.getElementById('progressPath')
};

// 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    initializeProgressBar();
    loadProductData();
    initializeAnimations();
});

function initializeEventListeners() {
    // 뒤로가기 버튼 이벤트
    document.getElementById('backButton').addEventListener('click', goBack);
    document.getElementById('analysisBackButton').addEventListener('click', goBack);
    
    // 검색바 이벤트
    const searchBar = document.getElementById('searchBar');
    const productNameInput = document.getElementById('product-name');
    
    productNameInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            const newProductName = e.target.value.trim();
            if (newProductName) {
                // storage에서 현재 상품 정보 가져오기
                const result = await new Promise(resolve => {
                    chrome.storage.local.get(['productStore'], resolve);
                });
                
                const productStore = result.productStore || {};
                const currentProductId = Object.keys(productStore)[0]; // 현재 상품 ID
                
                if (currentProductId) {
                    const productInfo = productStore[currentProductId];
                    productInfo.actualProductName = newProductName;
                    
                    // storage 업데이트
                    await new Promise(resolve => {
                        chrome.storage.local.set({ productStore }, resolve);
                    });
                    
                    // 상품명 선택 뷰 숨기기
                    document.getElementById('productSelectionView').classList.add('hidden');
                    
                    // 분석 결과 뷰 표시
                    const analysisView = document.getElementById('analysisView');
                    analysisView.classList.add('visible');
                    
                    // 분석 결과 업데이트
                    updateAnalysisView(productInfo);
                }
            }
        }
    });
    
    // 기존 이벤트 리스너들...
    document.getElementById('dealArrow').addEventListener('click', startDeal);
    document.getElementById('priceStatCard').addEventListener('click', togglePriceCard);
    document.getElementById('activityStatCard').addEventListener('click', showActivityDetails);
}

function initializeProgressBar() {
    // 프로그레스 바 초기화
    const pathLength = elements.progressPath.getTotalLength();
    elements.progressPath.style.strokeDasharray = pathLength;
    elements.progressPath.style.strokeDashoffset = pathLength;
}

// 가격 문자열을 숫자로 파싱하는 함수
function parsePriceString(priceString) {
    console.log('파싱할 가격 문자열:', priceString);
    
    if (!priceString) {
        console.log('가격 문자열이 없음');
        return null;
    }

    // 이미 숫자인 경우
    if (typeof priceString === 'number') {
        console.log('이미 숫자 타입');
        return priceString;
    }

    // 문자열인 경우
    if (typeof priceString === 'string') {
        // 쉼표, "원", 공백 제거
        const cleanedString = priceString.replace(/[원,\s]/g, '').trim();
        console.log('정제된 문자열:', cleanedString);
        
        // 숫자로 변환
        const number = parseInt(cleanedString, 10);
        console.log('변환된 숫자:', number);
        
        // NaN 체크
        if (isNaN(number)) {
            console.log('유효하지 않은 숫자');
            return null;
        }
        
        return number;
    }

    console.log('지원하지 않는 타입:', typeof priceString);
    return null;
}

function initializeAnimations() {
    // 가격 바 애니메이션
    setTimeout(() => {
        const priceFill = document.getElementById('priceFill');
        if (priceFill) {
            priceFill.style.width = '49.2%';
        }
    }, 500);
}

function goBack() {
    document.querySelector('.container').style.transform = 'translateX(-100%)';
    document.querySelector('.container').style.opacity = '0';
    setTimeout(() => {
        window.history.back();
    }, 300);
}

function openSearch() {
    alert('검색 기능을 실행합니다');
    elements.searchBar.classList.add('pulse');
    setTimeout(() => {
        elements.searchBar.classList.remove('pulse');
    }, 1000);
}

function startDeal() {
    alert('거래를 시작합니다!');
    document.querySelector('.deal-section').classList.add('pulse');
    setTimeout(() => {
        document.querySelector('.deal-section').classList.remove('pulse');
    }, 1000);
}

function togglePriceCard() {
    const card = elements.priceStatCard;
    const isExpanded = card.classList.contains('expanded');
    
    if (isExpanded) {
        card.classList.remove('expanded');
    } else {
        card.classList.add('expanded');
    }
}

function showPriceDetails() {
    chrome.storage.local.get(['productStore', 'lastStoredProductId'], function(result) {
        console.log('가격 상세 정보 - 전체 데이터:', result);
        const { productStore = {}, lastStoredProductId } = result;
        const currentProduct = productStore[lastStoredProductId];
        console.log('가격 상세 정보 - 현재 상품:', currentProduct);

        if (currentProduct) {
            const price = parsePriceString(currentProduct.price);
            const newPrice = parsePriceString(currentProduct.newPrice);
            console.log('가격 상세 정보 - 파싱된 가격:', { price, newPrice });

            if (price !== null && newPrice !== null) {
                const priceRatio = Math.round((price / newPrice) * 100);
                const discountRate = Math.round((1 - price / newPrice) * 100);
                console.log('가격 상세 정보 - 계산된 비율:', { priceRatio, discountRate });

                alert(
                    `현재 가격: ${price.toLocaleString()}원\n` +
                    `새제품 평균가: ${newPrice.toLocaleString()}원\n` +
                    `가격 비율: ${priceRatio}%\n` +
                    `할인율: ${discountRate}%`
                );
            } else {
                console.log('가격 상세 정보 - 가격 파싱 실패');
                alert('가격 정보를 불러올 수 없습니다.');
            }
        } else {
            console.log('가격 상세 정보 - 상품 데이터 없음');
            alert('상품 정보를 불러올 수 없습니다.');
        }
    });
}

function showActivityDetails() {
    // storage에서 현재 상품 정보 가져오기
    chrome.storage.local.get(['productStore', 'lastStoredProductId'], function(result) {
        const { productStore = {}, lastStoredProductId } = result;
        const currentProduct = productStore[lastStoredProductId];

        if (currentProduct) {
            const viewCount = currentProduct.viewCount || 0;
            const wishCount = currentProduct.wishCount || 0;
            const interestLevel = viewCount < 10 ? '낮음' : viewCount < 30 ? '보통' : '높음';
            const dealPossibility = wishCount > 5 ? '높음' : '보통';

            alert(`관심도 상세 정보:\n• 최근 1시간 조회: ${viewCount}명\n• 찜한 사람: ${wishCount}명\n• 관심도: ${interestLevel}\n• 거래 가능성: ${dealPossibility}`);
        } else {
            alert('상품 정보를 불러올 수 없습니다.');
        }
    });
}

function loadProductData() {
    // storage에서 현재 게시물의 정보를 가져옴
    chrome.storage.local.get(['productStore', 'lastStoredProductId'], function(result) {
        console.log('전체 storage 데이터:', result);
        const { productStore = {}, lastStoredProductId } = result;
        console.log('lastStoredProductId:', lastStoredProductId);
        console.log('productStore:', productStore);
        
        const currentProduct = productStore[lastStoredProductId];
        console.log('현재 상품 데이터:', JSON.stringify(currentProduct, null, 2));

        if (currentProduct) {
            // 상품명 업데이트
            elements.productName.textContent = currentProduct.productName;
            elements.productTitle.textContent = currentProduct.productName;

            // 가격 정보 업데이트
            if (currentProduct.price) {
                console.log('원본 가격:', currentProduct.price);
                const parsedPrice = parsePriceString(currentProduct.price);
                console.log('파싱된 가격:', parsedPrice);
                console.log('파싱된 가격 타입:', typeof parsedPrice);
                
                if (parsedPrice !== null) {
                    elements.currentPrice.textContent = parsedPrice.toLocaleString() + '원';
                    elements.currentPriceDetail.textContent = parsedPrice.toLocaleString() + '원';
                    console.log('표시된 가격:', elements.currentPrice.textContent);
                } else {
                    console.log('가격 파싱 실패');
                    elements.currentPrice.textContent = '-';
                    elements.currentPriceDetail.textContent = '-';
                }
                
                // 가격 비율 계산 및 표시 (새제품 최저가 대비)
                const newPrice = currentProduct.newPrice;
                console.log('새제품 가격 데이터:', newPrice);
                
                if (newPrice) {
                    console.log('원본 새제품 가격:', newPrice);
                    const parsedNewPrice = typeof newPrice === 'number' ? newPrice : parsePriceString(newPrice);
                    console.log('파싱된 새제품 가격:', parsedNewPrice);
                    
                    if (parsedNewPrice !== null && parsedPrice !== null) {
                        const priceRatio = Math.round((parsedPrice / parsedNewPrice) * 100);
                        elements.priceRatio.textContent = priceRatio + '%';

                        // 반원형 프로그레스 바 애니메이션
                        const pathLength = elements.progressPath.getTotalLength();
                        const offset = pathLength - (priceRatio / 100) * pathLength;

                        // 애니메이션 초기화
                        elements.progressPath.style.strokeDasharray = pathLength;
                        elements.progressPath.style.strokeDashoffset = pathLength;

                        // 애니메이션 실행
                        requestAnimationFrame(() => {
                            elements.progressPath.style.transition = 'stroke-dashoffset 2s ease-in-out';
                            elements.progressPath.style.strokeDashoffset = offset;
                        });

                        // 가격 상세 정보 업데이트
                        elements.newPrice.textContent = parsedNewPrice.toLocaleString() + '원';
                        elements.discountRate.textContent = Math.round((1 - parsedPrice / parsedNewPrice) * 100) + '%';
                    } else {
                        console.log('새제품 가격 파싱 실패');
                        elements.priceRatio.textContent = '-';
                        elements.newPrice.textContent = '-';
                        elements.discountRate.textContent = '-';
                    }
                } else {
                    console.log('새제품 가격 데이터 없음');
                    elements.priceRatio.textContent = '-';
                    elements.newPrice.textContent = '-';
                    elements.discountRate.textContent = '-';
                }
            }

            // 관심도 정보 업데이트
            if (currentProduct.viewCount) {
                elements.viewCount.textContent = `${currentProduct.viewCount}명이 봤고`;
            }
            if (currentProduct.wishCount) {
                elements.wishCount.textContent = `${currentProduct.wishCount}명이 찜했고`;
            }
            if (elements.interestLevel) {
                const viewCount = currentProduct.viewCount || 0;
                if (viewCount < 10) {
                    elements.interestLevel.textContent = '많이 없네요';
                } else if (viewCount < 30) {
                    elements.interestLevel.textContent = '보통이에요';
                } else {
                    elements.interestLevel.textContent = '많아요';
                }
            }
        } else {
            console.log('현재 상품 데이터가 없음');
            // 데이터가 없는 경우 기본값 표시
            elements.productName.textContent = '상품 정보를 불러오는 중...';
            elements.productTitle.textContent = '상품 정보를 불러오는 중...';
            elements.currentPrice.textContent = '-';
            elements.currentPriceDetail.textContent = '-';
            elements.viewCount.textContent = '-';
            elements.wishCount.textContent = '-';
            elements.interestLevel.textContent = '-';
        }
    });
}

// CSS 애니메이션 추가
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style); 