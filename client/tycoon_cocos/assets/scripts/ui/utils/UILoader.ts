import { warn, error } from "cc";
import { PackageLoadResult, FGUIResourceType } from "../core/UITypes";
import * as fgui from "fairygui-cc";

/**
 * 资源加载进度回调类型
 */
export type LoadProgressCallback = (finished: number, total: number, packageName: string) => void;

/**
 * 批量加载结果接口
 */
export interface BatchLoadResult {
    /** 成功加载的包 */
    loaded: string[];
    /** 加载失败的包 */
    failed: { [packageName: string]: string };
    /** 加载成功数量 */
    successCount: number;
    /** 加载失败数量 */
    failureCount: number;
}

/**
 * FairyGUI资源加载器 - 专门用于FairyGUI资源加载
 */
export class UILoader {
    /** 已加载的包列表 */
    private static _loadedPackages: Set<string> = new Set();
    /** 正在加载的包列表 */
    private static _loadingPackages: Map<string, Promise<PackageLoadResult>> = new Map();
    /** 是否启用调试模式 */
    private static _debug: boolean = false;

    /**
     * 设置调试模式
     */
    public static setDebug(debug: boolean): void {
        this._debug = debug;
    }

    /**
     * 加载单个UI包
     */
    public static async loadPackage(packageName: string): Promise<PackageLoadResult> {
        // 检查是否已加载
        if (this._loadedPackages.has(packageName)) {
            if (this._debug) {
                console.log(`[UILoader] Package ${packageName} already loaded`);
            }
            return { success: true, packageName };
        }

        // 检查是否正在加载
        const loadingPromise = this._loadingPackages.get(packageName);
        if (loadingPromise) {
            if (this._debug) {
                console.log(`[UILoader] Package ${packageName} is loading, waiting...`);
            }
            return loadingPromise;
        }

        // 创建加载Promise
        const loadPromise = this._doLoadPackage(packageName);
        this._loadingPackages.set(packageName, loadPromise);

        try {
            const result = await loadPromise;
            this._loadingPackages.delete(packageName);
            
            if (result.success) {
                this._loadedPackages.add(packageName);
            }

            return result;

        } catch (e) {
            this._loadingPackages.delete(packageName);
            throw e;
        }
    }

    /**
     * 批量加载UI包
     */
    public static async loadPackageBatch(
        packageNames: string[], 
        onProgress?: LoadProgressCallback
    ): Promise<BatchLoadResult> {
        const result: BatchLoadResult = {
            loaded: [],
            failed: {},
            successCount: 0,
            failureCount: 0
        };

        const total = packageNames.length;
        let finished = 0;

        // 并行加载所有包
        const loadPromises = packageNames.map(async (packageName) => {
            try {
                const loadResult = await this.loadPackage(packageName);
                
                if (loadResult.success) {
                    result.loaded.push(packageName);
                    result.successCount++;
                } else {
                    result.failed[packageName] = loadResult.error || "Unknown error";
                    result.failureCount++;
                }

            } catch (e) {
                result.failed[packageName] = e instanceof Error ? e.message : String(e);
                result.failureCount++;
            } finally {
                finished++;
                onProgress?.(finished, total, packageName);
            }
        });

        await Promise.all(loadPromises);

        if (this._debug) {
            console.log(`[UILoader] Batch load completed: ${result.successCount} success, ${result.failureCount} failed`);
        }

        return result;
    }

    /**
     * 预加载UI包（静默加载，不抛出错误）
     */
    public static async preloadPackages(packageNames: string[], onProgress?: LoadProgressCallback): Promise<void> {
        const total = packageNames.length;
        let finished = 0;

        const promises = packageNames.map(async (packageName) => {
            try {
                await this.loadPackage(packageName);
            } catch (e) {
                if (this._debug) {
                    warn(`[UILoader] Failed to preload package: ${packageName}`, e);
                }
            } finally {
                finished++;
                onProgress?.(finished, total, packageName);
            }
        });

        await Promise.all(promises);

        if (this._debug) {
            console.log(`[UILoader] Preloaded ${finished} packages`);
        }
    }

