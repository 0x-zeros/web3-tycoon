/**
 * 玩家显示辅助类
 *
 * 用于更新 UI 上的玩家名称和头像
 * 从链上 PlayerProfile 获取数据
 */

import * as fgui from "fairygui-cc";
import { ProfileService } from "../../sui/services/ProfileService";
import type { Player } from "../../role/Player";
import type { PlayerProfile } from "../../sui/types/profile";

type ProfileResult = PlayerProfile | null;

/**
 * 地址格式化工具
 */
function shortenAddress(address: string, prefixLen: number = 6, suffixLen: number = 4): string {
    if (!address) return '';
    if (address.length <= prefixLen + suffixLen + 2) return address;
    return `${address.slice(0, prefixLen)}...${address.slice(-suffixLen)}`;
}

export class PlayerDisplayHelper {
    private static profileCache = new Map<string, ProfileResult>();
    private static profilePending = new Map<string, Promise<ProfileResult>>();

    /**
     * 获取玩家档案
     * @param address 钱包地址
     * @returns PlayerProfile 或 null
     */
    public static async getPlayerProfile(address: string): Promise<ProfileResult> {
        if (!address) return null;

        // 检查本地缓存
        if (this.profileCache.has(address)) {
            return this.profileCache.get(address) ?? null;
        }

        // 检查是否正在请求中
        const existing = this.profilePending.get(address);
        if (existing) return existing;

        // 从 ProfileService 获取
        const request = ProfileService.instance.getPlayerProfile(address)
            .then((profile) => {
                this.profileCache.set(address, profile);
                this.profilePending.delete(address);
                return profile;
            })
            .catch((error) => {
                console.warn(`[PlayerDisplayHelper] Failed to load profile: ${address}`, error);
                this.profilePending.delete(address);
                return null;
            });

        this.profilePending.set(address, request);
        return request;
    }

    /**
     * 更新玩家名称显示
     *
     * 显示格式：
     * - 有昵称时: "{nickname} ({shortAddress})"
     * - 无昵称时: "{shortAddress}"
     *
     * @param target 文本组件
     * @param player 玩家对象
     * @param fallbackName 默认显示名称（通常是短地址）
     * @param identityKey 标识键（防止异步更新冲突）
     */
    public static updatePlayerName(
        target: fgui.GTextField,
        player: Player,
        fallbackName: string,
        identityKey?: string
    ): void {
        const address = player.getOwner();
        const key = identityKey ?? address;
        (target as any).__playerDisplayKey = key;

        // 先显示短地址
        const shortAddr = shortenAddress(address);
        target.text = fallbackName || shortAddr;

        // 异步加载档案
        void this.getPlayerProfile(address).then((profile) => {
            // 检查是否被覆盖
            if ((target as any).__playerDisplayKey !== key) return;

            if (profile?.name) {
                // 显示格式: "昵称 (0x1234...5678)"
                target.text = `${profile.name} (${shortAddr})`;
                player.setName(profile.name);
            } else {
                // 无昵称时仅显示短地址
                target.text = shortAddr;
            }
        });
    }

    /**
     * 更新玩家头像显示
     *
     * 使用头像索引从本地资源加载
     *
     * @param loader 图片加载器
     * @param player 玩家对象
     * @param identityKey 标识键
     */
    public static updatePlayerAvatar(
        loader: fgui.GLoader,
        player: Player,
        identityKey?: string
    ): void {
        const address = player.getOwner();
        const key = identityKey ?? address;
        (loader as any).__playerDisplayKey = key;

        void this.getPlayerProfile(address).then((profile) => {
            // 检查是否被覆盖
            if ((loader as any).__playerDisplayKey !== key) return;

            if (profile) {
                // 使用头像索引加载本地资源
                // TODO: 实现头像索引到本地资源的映射
                const avatarIndex = profile.avatar;
                console.log(`[PlayerDisplayHelper] Player ${address} has avatar index: ${avatarIndex}`);
                // loader.url = `ui://Common/avatar_${avatarIndex}`;
            }
        });
    }

    /**
     * 获取玩家显示名称（同步版本）
     *
     * 如果缓存中有数据则返回昵称，否则返回短地址
     *
     * @param address 钱包地址
     * @returns 显示名称
     */
    public static getDisplayName(address: string): string {
        if (!address) return '';

        const shortAddr = shortenAddress(address);
        const cached = this.profileCache.get(address);

        if (cached?.name) {
            return `${cached.name} (${shortAddr})`;
        }

        return shortAddr;
    }

    /**
     * 清除指定地址的缓存
     */
    public static clearCache(address: string): void {
        this.profileCache.delete(address);
        this.profilePending.delete(address);
    }

    /**
     * 清除所有缓存
     */
    public static clearAllCache(): void {
        this.profileCache.clear();
        this.profilePending.clear();
    }
}
