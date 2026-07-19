# LIG-32 · FCC 空间合同、地标与路线

## 用户故事

作为世界设计师，我希望三个世界共享一套可执行的 FCC 坐标、地标和路线合同，以便渲染、导航、记忆与自动测试引用同一份空间事实。

## 验收标准

- FCCCoord 只接受整数偶宇称坐标，并暴露固定的 12 个邻接方向。
- `world = (xS, zS, yS)` 使用统一 `S = 0.58`，格点距离与邻接判断可独立测试。
- 三个 SceneManifest 定义 bounds、Region、Landmark、Route、DynamicField 和 spawn point。
- 每条 RouteSpec 展开为连续 FCC cells，并声明身体限制、成本、动态边与后备路线。
- 断桥谷、回声矿城、漂移花园的地标坐标与 V2.1 设计文档一致。
- 浏览器和 Node 测试使用同一空间模块，不复制坐标规则。
