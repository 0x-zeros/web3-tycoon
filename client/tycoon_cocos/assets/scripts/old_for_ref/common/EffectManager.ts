import { _decorator, Component, Node, Prefab, view, resources, log, UITransform, Sprite, Vec3, instantiate, Color } from 'cc';
import { Tween, Easing, Group } from '@tweenjs/tween.js';
import { _ } from './lodash-compat';
import { Vector } from './math';

const { ccclass, property } = _decorator;

// TypeScript 类型定义
interface Actor {
    node: Node;
    originalScale4Effect?: number;
    walkEffect?: Tween<any>[] | null;
    hitEffectRunning?: boolean;
    getTexture?: () => any;
    getPosition?: () => Vec3;
}

interface Emitter {
    node: Node;
    originalScale4Effect?: number;
}

interface Position {
    x: number;
    y: number;
}

@ccclass('EffectManager')
export class EffectManager extends Component {
    root: Node = null!;
    tweenGroup: Group = new Group();
    actorAni: any = {};
    animatedSpriteEffect: { [key: string]: Prefab } = {};
    windowWidth: number = 0;
    bossEffect: Node = null!;

    onLoad() {
        game.effectManager = this;
        this.init();
    }

    init() {
        this.root = null!;
        this.tweenGroup = new Group();

        // actor_ani_define
        this.actorAni = {};
        this.actorAni.none = 0;
        this.actorAni.born = 1;
        this.actorAni.walk = 2;
        this.actorAni.jump = 3;
        this.actorAni.drop = 4;
        this.actorAni.fetch = 5;

        this.animatedSpriteEffect = {};
        this.windowWidth = view.getVisibleSize().width;
    }

    setEffectContainer(effectContainer: Node) {
        this.root = effectContainer;
    }

    update() {
        this.tweenGroup.update();
    }

    showBossEffect() {
        let bossEffect = this.bossEffect;
        if (bossEffect) {
            const tweenTime = 200;

            let w = bossEffect.getComponent(UITransform)?.width || 0;
            let src = { x: this.windowWidth / 2 + w, y: bossEffect.position.y }; // right
            let center = { x: 0, y: bossEffect.position.y }; // center
            let target = { x: -w, y: bossEffect.position.y }; // left

            let tweenPos0 = this.moveXY(bossEffect, src, center, tweenTime);
            let tweenPos1 = this.moveXY(bossEffect, center, target, tweenTime);
            
            tweenPos0.onStart(() => {
                bossEffect.active = true;
            });

            tweenPos1.delay(700)
                .onComplete(() => {
                    bossEffect.active = false;
                });

            tweenPos0.chain(tweenPos1);
            tweenPos0.start();
        }
    }

    showAreaEffect(effectName: string, center: Position, size: number) {
        game.effectManager.getAnimatedSpriteEffectPrefab(effectName, (prefab: Prefab) => {
            let node = game.pool.get(prefab);
            this.root.addChild(node);

            node.setScale(size, size, size);
            node.setPosition(center.x, center.y);

            // play
            let ani = node.getComponent('AnimatedSprite');
            if (ani) {
                ani.setOnFinishedCb(() => {
                    game.pool.put(node);
                });
                ani.play();
            }
        });
    }

    showMissile(effectName: string, rotation: number, start: Position, end: Position, flyTime: number) {
        game.effectManager.getAnimatedSpriteEffectPrefab(effectName, (prefab: Prefab) => {
            let node = game.pool.get(prefab);
            this.root.addChild(node);

            node.setRotationFromEuler(0, 0, rotation);
            node.setPosition(start.x, start.y, 0);

            // 飞行动画
            let coords = { x: node.position.x, y: node.position.y };
            let tween = new Tween(coords, this.tweenGroup)
                .to({ x: end.x, y: end.y }, flyTime)
                .onUpdate((obj) => {
                    node.setPosition(obj.x, obj.y, 0);
                })
                .onComplete(() => {
                    game.pool.put(node);
                })
                .start();

            // 播放动画
            let ani = node.getComponent('AnimatedSprite');
            if (ani) {
                ani.play();
            }
        });
    }

