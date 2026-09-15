import type { NodeProps } from "@xyflow/react";
import { CardNode } from "./components/CardNode";
import { ImageNode } from "./components/ImageNode";
import { TextNode } from "./components/TextNode";
import { VideoNode } from "./components/VideoNode";

export { ImageEditPanel } from "./components/ImageNode";
export { TextEditPanel } from "./components/TextNode";
export { VideoEditPanel } from "./components/VideoNode";

/** 统一节点入口；新增类型只需在此注册对应的子组件。 */
export function CanvasNode(props: NodeProps) {
  switch (props.type) {
    case "image":
      return <ImageNode {...props} />;
    case "text":
      return <TextNode {...props} />;
    case "video":
      return <VideoNode {...props} />;
    case "card":
    default:
      return <CardNode {...props} />;
  }
}

/** React Flow 需要为每个节点类型提供一个入口，但渲染逻辑集中在 CanvasNode。 */
export const nodeTypes = {
  card: CanvasNode,
  image: CanvasNode,
  text: CanvasNode,
  video: CanvasNode,
};
