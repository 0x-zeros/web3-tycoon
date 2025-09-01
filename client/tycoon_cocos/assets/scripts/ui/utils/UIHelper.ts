import { Node, Vec3, tween, UITransform, view, Canvas, Camera, director } from "cc";

/**
 * UI辅助工具类 - 提供常用的UI操作方法
 */
export class UIHelper {
    
    /**
     * 将世界坐标转换为UI坐标
     */
    public static worldToUIPosition(worldPos: Vec3, canvas: Canvas): Vec3 {
        const camera = canvas.cameraComponent || director.getScene()?.getComponentInChildren(Camera);
        if (!camera) {
            console.warn("[UIHelper] Camera not found");
            return Vec3.ZERO;
        }

        // 世界坐标转屏幕坐标
        const screenPos = camera.worldToScreen(worldPos);
        
        // 屏幕坐标转UI坐标
        const canvasTransform = canvas.node.getComponent(UITransform);
        if (!canvasTransform) {
            return Vec3.ZERO;
        }

        return canvasTransform.convertToNodeSpaceAR(new Vec3(screenPos.x, screenPos.y, 0));
    }

    /**
     * 将UI坐标转换为世界坐标
     */
    public static uiToWorldPosition(uiPos: Vec3, canvas: Canvas, depth: number = 0): Vec3 {
        const camera = canvas.cameraComponent || director.getScene()?.getComponentInChildren(Camera);
        if (!camera) {
            console.warn("[UIHelper] Camera not found");
            return Vec3.ZERO;
        }

        const canvasTransform = canvas.node.getComponent(UITransform);
        if (!canvasTransform) {
            return Vec3.ZERO;
        }

        // UI坐标转屏幕坐标
        const screenPos = canvasTransform.convertToWorldSpaceAR(uiPos);
        
        // 屏幕坐标转世界坐标
        return camera.screenToWorld(new Vec3(screenPos.x, screenPos.y, depth));
    }

    /**
     * 获取节点在屏幕上的边界框
     */
    public static getNodeBounds(node: Node): { min: Vec3; max: Vec3; center: Vec3; size: Vec3 } {
        const transform = node.getComponent(UITransform);
        if (!transform) {
            return { min: Vec3.ZERO, max: Vec3.ZERO, center: Vec3.ZERO, size: Vec3.ZERO };
        }

        const size = transform.contentSize;
        const worldPos = node.getWorldPosition();
        
        const halfWidth = size.width / 2;
        const halfHeight = size.height / 2;

        const min = new Vec3(worldPos.x - halfWidth, worldPos.y - halfHeight, worldPos.z);
        const max = new Vec3(worldPos.x + halfWidth, worldPos.y + halfHeight, worldPos.z);
        const center = worldPos.clone();

        return { min, max, center, size: new Vec3(size.width, size.height, 0) };
    }

    /**
     * 检查两个节点是否重叠
     */
    public static isNodesOverlap(nodeA: Node, nodeB: Node): boolean {
        const boundsA = this.getNodeBounds(nodeA);
        const boundsB = this.getNodeBounds(nodeB);

        return !(boundsA.max.x < boundsB.min.x ||
                boundsA.min.x > boundsB.max.x ||
                boundsA.max.y < boundsB.min.y ||
                boundsA.min.y > boundsB.max.y);
    }

    /**
     * 计算两个节点之间的距离
     */
    public static getDistanceBetweenNodes(nodeA: Node, nodeB: Node): number {
        const posA = nodeA.getWorldPosition();
        const posB = nodeB.getWorldPosition();
        return Vec3.distance(posA, posB);
    }

    /**
     * 将节点缩放到指定大小并居中
     */
    public static fitNodeToSize(node: Node, targetSize: { width: number; height: number }, keepRatio: boolean = true): void {
        const transform = node.getComponent(UITransform);
        if (!transform) return;

        const originalSize = transform.contentSize;
        
        if (keepRatio) {
            // 保持宽高比
            const scaleX = targetSize.width / originalSize.width;
            const scaleY = targetSize.height / originalSize.height;
            const scale = Math.min(scaleX, scaleY);
            node.setScale(scale, scale, 1);
        } else {
            // 拉伸填充
            const scaleX = targetSize.width / originalSize.width;
            const scaleY = targetSize.height / originalSize.height;
            node.setScale(scaleX, scaleY, 1);
        }
    }

