# Vue 3 + TypeScript + Vite
## pnpm + vite + vue3
```
  pnpm create vite@latest
  cd <项目名称>
  pnpm install
  pnpm run dev
```
## 安装依赖

```
  pnpm i @types/node -D
  pnpm i vue-router
  pnpm i pinia
  pnpm install -D eslint eslint-plugin-vue
  pnpm install -D sass sass-loader
  pnpm install -D element-plus 
  pnpm install -D vue-awesome-swiper 
  pnpm install -D vue-progressbar
  pnpm i pinia-plugin-persistedstate
  pnpm install -D @babel/core @babel/preset-env
  pnpm install @babel/cli @babel/core @babel/preset-env -D
  pnpm i @babel/plugin-transform-runtime -D
  pnpm i @babel/runtime-corejs3 -S


```
js代码：
```
// 修改vite.config.ts配置文件代码
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from "path"

export default defineConfig({
  plugins: [vue()],
  resolve: {
    // ↓路径别名，主要是这部分
    alias: {
      "@": resolve(__dirname, "./src")
    }
  }
})
```
