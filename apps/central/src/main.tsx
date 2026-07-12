import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthGate } from '@travel/ui';
import { CentralApp } from './CentralApp';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root 요소를 찾을 수 없습니다.');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    {/* 통합 화면은 본사(is_central) 계정만 열 수 있다 */}
    <AuthGate title="통합 DB" requireCentral>
      {({ session, onSignOut }) => (
        <CentralApp session={session} onSignOut={onSignOut} />
      )}
    </AuthGate>
  </React.StrictMode>,
);
