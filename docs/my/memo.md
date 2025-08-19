# web3-tycoon



我想参考大富翁10（https://store.steampowered.com/app/1162520/10_RichMan_10/），11（https://store.steampowered.com/app/2074800/11/?curator_clanid=42918567）等历代的大富翁游戏，在sui链上制作一款web3游戏，后端代码为move编程（运行在sui链上），客户端使用cocos creator引擎（编程语言为typescript）。这是一个为期2个月的黑客松项目。 我希望在有限的时间里先实现核心功能，比赛结束以后我会继续开发完善。我希望你能一路帮助我，从现有游戏分析解构，策划案大纲的生成，程序架构等方面。美术素材我打算使用ai生成的先做demo版。



### sui 性能， gas费

计划把所有后端逻辑都用move实现，不只是单纯的一些nft之类的。
在思考move代码结构中，我意识到gas费可能会比较贵，要是一局玩下来要个1sui之类的，实际上可能就没法玩了。
sui的性能也不一定能够胜任遍历地图的计算？ 

先开发着看看吧，毕竟如果不行的话，别的链，别的游戏类型（实时战斗rpc之类的， 感觉更不行）




1。
对游戏的现有地图分析，需要一个地图编辑器， 可以策划手动编辑，也可以ai生成的那种； 不考虑web3因素，在一般的游戏里，怎么做这个地图编辑器，以及地图的数据结构


2. 去掉web3因素，咨询ai下面的问题

直接用cocoscreator开发一个2d的大富翁？
地图编辑器



九、美术风格参考
视觉风格

整体风格：Low Poly + 卡通渲染
色彩方案：明亮鲜艳，高饱和度
UI设计：扁平化 + 微动效

AI生成Prompt示例
地产建筑：
"Cute low poly house, cartoon style, bright colors, 
isometric view, simple geometry, game asset"

角色设计：
"Chibi character, businessman outfit, cartoon style, 
3D render, bright lighting, game character"

卡片设计：
"Magic card frame, fantasy style, golden border, 
game UI element, transparent background"


参照黑客松的说明，赛道可以多选。sui赛道是必选的，另外三个赛道 Bucket、Scallop、Navi， 我也想打上勾（使成功概率大一些），你帮我想想怎么在项目里加上要素。 黑客松的说明如下（https://mp.weixin.qq.com/s/uMz2GaKeuwX0VgiHiYs1Pw?scene=1&click_id=2）： 