    /**
     * 平滑移动节点到目标位置
     */
    public static moveNodeTo(node: Node, targetPos: Vec3, duration: number = 0.5, easing: string = "quartOut"): Promise<void> {
        return new Promise((resolve) => {
            tween(node)
                .to(duration, { position: targetPos }, { easing })
                .call(() => resolve())
                .start();
        });
    }

    /**
     * 平滑缩放节点
     */
    public static scaleNodeTo(node: Node, targetScale: Vec3, duration: number = 0.3, easing: string = "backOut"): Promise<void> {
        return new Promise((resolve) => {
            tween(node)
                .to(duration, { scale: targetScale }, { easing })
                .call(() => resolve())
                .start();
        });
    }

    /**
     * 节点弹跳动画
     */
    public static bounceNode(node: Node, intensity: number = 0.1, duration: number = 0.6): Promise<void> {
        return new Promise((resolve) => {
            const originalScale = node.scale.clone();
            const bounceScale = originalScale.clone().multiplyScalar(1 + intensity);

            tween(node)
                .to(duration * 0.3, { scale: bounceScale }, { easing: "quartOut" })
                .to(duration * 0.7, { scale: originalScale }, { easing: "elasticOut" })
                .call(() => resolve())
                .start();
        });
    }

    /**
     * 节点摇摆动画
     */
    public static shakeNode(node: Node, intensity: number = 10, duration: number = 0.5): Promise<void> {
        return new Promise((resolve) => {
            const originalPos = node.position.clone();
            let shakeCount = 0;
            const maxShakes = Math.floor(duration * 60); // 假设60fps

            const shakeInterval = setInterval(() => {
                if (shakeCount >= maxShakes) {
                    clearInterval(shakeInterval);
                    node.setPosition(originalPos);
                    resolve();
                    return;
                }

                const offsetX = (Math.random() - 0.5) * intensity * 2;
                const offsetY = (Math.random() - 0.5) * intensity * 2;
                const shakePos = originalPos.clone().add(new Vec3(offsetX, offsetY, 0));
                
                node.setPosition(shakePos);
                shakeCount++;
            }, 1000 / 60);
        });
    }

    /**
     * 淡入动画
     */
    public static fadeIn(node: Node, duration: number = 0.3): Promise<void> {
        return new Promise((resolve) => {
            node.active = true;
            tween(node)
                .set({ opacity: 0 })
                .to(duration, { opacity: 255 }, { easing: "quartOut" })
                .call(() => resolve())
                .start();
        });
    }

    /**
     * 淡出动画
     */
    public static fadeOut(node: Node, duration: number = 0.3, hideAfterFade: boolean = true): Promise<void> {
        return new Promise((resolve) => {
            tween(node)
                .to(duration, { opacity: 0 }, { easing: "quartIn" })
                .call(() => {
                    if (hideAfterFade) {
                        node.active = false;
                    }
                    resolve();
                })
                .start();
        });
    }

    /**
     * 获取屏幕尺寸
     */
    public static getScreenSize(): { width: number; height: number } {
        const visibleSize = view.getVisibleSize();
        return { width: visibleSize.width, height: visibleSize.height };
    }

    /**
     * 获取设计分辨率
     */
    public static getDesignResolution(): { width: number; height: number } {
        const designSize = view.getDesignResolutionSize();
        return { width: designSize.width, height: designSize.height };
    }

    /**
     * 获取屏幕适配比例
     */
    public static getScreenScale(): { x: number; y: number } {
        const screenSize = this.getScreenSize();
        const designSize = this.getDesignResolution();
        
        return {
            x: screenSize.width / designSize.width,
            y: screenSize.height / designSize.height
        };
    }

