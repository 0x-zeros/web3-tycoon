# Web3 资源目录

这个目录包含所有PaperActor系统使用的美术资源。

## 目录结构

### actors/
NPC、物体的纹理资源（仅用于PaperActor，不包括装饰物）
- 命名规则：`{name}.png` 或 `{name}.jpg`
- 必需文件：
  - `land_god.png` - 土地神NPC
  - `wealth_god.png` - 财神NPC
  - `fortune_god.png` - 福神NPC
  - `poverty_god.png` - 穷神NPC
  - `dog.png` - 狗狗NPC
  - `cat.png` - 猫咪NPC
  - `bomb.png` - 炸弹物体
  - `treasure_box.png` - 宝箱物体

### buildings/
建筑物纹理资源（包含各个等级）
- 命名规则：`{building_name}_lv{level}.png`
- 必需的建筑类型：

#### 小型地产 (1x1)
  - `property_small_lv0.png` - 空地
  - `property_small_lv1.png` - 小屋
  - `property_small_lv2.png` - 房屋
  - `property_small_lv3.png` - 商铺
  - `property_small_lv4.png` - 大楼

#### 中型地产 (1x1)
  - `property_medium_lv0.png` - 空地
  - `property_medium_lv1.png` - 商店
  - `property_medium_lv2.png` - 办公楼
  - `property_medium_lv3.png` - 商务楼
  - `property_medium_lv4.png` - 摩天楼

#### 大型地产 (2x2)
  - `property_large_lv0.png` - 空地
  - `property_large_lv1.png` - 购物中心
  - `property_large_lv2.png` - 商业广场
  - `property_large_lv3.png` - 金融中心
  - `property_large_lv4.png` - 总部大厦

#### 特殊建筑
  - `temple_lv0.png` - 土地庙空地
  - `temple_lv1.png` - 土地庙1级
  - `temple_lv2.png` - 土地庙2级
  - `temple_lv3.png` - 土地庙3级
  - `research_lv0-3.png` - 研究所（4个等级）
  - `oil_company_lv0-3.png` - 石油公司（4个等级）
  - `commercial_lv0-3.png` - 商业中心（4个等级）
  - `hotel_lv0-3.png` - 大饭店（4个等级）
  - `tech_company_lv0-3.png` - 科技公司（4个等级）
  - `bank_lv0-3.png` - 银行（4个等级）
  - `hospital.png` - 医院（单一纹理）
  - `airport.png` - 机场（单一纹理）

#### Web3主题建筑
  - `crypto_mine_lv0-3.png` - 加密矿场（4个等级）
  - `nft_gallery_lv0-3.png` - NFT画廊（4个等级）

### ui/
UI相关资源（对话气泡、图标等）
- `bubble.png` - 对话气泡（用于say动画）
- `icons/` - 各种UI图标

## 纹理规格建议

- **NPC/物体**: 256x256 或 512x512
- **建筑**: 512x512 或 1024x1024
- **装饰物**: 128x128 或 256x256
- **格式**: PNG（带透明通道）或 JPG（不透明）

## 注意事项

1. 所有纹理都应该是正方形
2. 建议使用2的幂次方尺寸（128, 256, 512, 1024）
3. 透明背景的精灵使用PNG格式
4. 纹理文件名必须与ActorConfig.ts中的配置一致