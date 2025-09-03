import { _ } from '../../common/lodash-compat';
import { log } from 'cc';
import { ActorData, SpawnActorData } from '../../../data/types';

interface SpawnData {
    round: number;
    elite_sure: ActorData[] | null;
    elite: ActorData[];
    monster: ActorData[];
    item: ActorData[];
    skill: ActorData[];
    monsterMin: number;
    monsterMax: number;
}

// SpawnActorData 已从 types.ts 导入

interface ActorManagerInterface {
    spawnOnRound(roundNum: number, max_column: number, gridY: number): void;
    getActorTmp(actor_id: number): ActorData | undefined;
}

// 全局类型声明已在 Game.ts 中定义

/**
 * 角色管理器类
 * 负责管理游戏中的敌人、Boss、道具和技能的生成
 */
class ActorManager implements ActorManagerInterface {
    private actors: { [key: number]: ActorData } = {};
    private boss: ActorData | null = null;
    private spawns: SpawnData[] = [];
    private BOSS_ROUND: number = 20;

    constructor() {
        // 构造函数中不做任何初始化，等待外部调用 init
    }

    /**
     * 获取指定回合的生成数据
     */
    private getSpawnData(roundNum: number): SpawnData {
        for (let i = this.spawns.length - 1; i >= 0; i -= 1) {
            const data = this.spawns[i];
            if (data.round <= roundNum) {
                return data;
            }
        }
        return this.spawns[this.spawns.length - 1];
    }

    /**
     * 在指定回合生成角色
     */
    public spawnOnRound(roundNum: number, max_column: number, gridY: number): void {
        log('in spawnOnRound: ', roundNum);

        if (roundNum < 1) return;

        const mod = roundNum % this.BOSS_ROUND;
        
        if (roundNum >= this.BOSS_ROUND && mod === 0) {
            // 生成Boss
            const actorTmp = this.boss;
            if (actorTmp) {
                const gridX = _.random(0, max_column - (actorTmp.size || 1));
                game.grid.spawnActor(actorTmp, gridX, gridY, roundNum);
            }
        }
        else if (roundNum > this.BOSS_ROUND && mod === 1) {
            // Boss占了两行，跳过
        }
        else {
            const spawnData = this.getSpawnData(roundNum);
            log(spawnData);

            const idxs = _.range(max_column);
            const randomGridX = (): number => {
                if (idxs.length < 1) return -1;

                const num = _.random(0, idxs.length - 1);
                const idx = idxs[num];
                idxs.splice(num, 1);
                return idx;
            };

            // 生成道具
            if (spawnData.item && spawnData.item.length > 0) {
                const num = _.random(0, spawnData.item.length - 1);
                const actorTmp = spawnData.item[num];
                const rate = _.random(1, 100);
                
                if (actorTmp.new_round_spawn_percentage && actorTmp.new_round_spawn_percentage >= rate) {
                    const gridX = randomGridX();
                    if (gridX !== -1) {
                        game.grid.spawnActor(actorTmp, gridX, gridY, roundNum);
                    }
                }
            }

            // 生成技能道具
            if (spawnData.skill && spawnData.skill.length > 0) {
                const num = _.random(0, spawnData.skill.length - 1);
                const actorTmp = spawnData.skill[num];
                const rate = _.random(1, 100);
                
                if (actorTmp.new_round_spawn_percentage && actorTmp.new_round_spawn_percentage >= rate) {
                    const gridX = randomGridX();
                    if (gridX !== -1) {
                        game.grid.spawnActor(actorTmp, gridX, gridY, roundNum);
                    }
                }
            }

            // 生成精英怪物（确定出现）
            if (spawnData.elite_sure && spawnData.elite_sure.length > 0) {
                const num = _.random(0, spawnData.elite_sure.length - 1);
                const actorTmp = spawnData.elite_sure[num];
                const gridX = randomGridX();
                if (gridX !== -1) {
                    game.grid.spawnActor(actorTmp, gridX, gridY, roundNum);
                }
            }
            // 生成精英怪物（概率出现）
            else if (spawnData.elite) {
                for (let i = 0; i < spawnData.elite.length; i += 1) {
                    const actorTmp = spawnData.elite[i];
                    const rate = _.random(1, 100);
                    
                    if (actorTmp.new_round_spawn_percentage && actorTmp.new_round_spawn_percentage >= rate) {
                        const gridX = randomGridX();
                        if (gridX !== -1) {
                            game.grid.spawnActor(actorTmp, gridX, gridY, roundNum);
                        }
                        break; // 一层最多出现一只特殊怪物
                    }
                }
            }

            // 生成普通怪物
            if (spawnData.monster && spawnData.monster.length > 0) {
                const count = _.random(spawnData.monsterMin, spawnData.monsterMax);
                
                for (let i = 0; i < count; i += 1) {
                    const actorTmp = spawnData.monster[0];
                    const gridX = randomGridX();
                    
                    if (gridX !== -1) {
                        game.grid.spawnActor(actorTmp, gridX, gridY, roundNum);
                    } else {
                        break; // 满了
                    }
                }
            }
        }
    }