    showRowMissile(effectName: string, gridX: number, gridY: number, flyUnitTime: number) {
        if (!effectName) {
            return;
        }

        let grid = game.grid;
        if (gridX === 0) {
            let start = grid.getGridPosition(gridX, gridY);
            let end = grid.getGridPosition(grid.MAX_COLUMN - 1, gridY);
            let rotation = 90;
            let flyTime = flyUnitTime * (grid.MAX_COLUMN - 1);

            this.showMissile(effectName, rotation, start, end, flyTime);
        } else if (gridX === grid.MAX_COLUMN - 1) {
            let start = grid.getGridPosition(gridX, gridY);
            let end = grid.getGridPosition(0, gridY);
            let rotation = -90;
            let flyTime = flyUnitTime * (grid.MAX_COLUMN - 1);

            this.showMissile(effectName, rotation, start, end, flyTime);
        } else {
            let start = grid.getGridPosition(gridX, gridY);
            let end = grid.getGridPosition(grid.MAX_COLUMN - 1, gridY);
            let rotation = 90;
            let flyTime = flyUnitTime * (grid.MAX_COLUMN - 1 - gridX);

            this.showMissile(effectName, rotation, start, end, flyTime);

            end = grid.getGridPosition(0, gridY);
            rotation = -90;
            flyTime = flyUnitTime * gridX;

            this.showMissile(effectName, rotation, start, end, flyTime);
        }
    }

    showColumnMissile(effectName: string, gridX: number, gridY: number, flyUnitTime: number) {
        if (!effectName) {
            return;
        }

        let grid = game.grid;
        if (gridY === 0) {
            let start = grid.getGridPosition(gridX, gridY);
            let end = grid.getGridPosition(gridX, grid.MAX_ROW - 1);
            let rotation = 180;
            let flyTime = flyUnitTime * (grid.MAX_ROW - 1);

            this.showMissile(effectName, rotation, start, end, flyTime);
        } else if (gridY === grid.MAX_ROW - 1) {
            let start = grid.getGridPosition(gridX, gridY);
            let end = grid.getGridPosition(gridX, 0);
            let rotation = 0;
            let flyTime = flyUnitTime * (grid.MAX_ROW - 1);

            this.showMissile(effectName, rotation, start, end, flyTime);
        } else {
            let start = grid.getGridPosition(gridX, gridY);
            let end = grid.getGridPosition(gridX, grid.MAX_ROW - 1);
            let rotation = 180;
            let flyTime = flyUnitTime * (grid.MAX_ROW - 1 - gridY);

            this.showMissile(effectName, rotation, start, end, flyTime);

            end = grid.getGridPosition(gridX, 0);
            rotation = 0;
            flyTime = flyUnitTime * gridY;

            this.showMissile(effectName, rotation, start, end, flyTime);
        }
    }

    showSceneMissile(effectName: string, flyUnitTime: number) {
        let grid = game.grid;
        for (let x = 0; x < grid.MAX_COLUMN; x++) {
            this.showColumnMissile(effectName, x, grid.MAX_ROW - 1, flyUnitTime);
        }
    }

    getAnimatedSpriteEffectPrefab(effectName: string, cb: (prefab: Prefab) => void) {
        let url = `prefabs/animatedSprite/${effectName}`;

        let prefab = this.animatedSpriteEffect[effectName];
        if (prefab) {
            cb(prefab);
        } else {
            resources.load(url, Prefab, (err, prefab) => {
                if (err) {
                    console.log(`createAnimatedSprite ${url} loadRes err`);
                    console.log(err);
                } else {
                    this.animatedSpriteEffect[effectName] = prefab as Prefab;
                    cb(prefab as Prefab);
                }
            });
        }
    }

    // 角色动画效果
    walkEffect(actor: Actor, target: Position) {
        const walkTime = 300;
        let scaleAmplitude = Math.random() * 0.05 + 0.05; // 振幅 [0.05 - 0.1)
        let tweenScale = this.scaleBounceSingle(
            actor, walkTime, 0.2, scaleAmplitude, 
            Easing.Quartic.Out, Easing.Quintic.Out
        );

        // 位移
        let tweenPos = this.moveY(actor, actor.node.position, target, walkTime);

        // 随机延迟
        let delayTime = _.random(0, 200);

        tweenScale.delay(delayTime).start();

        tweenPos.onComplete(() => {
            actor.walkEffect = null;
        }).delay(delayTime).start();

        actor.walkEffect = [tweenScale, tweenPos];
    }

