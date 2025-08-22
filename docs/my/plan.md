

# 后期优化 随想


使用客户端p2p或者服务器的方式进行预同步（比链上confirm tx要更早的能显示掷骰子等操作； 如果fail之类的，再回滚客户端显示），不过此类型游戏里可能不需要。




@client/2048/ 这是我的cocos creator v3.8 游戏 2048。 cocos的用户手册为https://docs.cocos.com/creator/3.8/manual/zh/， api文档为：https://docs.cocos.com/creator/3.8/api/zh/。引擎url： https://www.cocos.com/en/creator, 你和我对话的时候请使用中文。 游戏的框架和game scene场景我已经建好。你帮我在script下用ts写一下游戏逻辑。所有的node和Component等都是用ts代码动态生成的方式，不要修改game scene。游戏主入口请命名为GameManager，我在你生成结束以后会手动add到game scene里'gameManager' node上。如果用到资源，包括Sprite图片等，请使用引擎里自带的internal里的。




