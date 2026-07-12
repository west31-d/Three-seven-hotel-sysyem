import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// 워크스페이스 패키지를 소스 그대로 참조한다(별도 빌드 단계 불필요).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@travel/domain': fileURLToPath(
        new URL('../../packages/domain/src/index.ts', import.meta.url),
      ),
      '@travel/data': fileURLToPath(
        new URL('../../packages/data/src/index.ts', import.meta.url),
      ),
      '@travel/ui': fileURLToPath(
        new URL('../../packages/ui/src/index.ts', import.meta.url),
      ),
    },
  },
});
