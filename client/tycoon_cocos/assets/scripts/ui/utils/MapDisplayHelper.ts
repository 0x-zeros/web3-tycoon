/**
 * 地图显示辅助类
 * 用于异步加载 MapProfile 并更新地图名称显示
 */
import * as fgui from "fairygui-cc";
import { ProfileService } from "../../sui/services/ProfileService";
import type { MapProfile } from "../../sui/types/profile";

type ProfileResult = MapProfile | null;

function shortenAddress(address: string, prefixLen = 6, suffixLen = 4): string {
    if (!address) return '';
    if (address.length <= prefixLen + suffixLen + 2) return address;
    return `${address.slice(0, prefixLen)}...${address.slice(-suffixLen)}`;
}

export class MapDisplayHelper {
    private static profileCache = new Map<string, ProfileResult>();
    private static profilePending = new Map<string, Promise<ProfileResult>>();

    /**
     * 获取地图档案
     */
    public static async getMapProfile(mapId: string): Promise<ProfileResult> {
        if (!mapId) return null;

        if (this.profileCache.has(mapId)) {
            return this.profileCache.get(mapId) ?? null;
        }

        const existing = this.profilePending.get(mapId);
        if (existing) return existing;

        const request = ProfileService.instance.getMapProfile(mapId)
            .then((profile) => {
                this.profileCache.set(mapId, profile);
                this.profilePending.delete(mapId);
                return profile;
            })
            .catch((error) => {
                console.warn(`[MapDisplayHelper] Failed to load profile: ${mapId}`, error);
                this.profilePending.delete(mapId);
                return null;
            });

        this.profilePending.set(mapId, request);
        return request;
    }

    /**
     * 更新地图名称显示
     * 格式：有名称时 "地图名称 (0x1234...5678)"，无名称时 "0x1234...5678"
     */
    public static updateMapName(
        target: fgui.GTextField,
        mapId: string,
        identityKey?: string
    ): void {
        const key = identityKey ?? mapId;
        (target as any).__mapDisplayKey = key;

        const shortId = shortenAddress(mapId);
        target.text = shortId;

        void this.getMapProfile(mapId).then((profile) => {
            if ((target as any).__mapDisplayKey !== key) return;

            if (profile?.name) {
                target.text = `${profile.name} (${shortId})`;
            } else {
                target.text = shortId;
            }
        });
    }

    /**
     * 获取地图显示名称（同步版本，从缓存读取）
     */
    public static getDisplayName(mapId: string): string {
        if (!mapId) return '';

        const shortId = shortenAddress(mapId);
        const cached = this.profileCache.get(mapId);

        if (cached?.name) {
            return `${cached.name} (${shortId})`;
        }

        // 触发后台加载
        void this.getMapProfile(mapId);
        return shortId;
    }

    /**
     * 预加载多个地图的 Profile
     */
    public static async preload(mapIds: string[]): Promise<void> {
        const promises = mapIds
            .filter(id => id && !this.profileCache.has(id))
            .map(id => this.getMapProfile(id));
        await Promise.all(promises);
    }

    public static clearCache(mapId: string): void {
        this.profileCache.delete(mapId);
        this.profilePending.delete(mapId);
    }

    public static clearAllCache(): void {
        this.profileCache.clear();
        this.profilePending.clear();
    }
}
