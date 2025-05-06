# Kakas Chrome Extension

Kakas 프로젝트를 위한 크롬 익스텐션입니다.  
웹 페이지 상에서 필요한 정보를 추출하거나 사용자 편의를 위한 인터페이스를 제공합니다.

---

## 🚀 주요 기능

- 웹 페이지 DOM 추출 및 전송
- 버튼 클릭 시 사용자 요청 트리거
- Spring Boot 백엔드 또는 AI 서버와 연동

---

## 📁 프로젝트 구조
kakas/
├── content_script.js       # 웹 페이지에서 동작하는 스크립트
├── popup.html              # 확장 프로그램 팝업 UI
├── manifest.json           # 크롬 익스텐션 설정 파일 (manifest V3)
---

## 🛠️ 설치 방법 (로컬 테스트)
1. 크롬 브라우저에서 `chrome://extensions` 접속
<img width="1470" alt="Image" src="https://github.com/user-attachments/assets/d080a00a-7c63-4fcd-84d2-c845189beca7" />
2. 우측 상단 "개발자 모드" ON
3. "압축해제된 확장 프로그램을 로드" 클릭
4. 이 프로젝트 폴더(`kakas/`) 선택

---

## 🔗 백엔드 및 AI 연동

- 📦 Spring Boot 백엔드: [kakas-backend](https://github.com/capstone-kakas/backend)
- 🧠 AI 서버: [kakas-ai](https://github.com/capstone-kakas/ai)

> 이 확장 프로그램은 위 백엔드들과 API 통신을 수행합니다.

---