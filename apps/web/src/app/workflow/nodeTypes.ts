/** 工作流节点类型元数据 —— 添加节点弹层 + 节点卡 + 配置面板的单一来源 */

import {
  Blocks,
  Bot,
  Brain,
  Braces,
  Code2,
  Cog,
  Database,
  FileSearch,
  FileText,
  Filter,
  FolderOpen,
  GitBranch,
  Hash,
  Layers,
  LogIn,
  LogOut,
  type LucideIcon,
  Package,
  PencilLine,
  Play,
  Repeat,
  Search,
  Send,
  Settings2,
  Shuffle,
  Sparkles,
  Table,
  Timer,
  Trash2,
  Workflow,
  Zap,
} from "lucide-react";

/** 节点分类（左侧"业务逻辑 / 数据库 ..."标题） */
export type NodeCategory =
  | "基础"
  | "业务逻辑"
  | "输入&输出"
  | "数据库"
  | "知识库&数据"
  | "插件"
  | "工作流";

/** 节点元数据 */
export interface NodeTypeMeta {
  /** 唯一 id（也是节点的 kind） */
  id: string;
  /** 展示名 */
  name: string;
  /** 简短描述（弹层卡片下） */
  desc: string;
  /** 图标 */
  icon: LucideIcon;
  /** 主题色（卡片边框 / 头标底色） */
  color: string;
  /** 分类 */
  category: NodeCategory;
  /** 节点上的"标签" chip（如"触发器"） */
  tag?: string;
  /** 是否有 input 端口（开始节点没有） */
  hasInput: boolean;
  /** 是否有 output 端口（结束节点没有） */
  hasOutput: boolean;
  /** 是否在第一版就支持点击添加（其它只展示） */
  implemented: boolean;
}

/** 一级分组（顶部大卡：大模型 / 插件 / 工作流） */
export interface TopGroup {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
}

/** 节点库顶部 3 个一级大卡 */
export const TOP_GROUPS: TopGroup[] = [
  { id: "llm", name: "大模型", icon: Bot, color: "#7f77dd" },
  { id: "plugin", name: "插件", icon: Package, color: "#7f77dd" },
  { id: "workflow", name: "工作流", icon: Workflow, color: "#7f77dd" },
];

/** 节点库二级分组（每组带 items） */
export interface NodeGroup {
  category: NodeCategory;
  items: NodeTypeMeta[];
}

/** 节点库全量数据 */
export const NODE_GROUPS: NodeGroup[] = [
  {
    category: "业务逻辑",
    items: [
      { id: "code", name: "代码", desc: "运行一段 JS/Python 脚本", icon: Code2, color: "#378add", category: "业务逻辑", hasInput: true, hasOutput: true, implemented: true },
      { id: "selector", name: "IF 选择器", desc: "按条件分支流转（如果 / 否则）", icon: GitBranch, color: "#378add", category: "业务逻辑", hasInput: true, hasOutput: true, implemented: true },
      { id: "intent", name: "意图识别", desc: "LLM 分类用户意图", icon: Brain, color: "#378add", category: "业务逻辑", hasInput: true, hasOutput: true, implemented: false },
      { id: "loop", name: "循环", desc: "遍历数组执行子流程", icon: Repeat, color: "#378add", category: "业务逻辑", hasInput: true, hasOutput: true, implemented: false },
      { id: "batch", name: "批处理", desc: "批量运行同一节点", icon: Layers, color: "#378add", category: "业务逻辑", hasInput: true, hasOutput: true, implemented: false },
      { id: "aggregate", name: "变量聚合", desc: "合并多路变量", icon: Shuffle, color: "#378add", category: "业务逻辑", hasInput: true, hasOutput: true, implemented: false },
      { id: "async", name: "异步任务", desc: "异步并行执行", icon: Zap, color: "#378add", category: "业务逻辑", hasInput: true, hasOutput: true, implemented: false },
    ],
  },
  {
    category: "输入&输出",
    items: [
      { id: "input", name: "输入", desc: "接收外部传入参数", icon: LogIn, color: "#534ab7", category: "输入&输出", hasInput: false, hasOutput: true, implemented: false },
      { id: "output", name: "输出", desc: "返回工作流结果", icon: LogOut, color: "#534ab7", category: "输入&输出", hasInput: true, hasOutput: false, implemented: false },
    ],
  },
  {
    category: "数据库",
    items: [
      { id: "sql", name: "SQL自定义", desc: "自定义 SQL 语句", icon: Database, color: "#e08a3c", category: "数据库", hasInput: true, hasOutput: true, implemented: false },
      { id: "db_insert", name: "新增数据", desc: "插入数据库行", icon: Table, color: "#e08a3c", category: "数据库", hasInput: true, hasOutput: true, implemented: false },
      { id: "db_update", name: "更新数据", desc: "更新数据库行", icon: PencilLine, color: "#e08a3c", category: "数据库", hasInput: true, hasOutput: true, implemented: false },
      { id: "db_query", name: "查询数据", desc: "SELECT 查询", icon: Search, color: "#e08a3c", category: "数据库", hasInput: true, hasOutput: true, implemented: false },
      { id: "db_delete", name: "删除数据", desc: "DELETE 行", icon: Trash2, color: "#e08a3c", category: "数据库", hasInput: true, hasOutput: true, implemented: false },
    ],
  },
  {
    category: "知识库&数据",
    items: [
      { id: "kb_write", name: "知识库写入", desc: "写入知识库", icon: FileText, color: "#e08a3c", category: "知识库&数据", hasInput: true, hasOutput: true, implemented: false },
      { id: "kb_search", name: "知识库检索", desc: "知识库 RAG 检索", icon: FileSearch, color: "#e08a3c", category: "知识库&数据", hasInput: true, hasOutput: true, implemented: false },
    ],
  },
];

