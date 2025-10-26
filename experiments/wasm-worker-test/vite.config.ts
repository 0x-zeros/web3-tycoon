import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait()
  ],
  worker: {
    format: 'es',
    plugins: () => [wasm(), topLevelAwait()]
  },
  server: {
    fs: {
      // 允许访问上级目录，以便加载 rust-hello-wasm/pkg 中的 WASM 文件
      allow: ['..']
    }
  }
});
