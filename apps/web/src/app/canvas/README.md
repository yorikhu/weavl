# Canvas 目录

`page.tsx` 只负责组合画布状态、React Flow 和页面级事件，不放节点数据模板或菜单 JSX。

- `components/`：项目栏、Agent、缩放控件、节点菜单/节点库、空态，以及各节点的视图。
- `hooks/useCanvasEditing.ts`：节点编辑状态、保存与编辑态全局事件。
- `hooks/useCanvasConnections.ts`：拖线、圆点磁吸、目标预览及连接后的新建菜单。
- `constants/`：节点库、基础节点菜单选项、工具栏配置、工作流阶段标题和视口参数。
- `utils/nodeFactory.ts`：基础节点、连线新建节点和节点库实例的数据构造。
- `utils/latestRunGraph.ts`：最近运行结果到节点、连线的映射。
- `utils/nodeSelectors.ts`：与 UI 无关的节点分类和选框判断。
- `types/nodes.ts`：React Flow 节点数据契约；`components/CanvasNodes.tsx` 是渲染组件注册表。

增加基础节点类型时，依次补充 `types/nodes.ts` 中的数据类型、`CanvasNodes.tsx` 中的渲染组件、`nodeFactory.ts` 中的默认与连线数据、`constants/index.tsx` 中的菜单入口。复杂的编辑交互分别放入节点组件或对应 hook，不放回 `page.tsx`。
