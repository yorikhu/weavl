# Canvas 目录

`page.tsx` 只负责组合画布状态、React Flow 和页面级事件，不放节点数据模板或菜单 JSX。

- `components/`：项目栏、Agent、缩放控件、节点菜单/节点库、空态；每个组件使用独立目录，`index.tsx` 与 `index.module.scss` 同放。
- `components/CanvasNode/`：React Flow 的统一节点入口和共享连接点/媒体样式；具体节点视图与专属样式放在其 `components/` 子目录。
- `hooks/useCanvasEditing.ts`：节点编辑状态、保存与编辑态全局事件。
- `hooks/useCanvasConnections.ts`：拖线、圆点磁吸、目标预览及连接后的新建菜单。
- `constants/`：节点库、基础节点菜单选项、工具栏配置、工作流阶段标题和视口参数。
- `utils/nodeFactory.ts`：基础节点、连线新建节点和节点库实例的数据构造。
- `utils/latestRunGraph.ts`：最近运行结果到节点、连线的映射。
- `utils/nodeSelectors.ts`：与 UI 无关的节点分类和选框判断。
- `types/nodes.ts`：React Flow 节点数据契约；`components/CanvasNode/index.tsx` 是统一渲染入口和类型注册表。

增加基础节点类型时，依次补充 `types/nodes.ts` 中的数据类型、`CanvasNode/components/` 中的视图与样式、`CanvasNode/index.tsx` 中的分发和注册、`nodeFactory.ts` 中的默认与连线数据、`constants/index.tsx` 中的菜单入口。复杂的编辑交互分别放入节点组件或对应 hook，不放回 `page.tsx`。
