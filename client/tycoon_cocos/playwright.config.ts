import { defineConfig, devices } from '@playwright/test';

// e2e 配置. 容器入口在 docker/e2e/scripts/entrypoint.sh (起静态 server + 跑这个 config)
// 想在 host 直跑: cd client/tycoon_cocos && npm install -D @playwright/test && npx playwright test
export default defineConfig({
    testDir: './tests/e2e',

    // Cocos 游戏全局 canvas/WebGL 状态多, 多 worker 并行容易资源竞争
    workers: 1,
    fullyParallel: false,

    // 开发期立即看错; CI 想加重试时改这里
    retries: 0,

    // Cocos 加载 + WebGL 初始化通常较慢, 默认 30s 不够
    timeout: 60_000,

    use: {
        baseURL: 'http://localhost:8080',
        // 失败时存 trace 给 playwright-report 用
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
