"use client";

import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Node } from "@xyflow/react";
import type { Asset, CanvasDocument, Folder as AssetFolder } from "@weavl/shared";
import {
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Film,
  FolderPlus,
  Funnel,
  Grid2X2,
  Image as ImageIcon,
  List,
  MoreHorizontal,
  Navigation2,
  Search,
  Upload,
} from "lucide-react";
import { Drawer } from "@/components/Drawer";
import { FolderVisual } from "@/components/FolderVisual";
import { Form } from "@/components/Form";
import { Modal } from "@/components/Modal";
import { Popover } from "@/components/Popover";
import { toast } from "@/hooks/useToast";
import { jsonBody, studioApi } from "@/lib/studioApi";
import { uploadAsset } from "@/utils/uploadAsset";
import styles from "./index.module.scss";

type AssetTab = "canvas" | "library";
type ViewMode = "list" | "grid";

interface CanvasAssetDrawerProps {
  open: boolean;
  header: ReactNode;
  nodes: Node[];
  assets: Asset[];
  canvases: CanvasDocument[];
  currentCanvasId: string | null;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
  onLocateNode: (nodeId: string) => void;
  onAddAsset: (asset: Asset) => void;
  onAssetAdded: (asset: Asset) => void;
  onAssetUpdated: (asset: Asset) => void;
  onAssetRemoved: (assetId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, canvasId: string) => Promise<void>;
  onRenameNode: (nodeId: string, name: string) => void;
  onDeleteNode: (nodeId: string) => void;
}

type AssetDialog = { kind: "move" | "rename" | "delete"; asset: Asset };
type NodeDialog = { kind: "move" | "rename" | "delete"; node: Node };

function flattenFolders(
  folders: AssetFolder[],
  parentId: string | null = null,
  depth = 0,
): Array<AssetFolder & { depth: number }> {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .flatMap((folder) => [{ ...folder, depth }, ...flattenFolders(folders, folder.id, depth + 1)]);
}

function nodeKind(node: Node) {
  const kind = (node.data as Record<string, unknown>).nodeKind;
  return typeof kind === "string" ? kind : "text";
}

function nodeName(node: Node) {
  const title = (node.data as Record<string, unknown>).title;
  return typeof title === "string" && title.trim() ? title : "未命名节点";
}

function Preview({ node }: { node: Node }) {
  const data = node.data as Record<string, unknown>;
  const kind = nodeKind(node);
  const url = typeof data.url === "string" ? data.url : "";
  if (kind === "image" && url)
    return <span className={styles.imagePreview} style={{ backgroundImage: `url(${url})` }} />;
  if (kind === "video" && url) return <video src={url} muted />;
  const Icon = kind === "image" ? ImageIcon : kind === "video" ? Film : FileText;
  return <Icon size={20} strokeWidth={1.4} />;
}

function AssetPreview({ asset }: { asset: Asset }) {
  const content = asset.versions.at(-1)?.content || "";
  if (asset.kind === "image" && content)
    return <span className={styles.imagePreview} style={{ backgroundImage: `url(${content})` }} />;
  if (asset.kind === "video" && content) return <video src={content} muted />;
  const Icon = asset.kind === "image" ? ImageIcon : asset.kind === "video" ? Film : FileText;
  return <Icon size={20} strokeWidth={1.4} />;
}

const KIND_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "text", label: "文本" },
  { value: "image", label: "图片" },
  { value: "video", label: "视频" },
  { value: "card", label: "其他" },
] as const;

type FilterKind = (typeof KIND_OPTIONS)[number]["value"];
interface TabFilterState {
  query: string;
  kind: FilterKind;
}

