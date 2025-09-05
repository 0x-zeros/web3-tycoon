1. 相机控制器架构 ✅

  - 创建了完整的相机系统 /assets/scripts/camera/
  - 单例模式访问: CameraController.getMainCamera() 统一获取主相机
  - 三种相机模式:
    - 等距视角 (Isometric): 45度俯视角，经典棋盘游戏视角
    - 俯视视角 (Top-Down): 90度垂直俯视，战略全局视角
    - 第三人称跟随 (Follow): 动态跟随目标，支持前瞻

  2. 配置与调试系统 ✅

  - CameraConfig.ts: 详细的配置接口和默认参数
  - CameraDebugger.ts: 实时调试信息显示组件
  - 快捷键控制: F1-F4 切换模式和创建测试目标
  - 交互控制: 右键旋转、滚轮缩放

  3. 平滑过渡与动画 ✅

  - Tween动画: 相机切换使用缓动过渡
  - 事件系统: 集成EventBus，支持相机模式变化事件
  - 智能跟随: 第三人称模式支持前瞻距离和高度自适应

  4. 代码统一更新 ✅

  - GameMap.ts: 更新为使用 CameraController.getMainCamera()
  - UI3DInteractionManager.ts: 统一相机访问方式
  - UIHelper.ts: 更新坐标转换中的相机获取

  🎮 使用方式

  // 获取相机实例
  const camera = CameraController.getMainCamera();

  // 切换相机模式
  const controller = CameraController.getInstance();
  controller?.setMode(CameraMode.ISOMETRIC);

  // 设置跟随目标
  controller?.setTarget(playerNode);

  // 查看指定位置
  controller?.lookAt(new Vec3(10, 0, 10));

  🎯 快捷键操作

  - F1: 切换到等距视角
  - F2: 切换到俯视视角
  - F3: 切换到第三人称跟随
  - F4: 创建测试跟随目标




键盘控制：
  - wsad - 在两个模式下， 调用lookAt，前后左右移动

 鼠标控制：
  - 滚轮 - 在topdown mode下缩放相机高度， 在isometric mode下缩放distance
  - 右键拖拽 - 在等距模式下旋转相机 //有bug，不实现了 