    /**
     * 检查点是否在节点内
     */
    public static isPointInNode(point: Vec3, node: Node): boolean {
        const transform = node.getComponent(UITransform);
        if (!transform) return false;

        const localPoint = transform.convertToNodeSpaceAR(point);
        const size = transform.contentSize;
        const anchorPoint = transform.anchorPoint;

        const minX = -size.width * anchorPoint.x;
        const maxX = size.width * (1 - anchorPoint.x);
        const minY = -size.height * anchorPoint.y;
        const maxY = size.height * (1 - anchorPoint.y);

        return localPoint.x >= minX && localPoint.x <= maxX &&
               localPoint.y >= minY && localPoint.y <= maxY;
    }

    /**
     * 限制节点在指定区域内
     */
    public static clampNodeInBounds(node: Node, bounds: { min: Vec3; max: Vec3 }): void {
        const pos = node.position;
        const transform = node.getComponent(UITransform);
        
        if (transform) {
            const size = transform.contentSize;
            const scale = node.scale;
            
            const halfWidth = (size.width * scale.x) / 2;
            const halfHeight = (size.height * scale.y) / 2;

            const clampedX = Math.max(bounds.min.x + halfWidth, Math.min(bounds.max.x - halfWidth, pos.x));
            const clampedY = Math.max(bounds.min.y + halfHeight, Math.min(bounds.max.y - halfHeight, pos.y));

            node.setPosition(clampedX, clampedY, pos.z);
        }
    }

    /**
     * 创建遮罩节点
     */
    public static createMask(parent: Node, color: { r: number; g: number; b: number; a: number } = { r: 0, g: 0, b: 0, a: 180 }): Node {
        const maskNode = new Node("UIMask");
        maskNode.layer = parent.layer;
        
        const transform = maskNode.addComponent(UITransform);
        const parentTransform = parent.getComponent(UITransform);
        
        if (parentTransform) {
            transform.setContentSize(parentTransform.contentSize);
        } else {
            const screenSize = this.getScreenSize();
            transform.setContentSize(screenSize.width, screenSize.height);
        }

        // 这里可以添加Sprite组件和颜色设置
        // const sprite = maskNode.addComponent(Sprite);
        // sprite.color = new Color(color.r, color.g, color.b, color.a);

        parent.insertChild(maskNode, 0); // 插入到最底层
        return maskNode;
    }

    /**
     * 数字动画计数
     */
    public static animateNumber(
        startValue: number, 
        endValue: number, 
        duration: number, 
        onUpdate: (value: number) => void,
        formatter?: (value: number) => string
    ): Promise<void> {
        return new Promise((resolve) => {
            let currentValue = startValue;
            const valueChange = endValue - startValue;
            const startTime = Date.now();

            const updateNumber = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / (duration * 1000), 1);
                
                // 使用缓动函数
                const easedProgress = 1 - Math.pow(1 - progress, 3); // cubicOut
                currentValue = startValue + valueChange * easedProgress;

                const displayValue = formatter ? formatter(currentValue) : Math.floor(currentValue).toString();
                onUpdate(Math.floor(currentValue));

                if (progress < 1) {
                    requestAnimationFrame(updateNumber);
                } else {
                    onUpdate(endValue);
                    resolve();
                }
            };

            updateNumber();
        });
    }

    /**
     * 格式化数字显示
     */
    public static formatNumber(num: number, precision: number = 0): string {
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(precision) + 'B';
        }
        if (num >= 1000000) {
            return (num / 1000000).toFixed(precision) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(precision) + 'K';
        }
        return num.toFixed(precision);
    }

    /**
     * 防抖函数
     */
    public static debounce<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
        let timeoutId: number | null = null;
        
        return (...args: Parameters<T>) => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }
            
            timeoutId = window.setTimeout(() => {
                func.apply(null, args);
                timeoutId = null;
            }, delay);
        };
    }

    /**
     * 节流函数
     */
    public static throttle<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
        let lastCallTime = 0;
        
        return (...args: Parameters<T>) => {
            const now = Date.now();
            
            if (now - lastCallTime >= delay) {
                lastCallTime = now;
                func.apply(null, args);
            }
        };
    }
}