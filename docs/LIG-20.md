# LIG-20 · 捕获真实渲染异常

## 用户故事

作为反复遇到 `frame: GPU render` 的手机测试者，我希望错误提示包含 Three.js 抛出的真实异常类型与消息，以便下一步修复基于证据而不是阶段猜测。

## 验收标准

1. `renderer.render()` 使用同步异常边界。
2. 捕获后停止后续 GPU 提交，避免错误刷屏。
3. 提示显示异常名称和 message。
4. 全局错误处理优先读取 `event.error`。
5. 成功帧将阶段更新为 `frame: complete`，避免后续错误被误归为 GPU render。