    jumpEffect(actor: Actor, target: Position) {
        // 停止移动效果 (跳跃怪的逻辑处理是这样: 先移动了一格, 再往前跳一格; 但是表现效果要处理为一下子跳2格)
        if (actor.walkEffect) {
            actor.walkEffect.forEach((v) => {
                v.stop();
            });
            actor.walkEffect = null;
        }

        const walkTime = 300;

        // 缩放
        let scaleAmplitude = Math.random() * 0.2 + 0.1; // 振幅 [0.1 - 0.3)
        let tweenScale = this.scaleBounceSingle(
            actor, walkTime, 0.2, scaleAmplitude, 
            Easing.Quartic.Out, Easing.Quintic.Out
        );

        // 位移 - 跳跃抛物线效果
        let actorPixel = game.grid.UNIT_ACTOR_PIXEL;
        let amplitude = _.random(
            Math.floor(actorPixel * 0.1), 
            Math.floor(actorPixel * 0.3)
        ); // 振幅

        let actorPosition = actor.node.position;
        let originalX = actorPosition.x;
        let originalY = actorPosition.y;
        let deltaY = target.y - actorPosition.y;
        
        let tweenPos = new Tween({ k: 0 }, this.tweenGroup)
            .to({ k: 1 }, walkTime)
            .onUpdate((obj) => {
                actor.node.setPosition(
                    originalX,
                    originalY + deltaY * obj.k,
                    actorPosition.z
                );

                // 向左的sin函数, 模拟跳的效果, 向左的幅度(高度)由一个随机值控制
                let jumpValue = Math.sin(obj.k * Math.PI) * amplitude;
                const currentPos = actor.node.position;
                actor.node.setPosition(
                    originalX - jumpValue, 
                    currentPos.y, 
                    currentPos.z
                );
            });

        // 随机延迟
        let delayTime = _.random(0, 200);
        _.delay(() => {
            tweenScale.start();
            tweenPos.start();
        }, delayTime);
    }

    bornEffect(actor: Actor, target: Position) {
        const walkTime = 800;
        const delayTimeSeg = 80;

        // 分段来跳
        let seg = 4;
        const walkTimeSeg = walkTime / seg;
        let tmp = _.range(1, seg + 1);
        let list = tmp.map((num) => {
            let k = num * (1 / seg);
            return Vector.lerp(actor.node.position, target, k);
        });

        // chain
        let tweenScaleNext: Tween<any> | null = null;
        let tweenPosNext: Tween<any> | null = null;

        let tweenScale0: Tween<any> | null = null;
        let tweenPos0: Tween<any> | null = null;
        let scaleAmplitude = Math.random() * 0.1 + 0.1; // 振幅 [0.1 - 0.2)

        for (let i = list.length - 1; i >= 0; i--) {
            let v = list[i];

            if (i === 0) {
                tweenScale0 = this.scaleBounceSingle(
                    actor, walkTimeSeg, 0.2, scaleAmplitude, 
                    Easing.Quartic.Out, Easing.Quintic.Out
                );

                tweenPos0 = this.moveY(actor, actor.node.position, v, walkTimeSeg);
            } else {
                tweenScale0 = this.scaleBounceSingle(
                    actor, walkTimeSeg, 0.2, scaleAmplitude, 
                    Easing.Quartic.Out, Easing.Quintic.Out
                );
                tweenScale0.delay(delayTimeSeg);

                tweenPos0 = this.moveY(actor, list[i - 1], v, walkTimeSeg);
                tweenPos0.delay(delayTimeSeg);
            }

            if (tweenScaleNext) {
                tweenScale0.chain(tweenScaleNext);
            }
            if (tweenPosNext) {
                tweenPos0.chain(tweenPosNext);
            }

            tweenScaleNext = tweenScale0;
            tweenPosNext = tweenPos0;
        }

        if (tweenScale0) {
            tweenScale0.start();
        }
        if (tweenPos0) {
            tweenPos0.start();
        }
    }

    hitEffect(actor: Actor) {
        const tweenTime = 80; // 必须要比emitter.missile_delay 小

        // 缩放
        let scaleAmplitude = -(Math.random() * 0.1 + 0.1); // 振幅 [0.9 - 0.8)
        let tweenScale = this.scaleBounceSingle(actor, tweenTime, 0.5, scaleAmplitude);

        tweenScale.onComplete(() => {
            actor.hitEffectRunning = false;
        }).onStart(() => {
            actor.hitEffectRunning = true;
        }).start();
    }

    emitterFireEffect(emitter: Emitter) {
        const tweenTime = 100; // 必须要比emitter.missile_delay 小

        // 缩放
        let scaleAmplitude = Math.random() * 0.1 + 0.1; // 振幅 [1.1 - 1.2)
        let tweenScale = this.scaleBounceSingle(
            emitter, tweenTime, 0.5, scaleAmplitude, 
            Easing.Elastic.In, Easing.Elastic.Out
        );
        tweenScale.start();
    }

    dropEffect(actor: Actor, target: Position, onFinishedCB?: () => void) {
        const tweenTime = 100; // 必须要比emitter.missile_delay 小

        // 缩放 - 变小
        let tweenScale = this.scaleXY(actor, tweenTime, 0.01, 1);
        let tweenPos = this.moveXY(actor.node, actor.node.position, target, tweenTime);
        
        tweenPos.onComplete(() => {
            if (onFinishedCB) {
                onFinishedCB();
            }
        });

        let delayTime = 500; // actor on dead ani time
        _.delay(() => {
            tweenScale.start();
            tweenPos.start();
        }, delayTime);
    }

