/**
 * 游戏显示辅助类
 * 用于异步加载 GameProfile 并更新游戏名称显示
 */
import * as fgui from "fairygui-cc";
import { ProfileService } from "../../sui/services/ProfileService";
import type { GameProfile } from "../../sui/types/profile";

type ProfileResult = GameProfile | null;

function shortenAddress(address: string, prefixLen = 6, suffixLen = 4): string {
    if (!address) return '';
    if (address.length <= prefixLen + suffixLen + 2) return address;
    return `${address.slice(0, prefixLen)}...${address.slice(-suffixLen)}`;
}

export class GameDisplayHelper {
    private static profileCache = new Map<string, ProfileResult>();
    private static profilePending = new Map<string, Promise<ProfileResult>>();

    /**
     * 获取游戏档案
     */
    public static async getGameProfile(gameId: string): Promise<ProfileResult> {
        if (!gameId) return null;

        if (this.profileCache.has(gameId)) {
            return this.profileCache.get(gameId) ?? null;
        }

        const existing = this.profilePending.get(gameId);
        if (existing) return existing;

        const request = ProfileService.instance.getGameProfile(gameId)
            .then((profile) => {
                this.profileCache.set(gameId, profile);
                this.profilePending.delete(gameId);
                return profile;
            })
            .catch((error) => {
                console.warn(`[GameDisplayHelper] Failed to load profile: ${gameId}`, error);
                this.profilePending.delete(gameId);
                return null;
            });

        this.profilePending.set(gameId, request);
        return request;
    }

    /**
     * 更新游戏名称显示
     * 格式：有名称时 "游戏名称 (0x1234...5678)"，无名称时 "0x1234...5678"
     */
    public static updateGameName(
        target: fgui.GTextField,
        gameId: string,
        identityKey?: string
    ): void {
        const key = identityKey ?? gameId;
        (target as any).__gameDisplayKey = key;

        const shortId = shortenAddress(gameId);
        target.text = shortId;

        void this.getGameProfile(gameId).then((profile) => {
            if ((target as any).__gameDisplayKey !== key) return;

            if (profile?.name) {
                target.text = `${profile.name} (${shortId})`;
            } else {
                target.text = shortId;
            }
        });
    }

    /**
     * 获取游戏显示名称（同步版本，从缓存读取）
     */
    public static getDisplayName(gameId: string): string {
        if (!gameId) return '';

        const shortId = shortenAddress(gameId);
        const cached = this.profileCache.get(gameId);

        if (cached?.name) {
            return `${cached.name} (${shortId})`;
        }

        // 触发后台加载
        void this.getGameProfile(gameId);
        return shortId;
    }

    public static clearCache(gameId: string): void {
        this.profileCache.delete(gameId);
        this.profilePending.delete(gameId);
    }

    public static clearAllCache(): void {
        this.profileCache.clear();
        this.profilePending.clear();
    }
}
