import { _decorator, Component, Node, find, log } from 'cc';
import { round } from './round';
import Role from './Role';
import Actorgrid, { GridRect } from './Actorgrid';
import Path from './Path';
import Wall from './wall';
import { Vector, Bounds } from '../../common/math';
import { UITransform } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('Playground')
export default class Playground extends Component {
    @property(Node)
    gridRect: Node = null;

    @property(Actorgrid)
    grid: Actorgrid = null;

    @property(Node)
    gridEffectRoot: Node = null;

    @property(Role)
    role: Role = null;

    @property(Node)
    missile: Node = null;

    @property(Node)
    missileOverlay: Node = null;

    // info node
    @property(Node)
    skill1Position: Node = null;

    @property(Node)
    skill2Position: Node = null;

    // Properties
    bounds: any = null;
    round: any = null;
    rebounceWall: Wall = null;
    path: Path = null;

    init(): void { // start() {
        game.playground = this;
        const contentSize = this.node.getComponent(UITransform)!.contentSize;
        this.bounds = Bounds.createBy(0, 0, contentSize.width, contentSize.height);

        this.round = round();
        this.round.init();
        game.round = this.round;

        game.effectManager.setEffectContainer(this.gridEffectRoot);

        //
        const uiTransform = this.gridRect.getComponent(UITransform)!;
        const gridRect: GridRect = {
            x: this.gridRect.x,
            y: this.gridRect.y,
            width: uiTransform.width,
            height: uiTransform.height
        };

        this.createRebounceWall(gridRect);

        this.role.init();
        game.role = this.role;

        
        this.grid.init(gridRect);
        game.grid = this.grid;

        let pathNode = find('path', this.node);
        this.path = pathNode.getComponent('Path') as Path;
        log('path', this.path);
        this.path.init(this.role.getEmitter(), gridRect);

        //
        this.round.start();
    }

    replay(): void {
        this.role.replay();
        this.grid.replay();

        // physics.clear();

        //
        this.round.init();
        this.round.start();
    }

    createRebounceWall(gridRect: GridRect): void {
        this.rebounceWall = new Wall();
        this.rebounceWall.create(gridRect);
        game.rebounceWall = this.rebounceWall;
    }

    roundNum(): number {
        return this.round.roundNum();
    }

    lose(): void {
        // log('game lose!');

        // music.playEffect(music.clipNames.effect_victory);
        game.audioManager.playEffect('victory');
        game.pushScene(game.sceneNames.award);
    }

    update(delta: number): void {
        this.grid.gameloop(delta);
        this.role.gameloop(delta);
    }
}