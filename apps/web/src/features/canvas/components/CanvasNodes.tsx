import { CardNode } from "@/features/canvas/components/nodes/CardNode";
import { ImageNode } from "@/features/canvas/components/nodes/ImageNode";
import { TextNode } from "@/features/canvas/components/nodes/TextNode";
import { VideoNode } from "@/features/canvas/components/nodes/VideoNode";

export { ImageEditPanel } from "@/features/canvas/components/nodes/ImageNode";
export { VideoEditPanel } from "@/features/canvas/components/nodes/VideoNode";

/** React Flow 使用的画布节点类型注册表。 */
export const nodeTypes = { card: CardNode, image: ImageNode, text: TextNode, video: VideoNode };
