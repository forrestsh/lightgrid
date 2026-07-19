# LIG-17 · 移动端轻量材质

## 用户故事

作为能建立断桥谷场景、但在首帧 GPU 渲染失败的手机玩家，我希望使用与 Seed & Crystal、Lightgrid 相同的轻量材质路径，以便移动 GPU 能完成实例绘制。

## 验收标准

1. 手机地形、地标、化身和货物使用 `MeshLambertMaterial` 与平面着色。
2. 桌面继续使用原 `MeshStandardMaterial` PBR 材质。
3. 手机关闭实例投影和接收阴影标记。
4. 透明水面、温室和发光晶体保持可辨识。
5. 手机仍使用 `InstancedMesh`，保留完整 FCC 轮廓和交互。
