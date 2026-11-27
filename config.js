// ============================================================
//  設定檔：只要改這個檔案（步驟教學請看 README.md）
// ============================================================

export const SITE = {
  // 網站名稱（顯示在頂端選單與首頁）
  name: '蟲蟲對對碰代購',
  // 首頁標題下的一句話
  tagline: '旅遊代購不保單',
};

// 賣家（你）的 Google 帳號 Email。用這個帳號登入的人才有編輯權限。
// ⚠️ 也要同步改 firestore.rules 裡的 OWNER_EMAIL。
export const OWNER_EMAIL = 'hailey214h@gmail.com';

// 從 Firebase 主控台「專案設定 → 你的應用程式」複製過來貼上。
// 保持 YOUR_ 開頭的話，網站會用「示範模式」（資料只存在這台裝置的瀏覽器）。
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCSwVwFdlAS4tNrkzikosP3ok8bHTcMyoQ",
  authDomain: "buybuy-87281.firebaseapp.com",
  projectId: "buybuy-87281",
  storageBucket: "buybuy-87281.firebasestorage.app",
  messagingSenderId: "573428521430",
  appId: "1:573428521430:web:d9f07fc1b9d3ea01bcec77"
};
