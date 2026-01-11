import * as fgui from "fairygui-cc";
import { assetManager, ImageAsset, Rect, Size, SpriteFrame, Texture2D } from "cc";
import { GameInitializer } from "../../core/GameInitializer";
import type { Player } from "../../role/Player";
import type { PlayerMetadata } from "../../types/metadata";

type MetadataResult = PlayerMetadata | null;

export class PlayerDisplayHelper {
    private static metadataCache = new Map<string, MetadataResult>();
    private static metadataPending = new Map<string, Promise<MetadataResult>>();
    private static avatarCache = new Map<string, SpriteFrame>();
    private static avatarPending = new Map<string, Promise<SpriteFrame | null>>();

    public static async getPlayerMetadata(address: string): Promise<MetadataResult> {
        if (!address) return null;
        if (this.metadataCache.has(address)) {
            return this.metadataCache.get(address) ?? null;
        }
        const existing = this.metadataPending.get(address);
        if (existing) return existing;

        const service = GameInitializer.getInstance()?.getMetadataService();
        if (!service) return null;

        const request = service.getPlayer(address)
            .then((metadata) => {
                this.metadataCache.set(address, metadata);
                this.metadataPending.delete(address);
                return metadata;
            })
            .catch((error) => {
                console.warn(`[PlayerDisplayHelper] Failed to load metadata: ${address}`, error);
                this.metadataPending.delete(address);
                return null;
            });

        this.metadataPending.set(address, request);
        return request;
    }

    public static updatePlayerName(
        target: fgui.GTextField,
        player: Player,
        fallbackName: string,
        identityKey?: string
    ): void {
        const key = identityKey ?? player.getOwner();
        (target as any).__playerDisplayKey = key;
        target.text = fallbackName;

        void this.getPlayerMetadata(player.getOwner()).then((metadata) => {
            if (!metadata?.nickname) return;
            if ((target as any).__playerDisplayKey !== key) return;
            target.text = metadata.nickname;
            player.setName(metadata.nickname);
        });
    }

    public static updatePlayerAvatar(
        loader: fgui.GLoader,
        player: Player,
        identityKey?: string
    ): void {
        const key = identityKey ?? player.getOwner();
        (loader as any).__playerDisplayKey = key;

        void this.getPlayerMetadata(player.getOwner()).then((metadata) => {
            const avatarUrl = metadata?.avatar;
            if (!avatarUrl) return;
            if (!this.isRemoteUrl(avatarUrl)) return;

            return this.getAvatarSpriteFrame(avatarUrl).then((spriteFrame) => {
                if (!spriteFrame) return;
                if ((loader as any).__playerDisplayKey !== key) return;
                loader.texture = spriteFrame;
                loader.url = null;
            });
        });
    }

    private static isRemoteUrl(url: string): boolean {
        return /^https?:\/\//i.test(url);
    }

    private static async getAvatarSpriteFrame(avatarUrl: string): Promise<SpriteFrame | null> {
        const cached = this.avatarCache.get(avatarUrl);
        if (cached) return cached;

        const pending = this.avatarPending.get(avatarUrl);
        if (pending) return pending;

        const promise = new Promise<SpriteFrame | null>((resolve) => {
            const onLoaded = (err: Error | null, imageAsset?: ImageAsset | null) => {
                if (err || !imageAsset) {
                    if (err) {
                        console.warn(`[PlayerDisplayHelper] Failed to load avatar: ${avatarUrl}`, err);
                    }
                    resolve(null);
                    return;
                }

                const texture = new Texture2D();
                texture.image = imageAsset;

                const spriteFrame = new SpriteFrame();
                spriteFrame.texture = texture;
                spriteFrame.originalSize = new Size(texture.width, texture.height);
                spriteFrame.rect = new Rect(0, 0, texture.width, texture.height);

                resolve(spriteFrame);
            };

            const hasExtension = /\.[a-z0-9]+(\?|$)/i.test(avatarUrl);
            if (hasExtension) {
                assetManager.loadRemote<ImageAsset>(avatarUrl, (err, imageAsset) => {
                    onLoaded(err as Error | null, imageAsset);
                });
            } else {
                assetManager.loadRemote<ImageAsset>(avatarUrl, { ext: '.png' }, (err, imageAsset) => {
                    onLoaded(err as Error | null, imageAsset);
                });
            }
        }).finally(() => {
            this.avatarPending.delete(avatarUrl);
        });

        this.avatarPending.set(avatarUrl, promise);
        const spriteFrame = await promise;
        if (spriteFrame) {
            this.avatarCache.set(avatarUrl, spriteFrame);
        }
        return spriteFrame;
    }
}
