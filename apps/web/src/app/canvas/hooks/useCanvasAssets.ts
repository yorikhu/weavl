import { useCallback, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { Asset, CanvasDocument } from "@weavl/shared";
import type { Edge, Node, Viewport } from "@xyflow/react";
import { toast } from "@/hooks/useToast";
import { jsonBody, studioApi } from "@/lib/studioApi";
import { assetToCanvasNode } from "@/utils/assetNode";
import { uploadAsset } from "@/utils/uploadAsset";
import type { CanvasAddMenuPosition } from "../components/CanvasAddMenus";
import { createBasicNode } from "../utils/nodeFactory";
import { getNextCanvasLayer } from "../utils/canvasGroups";
import { nodeAssetPayload, type NodeAssetPayload } from "../utils/nodeAssets";
import { selectNodeFromAssetList } from "../utils/nodeSelectors";
import { stripNodeGroup } from "../utils/canvasGroups";

interface UseCanvasAssetsOptions {
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
  projectName: string;
  projectId: string | null;
  canvasId: string | null;
  canvases: CanvasDocument[];
  contextMenu: CanvasAddMenuPosition | null;
  setContextMenu: Dispatch<SetStateAction<CanvasAddMenuPosition | null>>;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  setCanvases: Dispatch<SetStateAction<CanvasDocument[]>>;
}

function getNodesToSave(nodes: Node[], nodeIds?: string[]): Node[] {
  if (nodeIds?.length) return nodes.filter((node) => nodeIds.includes(node.id));
  return nodes.filter((node) => node.selected);
}

function getAssetPayloads(
  selected: Node[],
  projectName: string,
  nodes: Node[],
  edges: Edge[],
  viewport: Viewport,
): NodeAssetPayload[] {
  if (selected.length) return selected.map(nodeAssetPayload);
  return [
    {
      name: `${projectName} · 画布`,
      kind: "file",
      content: JSON.stringify({ nodes, edges, viewport }, null, 2),
      mimeType: "application/json",
    },
  ];
}

function createNodeCopy(source: Node, position: { x: number; y: number }): Node {
  const data = structuredClone(stripNodeGroup(source.data as Record<string, unknown>));
  const title = typeof data.title === "string" && data.title ? data.title : "节点";
  data.title = `${title} 副本`;
  return {
    ...source,
    id: `node_${crypto.randomUUID()}`,
    position,
    data,
    selectable: true,
    selected: true,
    dragging: false,
  };
}

interface NodeCopyBundle {
  nodes: Node[];
  idMap: Map<string, string>;
}

interface NodeCopyBundleOptions {
  preservePartialGroupMembership?: boolean;
}

function copyTitle(data: Record<string, unknown>) {
  const title = typeof data.title === "string" && data.title ? data.title : "节点";
  return `${title} 副本`;
}

/** 复制一组节点；完整组使用新标识，创建单节点副本时可选择继承原组。 */
function createNodeCopyBundle(
  sources: Node[],
  anchor: { x: number; y: number },
  current: Node[],
  options: NodeCopyBundleOptions = {},
): NodeCopyBundle {
  if (!sources.length) return { nodes: [], idMap: new Map() };
  const sourceIds = new Set(sources.map((node) => node.id));
  const completeGroupIds = new Set(
    sources
      .map((node) => (node.data as Record<string, unknown>).groupId)
      .filter((groupId): groupId is string => typeof groupId === "string")
      .filter((groupId) => {
        const members = current.filter((node) => (node.data as Record<string, unknown>).groupId === groupId);
        return members.length > 0 && members.every((node) => sourceIds.has(node.id));
      }),
  );
  const left = Math.min(...sources.map((node) => node.position.x));
  const top = Math.min(...sources.map((node) => node.position.y));
  const firstLayer = Math.max(0, ...current.map((node) => node.zIndex ?? 0)) + 1;
  const groupIds = new Map<string, string>();
  const idMap = new Map(sources.map((node) => [node.id, `node_${crypto.randomUUID()}`]));
  const copies = sources.map((source) => {
    const sourceData = structuredClone(source.data as Record<string, unknown>);
    const originalGroupId = typeof sourceData.groupId === "string" ? sourceData.groupId : null;
    const clonesCompleteGroup = Boolean(originalGroupId && completeGroupIds.has(originalGroupId));
    const preservesMembership = Boolean(
      originalGroupId && !clonesCompleteGroup && options.preservePartialGroupMembership,
    );
    const data = clonesCompleteGroup || preservesMembership ? sourceData : stripNodeGroup(sourceData);
    data.title = copyTitle(data);
    if (originalGroupId && clonesCompleteGroup) {
      const copiedGroupId = groupIds.get(originalGroupId) ?? `group_${crypto.randomUUID()}`;
      groupIds.set(originalGroupId, copiedGroupId);
      data.groupId = copiedGroupId;
      data.groupName = `${typeof data.groupName === "string" ? data.groupName : "Group"} 副本`;
      data.groupZIndex = firstLayer;
    }
    return {
      ...source,
      id: idMap.get(source.id)!,
      position: { x: anchor.x + source.position.x - left, y: anchor.y + source.position.y - top },
      data,
      zIndex: clonesCompleteGroup ? firstLayer + 1 : preservesMembership ? source.zIndex : firstLayer,
      selectable: !(clonesCompleteGroup || preservesMembership),
      selected: !(clonesCompleteGroup || preservesMembership),
      dragging: false,
    };
  });
  return { nodes: copies, idMap };
}

/**
 * 管理画布节点与项目资产、全局资产之间的全部交互。
 * 包含上传、保存到资产、复制、创建副本、粘贴和画布文档管理。
 *
 * @param options - 当前画布数据、项目上下文及对应状态更新器。
 * @returns 供页面和资产抽屉调用的资产状态、文件引用与操作方法。
 */
export function useCanvasAssets(options: UseCanvasAssetsOptions) {
  const {
    nodes,
    edges,
    viewport,
    projectName,
    projectId,
    canvasId,
    canvases,
    contextMenu,
    setContextMenu,
    setNodes,
    setEdges,
    setCanvases,
  } = options;
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const canvasUploadRef = useRef<HTMLInputElement | null>(null);
  const uploadPositionRef = useRef({ x: 400, y: 320 });
  const copiedNodesRef = useRef<Node[]>([]);

  const startCanvasUpload = useCallback(() => {
    if (contextMenu) uploadPositionRef.current = contextMenu.flowPos;
    setContextMenu(null);
    canvasUploadRef.current?.click();
  }, [contextMenu, setContextMenu]);

  const handleCanvasUpload = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      try {
        const assets = await Promise.all(Array.from(files, (file) => uploadAsset(file, null, false)));
        const base = uploadPositionRef.current;
        setNodes((current) => {
          const firstLayer = getNextCanvasLayer(current);
          return [
            ...current,
            ...assets.map((asset, index) => ({
              ...assetToCanvasNode(asset, current.length + index),
              position: { x: base.x + index * 24, y: base.y + index * 24 },
              zIndex: firstLayer + index,
            })),
          ];
        });
        toast(`${assets.length} 个文件已上传并添加到画布`, "success");
      } catch (cause) {
        toast((cause as Error).message || "文件上传失败");
      }
    },
    [setNodes],
  );

  const saveNodesToAssets = useCallback(
    async (nodeIds?: string[]) => {
      const selected = getNodesToSave(nodes, nodeIds);
      const payloads = getAssetPayloads(selected, projectName, nodes, edges, viewport);
      setContextMenu(null);
      try {
        const savedAssets = await Promise.all(
          payloads.map((payload) => studioApi<Asset>("/studio/assets", { method: "POST", body: jsonBody(payload) })),
        );
        setAvailableAssets((current) => [
          ...savedAssets,
          ...current.filter((asset) => !savedAssets.some((saved) => saved.id === asset.id)),
        ]);
        const message = selected.length ? `${payloads.length} 个节点已保存到我的资产` : "画布已保存到我的资产";
        toast(message, "success");
      } catch (cause) {
        toast((cause as Error).message || "保存到资产失败");
      }
    },
    [edges, nodes, projectName, setContextMenu, viewport],
  );

  const selectNodeFromAssets = useCallback(
    (nodeId: string) => {
      setNodes((current) => selectNodeFromAssetList(current, nodeId));
    },
    [setNodes],
  );

  const duplicateNode = useCallback(
    (nodeId: string) => {
      setNodes((current) => {
        const source = current.find((node) => node.id === nodeId);
        if (!source) return current;
        const unselectedNodes = current.map((node) => ({ ...node, selected: false }));
        const copy = createNodeCopy(source, { x: source.position.x + 28, y: source.position.y + 28 });
        return [...unselectedNodes, copy];
      });
    },
    [setNodes],
  );

  const copyNodes = useCallback(
    (nodeIds: string[]) => {
      const copiedIds = new Set(nodeIds);
      const sources = nodes.filter((node) => copiedIds.has(node.id));
      if (!sources.length) return;
      copiedNodesRef.current = structuredClone(sources);
      setContextMenu(null);
      toast(sources.length > 1 ? "分组已复制" : "节点已复制", "success");
    },
    [nodes, setContextMenu],
  );

  const duplicateNodesWithUpstream = useCallback(
    (nodeIds: string[]) => {
      const copiedIds = new Set(nodeIds);
      const sources = nodes.filter((node) => copiedIds.has(node.id));
      if (!sources.length) return;
      const left = Math.min(...sources.map((node) => node.position.x));
      const top = Math.min(...sources.map((node) => node.position.y));
      const bundle = createNodeCopyBundle(sources, { x: left + 28, y: top + 28 }, nodes, {
        preservePartialGroupMembership: true,
      });
      const upstreamEdges = edges.filter((edge) => copiedIds.has(edge.target));
      setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), ...bundle.nodes]);
      setEdges((current) => [
        ...current,
        ...upstreamEdges.map((edge) => ({
          ...edge,
          id: `e_${crypto.randomUUID()}`,
          source: bundle.idMap.get(edge.source) ?? edge.source,
          target: bundle.idMap.get(edge.target)!,
          selected: false,
        })),
      ]);
      setContextMenu(null);
      toast(sources.length > 1 ? "已创建包含上游连线的分组副本" : "已创建包含上游连线的副本", "success");
    },
    [edges, nodes, setContextMenu, setEdges, setNodes],
  );

  const renameNode = useCallback(
    (nodeId: string, name: string) => {
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== nodeId) return node;
          return { ...node, data: { ...(node.data as Record<string, unknown>), title: name } };
        }),
      );
    },
    [setNodes],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((current) => current.filter((node) => node.id !== nodeId));
      setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    },
    [setEdges, setNodes],
  );

  const deleteNodes = useCallback(
    (nodeIds: string[]) => {
      const deletedIds = new Set(nodeIds);
      setNodes((current) => current.filter((node) => !deletedIds.has(node.id)));
      setEdges((current) => current.filter((edge) => !deletedIds.has(edge.source) && !deletedIds.has(edge.target)));
      setContextMenu(null);
    },
    [setContextMenu, setEdges, setNodes],
  );

  const moveNodeToCanvas = useCallback(
    async (nodeId: string, targetCanvasId: string) => {
      if (!projectId || !canvasId || targetCanvasId === canvasId) return;
      const node = nodes.find((item) => item.id === nodeId);
      const targetCanvas = canvases.find((canvas) => canvas.id === targetCanvasId);
      if (!node || !targetCanvas) throw new Error("目标画布不存在");

      const sourceNodes = nodes.filter((item) => item.id !== nodeId);
      const sourceEdges = edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
      const movedNode = {
        ...node,
        data: stripNodeGroup(node.data as Record<string, unknown>),
        selectable: true,
        selected: false,
      };
      const targetNodes = [...targetCanvas.nodes, movedNode];
      await Promise.all([
        studioApi(`/studio/projects/${projectId}/canvases/${canvasId}`, {
          method: "PATCH",
          body: jsonBody({ nodes: sourceNodes, edges: sourceEdges, viewport }),
        }),
        studioApi(`/studio/projects/${projectId}/canvases/${targetCanvasId}`, {
          method: "PATCH",
          body: jsonBody({ nodes: targetNodes }),
        }),
      ]);
      setNodes(sourceNodes);
      setEdges(sourceEdges);
      setCanvases((current) =>
        current.map((canvas) => {
          if (canvas.id === canvasId) return { ...canvas, nodes: sourceNodes, edges: sourceEdges };
          if (canvas.id === targetCanvasId) return { ...canvas, nodes: targetNodes };
          return canvas;
        }),
      );
    },
    [canvasId, canvases, edges, nodes, projectId, setCanvases, setEdges, setNodes, viewport],
  );

  const pasteToCanvas = useCallback(async () => {
    const position = contextMenu?.flowPos ?? { x: 400, y: 320 };
    setContextMenu(null);
    if (copiedNodesRef.current.length) {
      const bundle = createNodeCopyBundle(copiedNodesRef.current, position, nodes);
      setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), ...bundle.nodes]);
      toast(bundle.nodes.length > 1 ? "分组已粘贴" : "节点已粘贴", "success");
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        toast("剪贴板中没有可粘贴的文字");
        return;
      }
      const node = createBasicNode("text", position, false, nodes);
      setNodes((current) => [...current, { ...node, data: { ...node.data, title: "粘贴文本", text } }]);
    } catch {
      toast("无法读取剪贴板，请允许浏览器访问剪贴板");
    }
  }, [contextMenu, nodes, setContextMenu, setNodes]);

  return {
    availableAssets,
    setAvailableAssets,
    canvasUploadRef: canvasUploadRef as RefObject<HTMLInputElement | null>,
    startCanvasUpload,
    handleCanvasUpload,
    saveNodesToAssets,
    selectNodeFromAssets,
    duplicateNode,
    copyNodes,
    duplicateNodesWithUpstream,
    renameNode,
    deleteNode,
    deleteNodes,
    moveNodeToCanvas,
    pasteToCanvas,
  };
}