/** 顶部一级大卡对应的节点（"大模型" = LLM；"插件"/"工作流" 第一版占位） */
export const TOP_GROUP_NODES = {
  llm: {
    id: "llm", name: "大模型", desc: "调用语言模型生成内容", icon: Bot, color: "#7f77dd",
    category: "基础", hasInput: true, hasOutput: true, implemented: true,
  },
  plugin: {
    id: "plugin", name: "插件", desc: "调用第三方插件", icon: Package, color: "#7f77dd",
    category: "插件", hasInput: true, hasOutput: true, implemented: false,
  },
  workflow: {
    id: "workflow", name: "工作流", desc: "嵌入子工作流", icon: Workflow, color: "#7f77dd",
    category: "工作流", hasInput: true, hasOutput: true, implemented: false,
  },
} as const satisfies Record<string, NodeTypeMeta>;

/** 基础节点（开始/结束）—— 永远在弹层最前 */
export const BASE_NODES: NodeTypeMeta[] = [
  {
    id: "start", name: "开始", desc: "工作流的起始节点", icon: Play, color: "#534ab7",
    category: "基础", tag: "触发器", hasInput: false, hasOutput: true, implemented: true,
  },
  {
    id: "end", name: "结束", desc: "工作流的最终节点，用于返回工作流运行后的结果信息", icon: LogOut, color: "#534ab7",
    category: "基础", hasInput: true, hasOutput: false, implemented: false,
  },
];

/** 弹层搜索时用的扁平表（id → meta） */
export const NODE_META: Record<string, NodeTypeMeta> = (() => {
  const map: Record<string, NodeTypeMeta> = {};
  for (const n of BASE_NODES) map[n.id] = n;
  map[TOP_GROUP_NODES.llm.id] = TOP_GROUP_NODES.llm;
  map[TOP_GROUP_NODES.plugin.id] = TOP_GROUP_NODES.plugin;
  map[TOP_GROUP_NODES.workflow.id] = TOP_GROUP_NODES.workflow;
  for (const g of NODE_GROUPS) for (const n of g.items) map[n.id] = n;
  /* 空白工作流的结束节点 */
  map["end"] = {
    id: "end",
    name: "结束",
    desc: "工作流的最终节点，用于返回工作流运行后的结果信息",
    icon: LogIn,
    color: "#5e5e66",
    category: "基础",
    hasInput: true,
    hasOutput: false,
    implemented: true,
  };
  return map;
})();