    createTreasureBox(actor: Actor, target: Position) {
        // actor sprite
        let texture = actor.getTexture?.();
        if (texture) {
            let node = new Node();
            let pos = actor.getPosition?.();
            if (pos) {
                node.setPosition(pos);
            }
            this.root.addChild(node);

            let actorSprite = node.addComponent(Sprite);
            actorSprite.spriteFrame = texture;

            this.fetchItemFlyEffect(actorSprite, target);
        }
    }

    fetchItemFlyEffect(actor: any, target: Position) {
        const flyTime = 400;

        // 缩放 - 变小
        let tweenScale = this.scaleXY(actor, flyTime, 1, 0.6);
        let tweenPos = this.moveXY(actor.node, actor.node.position, target, flyTime);
        
        tweenPos.onComplete(() => {
            actor.node.destroy();
        });

        tweenScale.start();
        tweenPos.start();
    }

    flauntEffect(node: Node, originalScale4Effect?: number, delayTime?: number) {
        let obj = { node: node, originalScale4Effect: 0 };
        obj.originalScale4Effect = originalScale4Effect ?? node.scale.x;
        
        let tweenScale = this.scaleBounceSingle(obj, 500, 0.4, 0.05);
        delayTime = delayTime ?? 2 * 1000;
        
        tweenScale.delay(delayTime)
            .repeat(Infinity);

        tweenScale.start();
    }

    // 辅助方法
    scaleXY(actor: Actor, segTime: number, fromScale: number, toScale: number): Tween<any> {
        let original = {
            scaleX: actor.originalScale4Effect ?? actor.node.scale.x,
            scaleY: actor.originalScale4Effect ?? actor.node.scale.y
        };

        let tweenScale = new Tween({ scaleX: fromScale, scaleY: fromScale }, this.tweenGroup)
            .to({ scaleX: toScale, scaleY: toScale }, segTime)
            .onUpdate((obj) => {
                actor.node.setScale(
                    original.scaleX * obj.scaleX,
                    original.scaleY * obj.scaleY,
                    1
                );
            });

        return tweenScale;
    }

    scaleBounceSingle(actor: Actor, tweenTime: number, seg1Rate?: number, amplitude?: number, seg1Func?: any, seg2Func?: any): Tween<any> {
        let original = {
            scaleX: actor.originalScale4Effect ?? actor.node.scale.x,
            scaleY: actor.originalScale4Effect ?? actor.node.scale.y
        };

        seg1Rate = seg1Rate ?? 0.5;
        amplitude = amplitude ?? (Math.random() * 0.1 + 0.1); // 振幅 [0.1 - 0.2)
        seg1Func = seg1Func ?? Easing.Linear.None;
        seg2Func = seg2Func ?? Easing.Linear.None;

        let tweenScale = new Tween({ k: 0 }, this.tweenGroup)
            .to({ k: 1 }, tweenTime)
            .onUpdate((obj) => {
                let scale = 1;
                if (obj.k <= seg1Rate) {
                    // 前半段
                    let k = obj.k / seg1Rate;
                    scale = seg1Func(k) * amplitude + 1;
                } else {
                    // 后半段
                    let k = (obj.k - seg1Rate) / (1 - seg1Rate);
                    scale = (1 - seg2Func(k)) * amplitude + 1;
                }

                actor.node.setScale(
                    original.scaleX * scale,
                    original.scaleY * scale,
                    1
                );
            });

        return tweenScale;
    }

    moveY(actor: Actor, src: Position, target: Position, segTime: number): Tween<any> {
        let coords = { y: src.y };
        let tweenPos = new Tween(coords, this.tweenGroup)
            .to({ y: target.y }, segTime)
            .onUpdate((obj) => {
                const currentPos = actor.node.position;
                actor.node.setPosition(currentPos.x, obj.y, currentPos.z);
            });

        return tweenPos;
    }

    moveXY(node: Node, src: Position, target: Position, segTime: number): Tween<any> {
        let coords = { x: src.x, y: src.y };
        let tweenPos = new Tween(coords, this.tweenGroup)
            .to({ x: target.x, y: target.y }, segTime)
            .onUpdate((obj) => {
                node.setPosition(obj.x, obj.y, 0);
            });

        return tweenPos;
    }

    alpha(sprite: any, src: number, target: number, duration: number): Tween<any> {
        let tween = new Tween({ alpha: src }, this.tweenGroup)
            .to({ alpha: target }, duration)
            .onUpdate((obj) => {
                if (sprite.color) {
                    const newColor = sprite.color.clone();
                    newColor.a = obj.alpha * 255;
                    sprite.color = newColor;
                }
            });

        return tween;
    }

    waitTween(waitTime: number): Tween<any> {
        let tween = new Tween({ k: 0 }, this.tweenGroup)
            .to({ k: 1 }, waitTime);

        return tween;
    }
}

export default EffectManager;