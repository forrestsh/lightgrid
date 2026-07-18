# LIG-14 · 手机版 Three.js 加载路径统一

## 用户故事

作为能够运行 Lightgrid 其他 3D 演示的手机玩家，我希望断桥谷使用同一套已验证的 Three.js 加载路径，以便直接进入完整 3D 世界。

## 验收标准

1. 移除手机宽度强制跳转到 2D 页面的逻辑。
2. 断桥谷与 OpenRC F1、Seed & Crystal 使用相同的 cdnjs Three.js r128 脚本。
3. 脚本声明 `crossorigin="anonymous"`，使跨域脚本异常能够返回真实错误信息。
4. 375 × 812 视口仍创建 3D canvas、完成 FCC 世界生成并显示触控控件。
5. 桌面 3D 路径不变。
