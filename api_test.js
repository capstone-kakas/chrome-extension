async function sendRequest() {
    const method = document.getElementById('method').value;
    const url = document.getElementById('url').value;
    const headersText = document.getElementById('headers').value;
    const bodyText = document.getElementById('body').value;
    const responseElement = document.getElementById('response');

    try {
        // Headers 파싱
        let headers = {};
        if (headersText) {
            try {
                headers = JSON.parse(headersText);
            } catch (e) {
                throw new Error('Headers JSON 형식이 올바르지 않습니다.');
            }
        }

        // Request body 파싱
        let body = null;
        if (bodyText && (method === 'POST' || method === 'PUT')) {
            try {
                body = JSON.parse(bodyText);
            } catch (e) {
                throw new Error('Request body JSON 형식이 올바르지 않습니다.');
            }
        }

        // API 요청 보내기
        const response = await fetch(url, {
            method: method,
            headers: headers,
            body: body ? JSON.stringify(body) : undefined
        });

        // 응답 처리
        const responseData = await response.json();
        responseElement.textContent = JSON.stringify(responseData, null, 2);
    } catch (error) {
        responseElement.textContent = `에러 발생: ${error.message}`;
    }
} 