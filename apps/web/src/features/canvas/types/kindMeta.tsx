import { Image as ImageIcon, Sparkles, Video as VideoIcon, Wand2 } from "lucide-react";
import type { NodeKind, NodeKindMeta } from "./nodes";

/**
 * 节点种类元信息（badge + 颜色 + 图标）。
 * 按 NodeKind 索引，统一全画布节点视觉规范。
 */
export const KIND_META: Record<NodeKind, NodeKindMeta> = {
  llm: {
    badge: "LLM",
    icon: <Wand2 size={10} />,
    color: {
      bg: "rgba(217, 75, 75, 0.06)",
      stroke: "rgba(217, 75, 75, 0.45)",
      text: "#f7c1c1",
      soft: "rgba(217, 75, 75, 0.6)",
    },
  },
  image: {
    badge: "图像",
    icon: <ImageIcon size={10} />,
    color: {
      bg: "rgba(212, 83, 126, 0.06)",
      stroke: "rgba(212, 83, 126, 0.45)",
      text: "#f4c0d1",
      soft: "rgba(212, 83, 126, 0.6)",
    },
  },
  video: {
    badge: "视频",
    icon: <VideoIcon size={10} />,
    color: {
      bg: "rgba(55, 138, 221, 0.06)",
      stroke: "rgba(55, 138, 221, 0.45)",
      text: "#b5d4f4",
      soft: "rgba(55, 138, 221, 0.6)",
    },
  },
  output: {
    badge: "产物",
    icon: <Sparkles size={10} />,
    color: {
      bg: "rgba(245, 158, 11, 0.06)",
      stroke: "rgba(245, 158, 11, 0.5)",
      text: "#fac775",
      soft: "rgba(245, 158, 11, 0.65)",
    },
  },
};
