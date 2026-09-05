import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './app/store';
import { App } from './app/App';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root 요소를 찾을 수 없습니다.');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* 로그인 없이 브라우저의 로컬 예약 저장소를 사용한다. */}
      <AppProvider session={null}>
        <App />
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
