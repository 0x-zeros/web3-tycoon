⏺ 📊 两个相机控制器的详细对比分析

  1. VoxelCameraController (体素世界专用)

  特点:
  - 专为体素世界设计: 第一人称视角控制，适合Minecraft风格的游戏
  - 两种模式:
    - WALKING: 行走模式，有碰撞检测，不能穿墙
    - FLYING: 飞行模式，可自由移动
  - 碰撞检测: 与体素世界的方块进行碰撞检测
  - WASD控制: 标准FPS控制方式
  - 左键拖拽旋转: 鼠标控制视角

  核心功能:
  - 体素碰撞检测 (VoxelCollisionSystem)
  - 方块查询功能 (setBlockQueryFunction)
  - 分轴移动 (trySeparateAxisMovement) - 贴墙滑动
  - F键切换行走/飞行模式
  - 空格/Shift控制上下飞行

  2. CameraController (通用游戏相机)

  特点:
  - 为大富翁游戏设计: 第三人称/俯视角控制
  - 三种模式:
    - ISOMETRIC: 等距视角 (45度俯视，经典棋盘游戏)
    - TOP_DOWN: 俯视视角 (90度垂直俯视)
    - THIRD_PERSON_FOLLOW: 第三人称跟随
  - 平滑过渡: Tween动画切换视角
  - 单例模式: 全局相机管理
  - F1-F4快捷键: 切换相机模式
  - 右键旋转/滚轮缩放: 更灵活的相机控制

  核心功能:
  - 单例访问 (getInstance/getMainCamera)
  - 平滑相机过渡 (Tween动画)
  - 事件系统集成 (EventBus)
  - 相机边界限制
  - 调试模式和可视化

  🤔 架构建议

  方案1: 保持独立 (推荐) ✅

  理由:
  1. 用途完全不同:
    - VoxelCameraController = FPS第一人称控制
    - CameraController = 策略游戏第三人称控制
  2. 依赖不同:
    - VoxelCameraController 依赖体素碰撞系统
    - CameraController 依赖游戏地图系统
  3. 清晰的职责分离:
    - 体素世界有自己的相机需求
    - 主游戏有不同的相机需求

  建议的目录结构:
  /scripts/camera/
    ├── CameraController.ts      # 主游戏相机
    ├── CameraConfig.ts          # 主游戏相机配置
    ├── CameraDebugger.ts        # 调试组件
    └── voxel/
        └── VoxelCameraController.ts  # 体素相机(移动到这里)

  方案2: 功能融合 (不推荐) ❌

  如果要融合，需要：
  1. 在CameraMode中添加 FIRST_PERSON_FPS 和 FIRST_PERSON_FLYING
  2. 添加碰撞系统的可选依赖
  3. 增加配置复杂度
  4. 可能导致代码臃肿

  🎯 我的建议

  保持两个控制器独立，但做以下优化：

  1. 移动位置: 将 VoxelCameraController.ts 移到 /scripts/camera/voxel/ 下
  2. 重命名: 改为 VoxelFPSCameraController.ts 更清晰
  3. 共享基础功能: 可以创建一个 BaseCameraController 基类
  4. 统一访问接口: 在需要时通过配置选择使用哪个控制器

  // 使用示例
  if (gameMode === 'voxel') {
      // 使用体素FPS相机
      this.addComponent(VoxelFPSCameraController);
  } else {
      // 使用主游戏相机
      this.addComponent(CameraController);
  }

  这样既保持了代码的清晰性，又避免了不必要的复杂性。体素世界和主游戏可以各自优化自己的相机控制逻辑。