/** 画布项目资产管理器：统一浏览画布节点与全局资产，并同步节点选择和定位。 */
function CanvasAssetDrawerView({
  open,
  header,
  nodes,
  assets,
  canvases,
  currentCanvasId,
  onClose,
  onSelectNode,
  onLocateNode,
  onAddAsset,
  onAssetAdded,
  onAssetUpdated,
  onAssetRemoved,
  onDuplicateNode,
  onMoveNode,
  onRenameNode,
  onDeleteNode,
}: CanvasAssetDrawerProps) {
  const [tab, setTab] = useState<AssetTab>("canvas");
  const [tabFilters, setTabFilters] = useState<Record<AssetTab, TabFilterState>>({
    canvas: { query: "", kind: "all" },
    library: { query: "", kind: "all" },
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [view, setView] = useState<ViewMode>("list");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [folders, setFolders] = useState<AssetFolder[]>([]);
  const [assetMenuId, setAssetMenuId] = useState<string | null>(null);
  const [assetDialog, setAssetDialog] = useState<AssetDialog | null>(null);
  const [assetForm, setAssetForm] = useState({ name: "", folderId: "" });
  const [assetBusy, setAssetBusy] = useState(false);
  const [nodeMenuId, setNodeMenuId] = useState<string | null>(null);
  const [nodeDialog, setNodeDialog] = useState<NodeDialog | null>(null);
  const [nodeForm, setNodeForm] = useState({ name: "", canvasId: "" });
  const [nodeBusy, setNodeBusy] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderForm, setFolderForm] = useState({ name: "" });
  const [folderBusy, setFolderBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const { query, kind } = tabFilters[tab];
  const currentKindLabel = KIND_OPTIONS.find((option) => option.value === kind)?.label || "全部";

  const updateTabFilter = (patch: Partial<TabFilterState>) => {
    setTabFilters((current) => ({ ...current, [tab]: { ...current[tab], ...patch } }));
  };

  useEffect(() => {
    if (!open) return;
    void studioApi<AssetFolder[]>("/studio/folders")
      .then(setFolders)
      .catch(() => toast("资产文件夹加载失败"));
  }, [open]);
  const visibleNodes = useMemo(
    () =>
      nodes.filter((node) => {
        const itemKind = nodeKind(node);
        return (kind === "all" || itemKind === kind) && nodeName(node).toLowerCase().includes(query.toLowerCase());
      }),
    [kind, nodes, query],
  );
  const visibleAssets = useMemo(
    () =>
      assets.filter(
        (asset) =>
          asset.folderId === currentFolderId &&
          (kind === "all" || asset.kind === kind) &&
          asset.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [assets, currentFolderId, kind, query],
  );
  const visibleFolders = useMemo(
    () =>
      folders.filter(
        (folder) => folder.parentId === currentFolderId && folder.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [currentFolderId, folders, query],
  );
  const folderTrail = useMemo(() => {
    const trail: AssetFolder[] = [];
    const visited = new Set<string>();
    let folderId = currentFolderId;
    while (folderId && !visited.has(folderId)) {
      visited.add(folderId);
      const folder = folders.find((item) => item.id === folderId);
      if (!folder) break;
      trail.unshift(folder);
      folderId = folder.parentId;
    }
    return trail;
  }, [currentFolderId, folders]);
  const folderOptions = useMemo(() => flattenFolders(folders), [folders]);
  const groups = useMemo(() => {
    const grouped = new Map<string, { name: string; nodes: Node[] }>();
    const loose: Node[] = [];
    visibleNodes.forEach((node) => {
      const data = node.data as Record<string, unknown>;
      const groupId = typeof data.groupId === "string" ? data.groupId : "";
      if (!groupId) {
        loose.push(node);
        return;
      }
      const entry = grouped.get(groupId) || {
        name: typeof data.groupName === "string" && data.groupName ? data.groupName : "未命名分组",
        nodes: [],
      };
      entry.nodes.push(node);
      grouped.set(groupId, entry);
    });
    return { grouped: [...grouped.entries()], loose };
  }, [visibleNodes]);

  const selectNode = (nodeId: string) => {
    onSelectNode(nodeId);
    onLocateNode(nodeId);
  };

  const renderNode = (node: Node) => {
    return (
      <div
        key={node.id}
        role="button"
        tabIndex={0}
        className={`${styles.item} ${node.selected ? styles.selected : ""} ${nodeMenuId === node.id ? styles.itemMenuOpen : ""}`}
        onClick={() => selectNode(node.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectNode(node.id);
            onLocateNode(node.id);
          }
        }}
      >
        <span className={styles.preview}>
          <Preview node={node} />
        </span>
        <span className={styles.itemName}>{nodeName(node)}</span>
        <span className={styles.actions} onClick={(event) => event.stopPropagation()}>
          <Popover
            mode="click"
            variant="action"
            open={nodeMenuId === node.id}
            onOpenChange={(nextOpen) => setNodeMenuId(nextOpen ? node.id : null)}
            side="right"
            align="start"
            showArrow={false}
            trigger={
              <button type="button" className={styles.iconButton} aria-label={`更多：${nodeName(node)}`}>
                <MoreHorizontal size={15} />
              </button>
            }
          >
            {view === "grid" && (
              <button
                type="button"
                onClick={() => {
                  onSelectNode(node.id);
                  onLocateNode(node.id);
                  setNodeMenuId(null);
                }}
              >
                <Navigation2 size={13} className={styles.navigationIcon} />
                定位到节点
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onDuplicateNode(node.id);
                setNodeMenuId(null);
                toast("已添加节点副本", "success");
              }}
            >
              添加到画布
            </button>
            <button type="button" disabled={canvases.length <= 1} onClick={() => beginNodeAction("move", node)}>
              {canvases.length <= 1 ? "暂无其他画布" : "移动到"}
            </button>
            <button type="button" onClick={() => beginNodeAction("rename", node)}>
              重命名
            </button>
            <button type="button" className={styles.dangerAction} onClick={() => beginNodeAction("delete", node)}>
              删除
            </button>
          </Popover>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.locateButton}`}
            onClick={() => {
              onSelectNode(node.id);
              onLocateNode(node.id);
            }}
            aria-label="定位节点"
          >
            <Navigation2 size={15} strokeWidth={1.8} className={styles.navigationIcon} />
          </button>
        </span>
      </div>
    );
  };

  const beginNodeAction = (kind: NodeDialog["kind"], node: Node) => {
    setNodeMenuId(null);
    setNodeDialog({ kind, node });
    setNodeForm({
      name: nodeName(node),
      canvasId: canvases.find((canvas) => canvas.id !== currentCanvasId)?.id || "",
    });
  };

  const renameNode = () => {
    if (!nodeDialog || nodeDialog.kind !== "rename") return;
    const name = nodeForm.name.trim();
    if (!name) return;
    onRenameNode(nodeDialog.node.id, name);
    setNodeDialog(null);
    toast("节点已重命名", "success");
  };

  const moveNode = async () => {
    if (!nodeDialog || nodeDialog.kind !== "move" || !nodeForm.canvasId) return;
    setNodeBusy(true);
    try {
      await onMoveNode(nodeDialog.node.id, nodeForm.canvasId);
      setNodeDialog(null);
      toast("节点已移动到目标画布", "success");
    } catch (cause) {
      toast((cause as Error).message || "节点移动失败");
    } finally {
      setNodeBusy(false);
    }
  };

  const deleteNode = () => {
    if (!nodeDialog || nodeDialog.kind !== "delete") return;
    onDeleteNode(nodeDialog.node.id);
    setNodeDialog(null);
    toast("节点已删除", "success");
  };

  const beginAssetAction = (kind: AssetDialog["kind"], asset: Asset) => {
    setAssetMenuId(null);
    setAssetDialog({ kind, asset });
    setAssetForm({ name: asset.name, folderId: asset.folderId || "" });
  };

  const updateAsset = async (update: { name?: string; folderId?: string | null }) => {
    if (!assetDialog) return;
    setAssetBusy(true);
    try {
      const updated = await studioApi<Asset>(`/studio/assets/${assetDialog.asset.id}`, {
        method: "PATCH",
        body: jsonBody(update),
      });
      onAssetUpdated(updated);
      setAssetDialog(null);
      toast(update.name ? "资产已重命名" : "资产已移动", "success");
    } catch (cause) {
      toast((cause as Error).message || "资产更新失败");
    } finally {
      setAssetBusy(false);
    }
  };

  const deleteAsset = async () => {
    if (!assetDialog) return;
    setAssetBusy(true);
    try {
      await studioApi(`/studio/assets/${assetDialog.asset.id}`, { method: "DELETE" });
      onAssetRemoved(assetDialog.asset.id);
      setAssetDialog(null);
      toast("资产已移至回收站", "success");
    } catch (cause) {
      toast((cause as Error).message || "资产删除失败");
    } finally {
      setAssetBusy(false);
    }
  };

  const createFolder = async () => {
    const name = folderForm.name.trim();
    if (!name) return;
    setFolderBusy(true);
    try {
      const folder = await studioApi<AssetFolder>("/studio/folders", {
        method: "POST",
        body: jsonBody({ name, parentId: currentFolderId }),
      });
      setFolders((current) => [...current, folder]);
      setFolderForm({ name: "" });
      setFolderModalOpen(false);
      toast("文件夹已创建", "success");
    } catch (cause) {
      toast((cause as Error).message || "文件夹创建失败");
    } finally {
      setFolderBusy(false);
    }
  };

  const uploadAssets = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadBusy(true);
    try {
      const uploaded = await Promise.all(Array.from(files, (file) => uploadAsset(file, currentFolderId)));
      uploaded.forEach(onAssetAdded);
      toast(`${uploaded.length} 个资产已上传`, "success");
    } catch (cause) {
      toast((cause as Error).message || "资产上传失败");
    } finally {
      setUploadBusy(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  };

  const renderFolder = (folder: AssetFolder) => (
    <button
      key={folder.id}
      type="button"
      className={`${styles.item} ${styles.folderItem}`}
      onClick={() => setCurrentFolderId(folder.id)}
    >
      <span className={`${styles.preview} ${styles.folderPreview}`}>
        <FolderVisual size="small" />
      </span>
      <span className={styles.itemName}>{folder.name}</span>
      <ChevronRight className={styles.folderArrow} size={14} />
    </button>
  );

  return (
    <>
      <Drawer open={open} header={header} onClose={onClose} aria-label="项目资产管理">
        <div className={styles.tabs}>
          <button
            className={tab === "canvas" ? styles.activeTab : ""}
            onClick={() => {
              setTab("canvas");
              setFilterOpen(false);
            }}
          >
            画布
          </button>
          <button
            className={tab === "library" ? styles.activeTab : ""}
            onClick={() => {
              setTab("library");
              setFilterOpen(false);
            }}
          >
            资产
          </button>
        </div>
        <div className={`${styles.tools} ${tab === "library" ? styles.libraryTools : ""}`}>
          <label className={styles.search}>
            <Search size={14} />
            <Form.Input
              variant="bare"
              value={query}
              onChange={(event) => updateTabFilter({ query: event.target.value })}
              placeholder="搜索"
            />
          </label>
          <Popover
            mode="click"
            variant="action"
            open={filterOpen}
            onOpenChange={setFilterOpen}
            side="bottom"
            align="end"
            showArrow={false}
            hint={`当前筛选：${currentKindLabel}`}
            contentClassName={styles.filterPopover}
            trigger={
              <button type="button" className={`${styles.filterButton} ${kind !== "all" ? styles.filterActive : ""}`}>
                <Funnel size={14} />
              </button>
            }
          >
            {KIND_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={styles.filterOption}
                onClick={() => {
                  updateTabFilter({ kind: option.value });
                  setFilterOpen(false);
                }}
              >
                <span>{option.label}</span>
                {kind === option.value && <Check size={13} />}
              </button>
            ))}
          </Popover>
          {tab === "canvas" && (
            <div className={styles.viewSwitch}>
              <button
                className={view === "list" ? styles.activeView : ""}
                onClick={() => setView("list")}
                aria-label="列表展示"
              >
                <List size={14} />
              </button>
              <button
                className={view === "grid" ? styles.activeView : ""}
                onClick={() => setView("grid")}
                aria-label="宫格展示"
              >
                <Grid2X2 size={14} />
              </button>
            </div>
          )}
        </div>
        {tab === "library" && (
          <div className={styles.folderBar}>
            <nav className={styles.breadcrumbs} aria-label="资产文件夹路径">
              <button type="button" onClick={() => setCurrentFolderId(null)}>
                全部资产
              </button>
              {folderTrail.map((folder) => (
                <span key={folder.id}>
                  <ChevronRight size={11} />
                  <button type="button" onClick={() => setCurrentFolderId(folder.id)}>
                    {folder.name}
                  </button>
                </span>
              ))}
            </nav>
            <div className={styles.folderActions}>
              <input
                ref={uploadInputRef}
                type="file"
                multiple
                hidden
                onChange={(event) => void uploadAssets(event.target.files)}
              />
              <button
                type="button"
                className={styles.newFolderButton}
                disabled={uploadBusy}
                onClick={() => uploadInputRef.current?.click()}
              >
                <Upload size={14} />
                {uploadBusy ? "上传中" : "上传资产"}
              </button>
              <button
                type="button"
                className={styles.newFolderButton}
                onClick={() => {
                  setFolderForm({ name: "" });
                  setFolderModalOpen(true);
                }}
              >
                <FolderPlus size={14} />
                新建文件夹
              </button>
            </div>
          </div>
        )}
        <div className={`${styles.items} ${tab === "canvas" && view === "grid" ? styles.grid : ""}`}>
          {tab === "canvas" ? (
            visibleNodes.length ? (
              <>
                {groups.grouped.map(([groupId, group]) => (
                  <section className={styles.group} key={groupId}>
                    <button
                      type="button"
                      className={styles.groupTitle}
                      onClick={() =>
                        setCollapsedGroups((current) => {
                          const next = new Set(current);
                          if (next.has(groupId)) next.delete(groupId);
                          else next.add(groupId);
                          return next;
                        })
                      }
                    >
                      {collapsedGroups.has(groupId) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      <FolderVisual size="medium" open={!collapsedGroups.has(groupId)} />
                      <span>{group.name}</span>
                    </button>
                    {!collapsedGroups.has(groupId) && (
                      <div className={styles.groupItems}>{group.nodes.map(renderNode)}</div>
                    )}
                  </section>
                ))}
                {groups.loose.map(renderNode)}
              </>
            ) : (
              <p className={styles.empty}>没有匹配的画布节点。</p>
            )
          ) : visibleAssets.length || visibleFolders.length ? (
            <>
              {visibleFolders.map(renderFolder)}
              {visibleAssets.map((asset) => (
                <div
                  key={asset.id}
                  role="button"
                  tabIndex={0}
                  className={`${styles.item} ${assetMenuId === asset.id ? styles.itemMenuOpen : ""}`}
                  onClick={() => onAddAsset(asset)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onAddAsset(asset);
                    }
                  }}
                >
                  <span className={styles.preview}>
                    <AssetPreview asset={asset} />
                  </span>
                  <span className={styles.itemName}>{asset.name}</span>
                  <span className={styles.actions} onClick={(event) => event.stopPropagation()}>
                    <Popover
                      mode="click"
                      variant="action"
                      open={assetMenuId === asset.id}
                      onOpenChange={(nextOpen) => setAssetMenuId(nextOpen ? asset.id : null)}
                      side="right"
                      align="start"
                      showArrow={false}
                      contentClassName={styles.assetActionsPopover}
                      trigger={
                        <button type="button" className={styles.iconButton} aria-label={`更多：${asset.name}`}>
                          <MoreHorizontal size={15} />
                        </button>
                      }
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onAddAsset(asset);
                          setAssetMenuId(null);
                          toast("已添加到画布", "success");
                        }}
                      >
                        添加到画布
                      </button>
                      <button type="button" onClick={() => beginAssetAction("move", asset)}>
                        移动到
                      </button>
                      <button type="button" onClick={() => beginAssetAction("rename", asset)}>
                        重命名
                      </button>
                      <button
                        type="button"
                        className={styles.dangerAction}
                        onClick={() => beginAssetAction("delete", asset)}
                      >
                        删除
                      </button>
                    </Popover>
                  </span>
                </div>
              ))}
            </>
          ) : (
            <p className={styles.empty}>{query ? "当前文件夹中没有匹配内容。" : "当前文件夹是空的。"}</p>
          )}
        </div>
      </Drawer>
      <Modal
        open={nodeDialog?.kind === "rename"}
        title="重命名节点"
        busy={nodeBusy}
        onOpenChange={(nextOpen) => !nextOpen && setNodeDialog(null)}
      >
        <Form className={styles.assetDialogForm} values={nodeForm} onValuesChange={setNodeForm} onFinish={renameNode}>
          <Form.Input name="name" label="节点名称" maxLength={80} required autoFocus />
          <Modal.Footer>
            <Modal.Button type="button" variant="quiet" onClick={() => setNodeDialog(null)}>
              取消
            </Modal.Button>
            <Modal.Button type="submit" disabled={!nodeForm.name.trim()}>
              保存
            </Modal.Button>
          </Modal.Footer>
        </Form>
      </Modal>
      <Modal
        open={nodeDialog?.kind === "move"}
        title="移动节点"
        busy={nodeBusy}
        onOpenChange={(nextOpen) => !nextOpen && setNodeDialog(null)}
      >
        <Form className={styles.assetDialogForm} values={nodeForm} onValuesChange={setNodeForm} onFinish={moveNode}>
          <Form.Select name="canvasId" label="目标画布" required>
            {canvases
              .filter((canvas) => canvas.id !== currentCanvasId)
              .map((canvas) => (
                <option key={canvas.id} value={canvas.id}>
                  {canvas.name}
                </option>
              ))}
          </Form.Select>
          <Modal.Footer>
            <Modal.Button type="button" variant="quiet" disabled={nodeBusy} onClick={() => setNodeDialog(null)}>
              取消
            </Modal.Button>
            <Modal.Button type="submit" disabled={nodeBusy || !nodeForm.canvasId}>
              {nodeBusy ? "移动中…" : "移动"}
            </Modal.Button>
          </Modal.Footer>
        </Form>
      </Modal>
      <Modal
        mode="confirm"
        open={nodeDialog?.kind === "delete"}
        title="删除节点"
        description={`确定删除“${nodeDialog ? nodeName(nodeDialog.node) : "该节点"}”吗？相关连线也会一并删除。`}
        confirmLabel="删除"
        danger
        onOpenChange={(nextOpen) => !nextOpen && setNodeDialog(null)}
        onConfirm={deleteNode}
      />
      <Modal
        open={assetDialog?.kind === "rename"}
        title="重命名资产"
        busy={assetBusy}
        onOpenChange={(nextOpen) => !nextOpen && setAssetDialog(null)}
      >
        <Form
          className={styles.assetDialogForm}
          values={assetForm}
          onValuesChange={setAssetForm}
          onFinish={() => void updateAsset({ name: assetForm.name.trim() })}
        >
          <Form.Input name="name" label="资产名称" maxLength={180} required autoFocus />
          <Modal.Footer>
            <Modal.Button type="button" variant="quiet" disabled={assetBusy} onClick={() => setAssetDialog(null)}>
              取消
            </Modal.Button>
            <Modal.Button type="submit" disabled={assetBusy || !assetForm.name.trim()}>
              {assetBusy ? "保存中…" : "保存"}
            </Modal.Button>
          </Modal.Footer>
        </Form>
      </Modal>
      <Modal
        open={assetDialog?.kind === "move"}
        title="移动资产"
        busy={assetBusy}
        onOpenChange={(nextOpen) => !nextOpen && setAssetDialog(null)}
      >
        <Form
          className={styles.assetDialogForm}
          values={assetForm}
          onValuesChange={setAssetForm}
          onFinish={() => void updateAsset({ folderId: assetForm.folderId || null })}
        >
          <Form.Select name="folderId" label="目标文件夹">
            <option value="">未分类</option>
            {folderOptions.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {`${"　".repeat(folder.depth)}${folder.name}`}
              </option>
            ))}
          </Form.Select>
          <Modal.Footer>
            <Modal.Button type="button" variant="quiet" disabled={assetBusy} onClick={() => setAssetDialog(null)}>
              取消
            </Modal.Button>
            <Modal.Button type="submit" disabled={assetBusy}>
              {assetBusy ? "移动中…" : "移动"}
            </Modal.Button>
          </Modal.Footer>
        </Form>
      </Modal>
      <Modal
        mode="confirm"
        open={assetDialog?.kind === "delete"}
        title="删除资产"
        description={`确定将“${assetDialog?.asset.name || "该资产"}”移至回收站吗？`}
        confirmLabel="删除"
        danger
        busy={assetBusy}
        onOpenChange={(nextOpen) => !nextOpen && setAssetDialog(null)}
        onConfirm={deleteAsset}
      />
      <Modal open={folderModalOpen} title="新建文件夹" busy={folderBusy} onOpenChange={setFolderModalOpen}>
        <Form
          className={styles.assetDialogForm}
          values={folderForm}
          onValuesChange={setFolderForm}
          onFinish={createFolder}
        >
          <Form.Input name="name" label="文件夹名称" maxLength={80} required autoFocus />
          <Modal.Footer>
            <Modal.Button type="button" variant="quiet" disabled={folderBusy} onClick={() => setFolderModalOpen(false)}>
              取消
            </Modal.Button>
            <Modal.Button type="submit" disabled={folderBusy || !folderForm.name.trim()}>
              {folderBusy ? "创建中…" : "创建"}
            </Modal.Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}

/** 抽屉关闭时忽略画布逐帧的位置变化，避免隐藏列表跟随节点拖动反复渲染。 */
export const CanvasAssetDrawer = memo(CanvasAssetDrawerView, (previous, next) => !previous.open && !next.open);
