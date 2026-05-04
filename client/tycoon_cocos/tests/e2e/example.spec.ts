import { test, expect } from '@playwright/test';

// 烟雾测试: 验证 docker/e2e 容器 + 静态 server + playwright 这条链路通
// 真正的业务测试后面替换/补充
test.describe('smoke', () => {
    test('static server returns build/web-mobile/index.html', async ({ page }) => {
        const response = await page.goto('/');
        expect(response?.status()).toBe(200);
        // Cocos build 出来的 index.html 含有 <title>...</title>, 非空即视为合理
        await expect(page).toHaveTitle(/.+/);
    });

    test('a canvas mounts (Cocos 渲染容器)', async ({ page }) => {
        await page.goto('/');
        // Cocos Creator 3.x 默认渲染到 #GameCanvas 或一个 canvas 元素
        // canvas 本身可能直到 WebGL 初始化才出现, 给 30s
        await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
    });
});
