# 生命视觉受控输入

这些文件用于已验收照片轮廓的发布，不是病原鉴定、病例或真实三维解剖数据。

- 尼罗罗非鱼：Max Taub / FishBase，CC BY 4.0；https://commons.wikimedia.org/wiki/File:OreoniloticusMax.jpg
- 凡纳滨对虾幼虾：USDA Agricultural Research Service，Image K3507-12，公有领域；https://commons.wikimedia.org/wiki/File:Penaeus_vannamei_01.jpg
- originals为未改字节的原图，references为取景裁剪；对虾只采上方真实个体，排除倒影。
- photo-samples.json.gz保存用户验收后的照片XY轮廓、表面采样与来源，双方各30,000点；浅Z仅为点云显示，不表示恢复了解剖结构。原图哈希随快照保存。

发布命令：node scripts/publish-life-visuals.mjs --write

只读核验：node scripts/publish-life-visuals.mjs --check

发布器从已验收的受控采样快照生成固定小端二进制、静态轮廓、来源清单，并逐字节核对照片；没有当前日期或随机输出。照片重新分割属于会改变轮廓的编辑步骤，不在check中自动执行，也不覆盖受控快照。

GLF1格式：16字节头，uint16版本1、uint16点记录8字节、uint32每种动物点数、uint32动物数2，均为小端；其后罗非鱼、对虾依次为int16(X×8192)、int16(Y×8192)、int16(Z×32767)、uint8强度、uint8边界0/255。两个动物共480,016字节。

微观静态图由项目代码生成，仅为细胞/链状球菌/杆状病毒的结构示意；形态资料参考ICTV Nimaviridae与S. iniae原始研究，来源保存在公开manifest中。