    /**
     * 卸载UI包
     */
    public static unloadPackage(packageName: string): boolean {
        if (!this._loadedPackages.has(packageName)) {
            warn(`[UILoader] Package ${packageName} not loaded`);
            return false;
        }

        try {
            // 使用FairyGUI卸载包
            fgui.UIPackage.removePackage(packageName);
            
            this._loadedPackages.delete(packageName);

            if (this._debug) {
                console.log(`[UILoader] Package ${packageName} unloaded`);
            }

            return true;

        } catch (e) {
            error(`[UILoader] Error unloading package ${packageName}:`, e);
            return false;
        }
    }

    /**
     * 卸载所有UI包
     */
    public static unloadAllPackages(): void {
        const packageNames = Array.from(this._loadedPackages);
        
        for (const packageName of packageNames) {
            this.unloadPackage(packageName);
        }

        if (this._debug) {
            console.log(`[UILoader] Unloaded ${packageNames.length} packages`);
        }
    }

    /**
     * 检查包是否已加载
     */
    public static isPackageLoaded(packageName: string): boolean {
        return this._loadedPackages.has(packageName);
    }

    /**
     * 检查包是否正在加载
     */
    public static isPackageLoading(packageName: string): boolean {
        return this._loadingPackages.has(packageName);
    }

    /**
     * 获取已加载的包列表
     */
    public static getLoadedPackages(): string[] {
        return Array.from(this._loadedPackages);
    }

    /**
     * 获取正在加载的包列表
     */
    public static getLoadingPackages(): string[] {
        return Array.from(this._loadingPackages.keys());
    }

    /**
     * 创建UI对象（便捷方法）
     */
    public static createObject(packageName: string, componentName: string): fgui.GObject | null {
        if (!this.isPackageLoaded(packageName)) {
            error(`[UILoader] Package ${packageName} not loaded, cannot create object ${componentName}`);
            return null;
        }

        try {
            return fgui.UIPackage.createObject(packageName, componentName);
        } catch (e) {
            error(`[UILoader] Error creating object ${packageName}.${componentName}:`, e);
            return null;
        }
    }

    /**
     * 异步创建UI对象
     */
    public static async createObjectAsync(
        packageName: string, 
        componentName: string
    ): Promise<fgui.GObject | null> {
        // 确保包已加载
        if (!this.isPackageLoaded(packageName)) {
            const loadResult = await this.loadPackage(packageName);
            if (!loadResult.success) {
                return null;
            }
        }

        return this.createObject(packageName, componentName);
    }

    /**
     * 获取包中的资源
     */
    public static getPackageItem(packageName: string, itemName: string): fgui.PackageItem | null {
        if (!this.isPackageLoaded(packageName)) {
            warn(`[UILoader] Package ${packageName} not loaded`);
            return null;
        }

        try {
            const pkg = fgui.UIPackage.getByName(packageName);
            return pkg ? pkg.getItem(itemName) : null;
        } catch (e) {
            error(`[UILoader] Error getting package item ${packageName}.${itemName}:`, e);
            return null;
        }
    }

    /**
     * 检查资源是否存在
     */
    public static hasResource(packageName: string, resourceName: string): boolean {
        return this.getPackageItem(packageName, resourceName) !== null;
    }

    /**
     * 获取加载统计信息
     */
    public static getStats(): {
        loadedCount: number;
        loadingCount: number; 
        loadedPackages: string[];
        loadingPackages: string[];
    } {
        return {
            loadedCount: this._loadedPackages.size,
            loadingCount: this._loadingPackages.size,
            loadedPackages: Array.from(this._loadedPackages),
            loadingPackages: Array.from(this._loadingPackages.keys())
        };
    }

    // ================== 私有方法 ==================

    /**
     * 执行包加载
     */
    private static _doLoadPackage(packageName: string): Promise<PackageLoadResult> {
        return new Promise((resolve) => {
            if (this._debug) {
                console.log(`[UILoader] Loading package: ${packageName}`);
            }

            fgui.UIPackage.loadPackage(packageName, (err: any) => {
                if (err) {
                    const errorMsg = `Failed to load package ${packageName}: ${err}`;
                    error(`[UILoader] ${errorMsg}`);
                    resolve({ success: false, packageName, error: errorMsg });
                } else {
                    if (this._debug) {
                        console.log(`[UILoader] Package loaded successfully: ${packageName}`);
                    }
                    resolve({ success: true, packageName });
                }
            });
        });
    }

    /**
     * 清理加载器状态（用于测试或重置）
     */
    public static _reset(): void {
        this._loadedPackages.clear();
        this._loadingPackages.clear();
        this._debug = false;
    }
}