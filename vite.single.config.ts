import { defineConfig } from 'vite';

// 单文件版：把动态 import 全部打进一个 bundle，避免 file:// 下按相对路径再请求 chunk。
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
    outDir: 'dist-single',
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
