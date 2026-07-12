import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './app/store';
import { AuthGate } from '@travel/ui';
import { App } from './app/App';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root 요소를 찾을 수 없습니다.');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <AuthGate title="호텔 예약관리">
      {({ session, onSignOut }) => (
        <BrowserRouter>
          <AppProvider session={session}>
            <App onSignOut={onSignOut} email={session?.email ?? null} />
          </AppProvider>
        </BrowserRouter>
      )}
    </AuthGate>
  </React.StrictMode>,
);
