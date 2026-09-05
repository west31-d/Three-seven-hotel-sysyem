import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PublicHotelApp } from './app/PublicHotelApp';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root 요소를 찾을 수 없습니다.');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <BrowserRouter>
      <PublicHotelApp />
    </BrowserRouter>
  </React.StrictMode>,
);