    /**
     * 获取角色模板数据
     */
    public getActorTmp(actor_id: number): ActorData | undefined {
        return this.actors[actor_id];
    }

    /**
     * 初始化角色数据
     */
    private initActors(): void {
        const list = game.jsonData.actor;
        
        _.each(list, (a: ActorData) => {
            this.actors[a.actor_id] = a;

            if (a.type === 'boss') {
                this.boss = a;
            }
        });

        // 检查掉落物品的角色ID是否存在
        _.each(list, (a: ActorData) => {
            if (a.drop && a.drop.actor) {
                _.each(a.drop.actor, (actor_id: number) => {
                    if (!this.actors[actor_id]) {
                        log('drop.actor id not found:');
                        log(a);
                    }
                });
            }
        });
    }

    /**
     * 初始化生成配置
     */
    private initSpawn(): void {
        this.BOSS_ROUND = game.config.actor.boss_roundNum;

        const list = game.jsonData.spawnactor;

        const makeCopy = (data: Partial<SpawnData>): SpawnData => {
            const newData = _.clone(data) as SpawnData;
            newData.elite_sure = null;
            newData.elite = _.clone(data.elite || []);
            newData.monster = _.clone(data.monster || []);
            newData.item = _.clone(data.item || []);
            newData.skill = _.clone(data.skill || []);
            return newData;
        };

        let prevSpawn: Partial<SpawnData> = {
            elite: [],
            monster: [],
            item: [],
            skill: []
        };

        for (let r = 0; r < list.length; r += 1) {
            const spawn = makeCopy(prevSpawn);
            const data = list[r];

            spawn.round = data.round_num;

            // 处理怪物
            if (data.monster !== 0) {
                const actorTmp = this.actors[data.monster];
                if (actorTmp) {
                    if (actorTmp.type === 'elite') {
                        spawn.elite.push(actorTmp);
                    } else {
                        spawn.monster.push(actorTmp);
                    }
                    actorTmp.new_round_spawn_percentage = data.monster_percentage;
                }
            }

            // 处理精英怪物
            if (data.spawn_elite === 1) {
                if (data.spawn_elite_id === 0) {
                    spawn.elite_sure = spawn.elite;
                } else {
                    spawn.elite_sure = [this.actors[data.spawn_elite_id]];
                }
            } else {
                spawn.elite_sure = null;
            }

            // 设置怪物数量范围
            spawn.monsterMin = data.monster_min;
            spawn.monsterMax = data.monster_max;

            // 处理道具
            if (data.item !== 0) {
                const actorTmp = this.actors[data.item];
                if (actorTmp) {
                    spawn.item.push(actorTmp);
                    actorTmp.new_round_spawn_percentage = data.item_percentage;
                }
            }

            // 处理技能
            if (data.skill !== 0) {
                const actorTmp = this.actors[data.skill];
                if (actorTmp) {
                    spawn.skill.push(actorTmp);
                    actorTmp.new_round_spawn_percentage = data.skill_percentage;
                }
            }

            this.spawns.push(spawn);

            // 特殊怪物的特殊处理
            if (data.spawn_elite === 1 && data.spawn_elite_id !== 0) {
                const newSpawn = makeCopy(spawn);
                newSpawn.round += 1;
                newSpawn.elite_sure = null;
                this.spawns.push(newSpawn);
            }

            prevSpawn = spawn;
        }

        log('spawns: ', this.spawns);
    }

    /**
     * 初始化角色管理器
     * 必须在 game.jsonData 加载完成后调用
     */
    public init(): void {
        console.log('actorManager init');
        this.initActors();
        this.initSpawn();
    }
}

export { ActorManager };