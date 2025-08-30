# web3-tycoon



我想参考大富翁10（https://store.steampowered.com/app/1162520/10_RichMan_10/），11（https://store.steampowered.com/app/2074800/11/?curator_clanid=42918567）等历代的大富翁游戏，在sui链上制作一款web3游戏，后端代码为move编程（运行在sui链上），客户端使用cocos creator引擎（编程语言为typescript）。这是一个为期2个月的黑客松项目。 我希望在有限的时间里先实现核心功能，比赛结束以后我会继续开发完善。我希望你能一路帮助我，从现有游戏分析解构，策划案大纲的生成，程序架构等方面。美术素材我打算使用ai生成的先做demo版。




## 多人联网，pc 玩家（自动操作的角色）
自动操作的一开始最简单的完全随机就行了，问题不大。测试网gas费不用担心。正式游戏考虑gas可以去掉，就正式玩家对战，或者玩家付费请ai和自己组局。


## sui 性能， gas费

计划把所有后端逻辑都用move实现，不只是单纯的一些nft之类的。
在思考move代码结构中，我意识到gas费可能会比较贵，要是一局玩下来要个1sui之类的，实际上可能就没法玩了。
sui的性能也不一定能够胜任遍历地图的计算？ 

先开发着看看吧，毕竟如果不行的话，别的链，别的游戏类型（实时战斗rpc之类的， 感觉更不行）



defi:
增加他们的用户的交互性，日活； 那就会很好。 嗯，这个不错。






参照黑客松的说明，赛道可以多选。sui赛道是必选的，另外三个赛道 Bucket、Scallop、Navi， 我也想打上勾（使成功概率大一些），你帮我想想怎么在项目里加上要素。 黑客松的说明如下（https://mp.weixin.qq.com/s/uMz2GaKeuwX0VgiHiYs1Pw?scene=1&click_id=2）： 




## cocos creator 使用claude code生成的问题：
sonnet 和 opus 都试过了，生成的node，包括Sprite在cocos里面打开都有问题。我估计是样本太说，又不是代码导致的。
解决方案有两个，都没有测试过：
1. 我手动建一个空白的场景，是不是附带一个light 和 camera，然后把ui，场景root node等架构搭建好，claude code帮我写ts代码，都用动态生成的方式就行。
2. claude帮我生成一个cocos mcp，然后再mcp的帮助下生成代码。

我后续先使用方案1




### 卡片系统
整个卡片系统，其实也就是一个技能系统


