import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { hashSync } from "bcryptjs";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  AccountEvent,
  AccountPlanId,
  AgentConversation,
  Asset,
  CanvasProject,
  Folder,
  MarketEntry,
  ProjectFolder,
  WorkflowDefinition,
  WorkflowRunRecord,
} from "@weavl/shared";
import { newId } from "../../common/id";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { ObjectStorageService } from "../storage/object-storage.service";

/** 旧版 JSON 数据文件的完整结构，仅用于首次迁移到 PostgreSQL。 */
type LegacyState = {
  users: Array<{ id: string; email: string; name: string; passwordHash: string; createdAt: string }>;
  sessions: Array<{ id: string; userId: string; tokenHash: string; expiresAt: string }>;
  accounts: Array<{
    userId: string;
    plan: AccountPlanId;
    credits: number;
    pendingPlan?: AccountPlanId;
    events: AccountEvent[];
  }>;
  folders: Folder[];
  assets: Asset[];
  projectFolders: ProjectFolder[];
  projects: CanvasProject[];
  conversations: AgentConversation[];
  market: MarketEntry[];
  workflows: WorkflowDefinition[];
  workflowRuns: WorkflowRunRecord[];
};

/**
 * 在空数据库首次启动时导入旧版 JSON 数据，或创建最小演示账号。
 *
 * @remarks
 * 这是旧存储向 PostgreSQL 与对象存储迁移的一次性兼容层，不参与正常业务
 * 读写，也不会持续同步 JSON 文件。只要 PostgreSQL 已存在任意用户，启动时便
 * 直接跳过。旧数据中的 Data URL 资产与项目封面会写入对象存储，其余结构化
 * 数据会按依赖顺序写入 PostgreSQL。
 */
@Injectable()
export class LegacyImportService implements OnApplicationBootstrap {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
  ) {}
  /**
   * 在 NestJS 完成应用初始化后执行一次空库引导。
   *
   * @remarks
   * PostgreSQL 已有用户时不做任何操作。空库时优先读取
   * `WEAVL_MOCK_DATA_FILE` 指定的旧数据文件；未配置时读取
   * `./data/weavl.mock.json`。文件不存在则创建演示账号。
   *
   * @returns 数据导入、演示账号创建或空库检查完成后的 Promise。
   */
  async onApplicationBootstrap() {
    if (await this.prisma.user.count()) return;
    const path = resolve(process.env.WEAVL_MOCK_DATA_FILE || "./data/weavl.mock.json");
    if (existsSync(path)) await this.import(JSON.parse(await readFile(path, "utf8")) as LegacyState);
    else await this.seedDemo();
  }

  /**
   * 为全新安装创建可登录的演示账号、免费账户与初始积分流水。
   *
   * @remarks
   * 账号密码优先读取 `WEAVL_DEMO_EMAIL` 与 `WEAVL_DEMO_PASSWORD`；默认值仅
   * 用于本地开发。该方法只会由空库引导流程调用。
   *
   * @returns 演示账号及其关联记录写入完成后的 Promise。
   */
  private async seedDemo() {
    await this.prisma.user.create({
      data: {
        id: newId("user"),
        email: process.env.WEAVL_DEMO_EMAIL || "demo@weavl.local",
        name: "演示工作台",
        passwordHash: hashSync(process.env.WEAVL_DEMO_PASSWORD || "weavl1234", 10),
        account: { create: { plan: "Free", credits: 45 } },
        accountEvents: {
          create: {
            id: newId("event"),
            type: "credit",
            title: "体验积分",
            detail: "用于接入真实服务后的体验。",
            delta: 45,
          },
        },
      },
    });
  }

  /**
   * 将旧版 JSON 状态按外键依赖顺序迁移到 PostgreSQL 与对象存储。
   *
   * @remarks
   * 导入顺序为用户与会话、账户、资产目录与资产、项目与画布、Agent 会话、
   * Skill、工作流及运行记录。资产版本和 Data URL 项目封面会先持久化到对象
   * 存储，再把返回的 URL 与 storage key 写入数据库。
   *
   * @param state - 从旧版 `weavl.mock.json` 解析出的完整应用状态。
   * @returns 全部旧数据迁移完成后的 Promise。
   */
  private async import(state: LegacyState) {
    await this.prisma.user.createMany({
      data: state.users.map((x) => ({
        id: x.id,
        email: x.email,
        name: x.name,
        passwordHash: x.passwordHash,
        createdAt: new Date(x.createdAt),
      })),
      skipDuplicates: true,
    });
    await this.prisma.session.createMany({
      data: (state.sessions || []).map((x) => ({
        id: x.id,
        userId: x.userId,
        tokenHash: x.tokenHash,
        expiresAt: new Date(x.expiresAt),
      })),
      skipDuplicates: true,
    });
    for (const account of state.accounts || []) {
      await this.prisma.account.create({
        data: {
          userId: account.userId,
          plan: account.plan,
          credits: account.credits,
          pendingPlan: account.pendingPlan,
        },
      });
      if (account.events.length)
        await this.prisma.accountEvent.createMany({
          data: account.events.map((x) => ({
            id: x.id,
            userId: account.userId,
            type: x.type,
            title: x.title,
            detail: x.detail,
            delta: x.delta,
            readAt: x.readAt ? new Date(x.readAt) : null,
            createdAt: new Date(x.createdAt),
          })),
        });
    }
    if (state.folders?.length)
      await this.prisma.assetFolder.createMany({
        data: state.folders.map((x) => ({
          id: x.id,
          ownerId: x.ownerId,
          parentId: x.parentId,
          name: x.name,
          createdAt: new Date(x.createdAt),
        })),
      });
    for (const asset of state.assets || []) {
      const versions = [];
      for (const version of asset.versions) {
        const stored = await this.storage.persist(version.content, version.mimeType, `assets/${asset.ownerId}`);
        versions.push({
          id: version.id,
          name: version.name,
          mimeType: stored.mimeType,
          size: BigInt(stored.size),
          content: stored.content,
          storageKey: stored.storageKey,
          createdAt: new Date(version.createdAt),
        });
      }
      await this.prisma.asset.create({
        data: {
          id: asset.id,
          ownerId: asset.ownerId,
          folderId: asset.folderId,
          name: asset.name,
          kind: asset.kind,
          source: asset.source,
          sourceId: asset.sourceId,
          inLibrary: asset.inLibrary ?? asset.source === "personal",
          deletedAt: asset.deletedAt ? new Date(asset.deletedAt) : null,
          createdAt: new Date(asset.createdAt),
          updatedAt: new Date(asset.updatedAt),
          versions: { create: versions },
        },
      });
    }
    if (state.projectFolders?.length)
      await this.prisma.projectFolder.createMany({
        data: state.projectFolders.map((x) => ({
          id: x.id,
          ownerId: x.ownerId,
          name: x.name,
          createdAt: new Date(x.createdAt),
        })),
      });
    for (const project of state.projects || []) {
      let coverUrl = project.coverUrl || null,
        coverStorageKey: null | string = null;
      if (coverUrl?.startsWith("data:")) {
        const stored = await this.storage.persist(coverUrl, "image/webp", `covers/${project.ownerId}`);
        coverUrl = stored.content;
        coverStorageKey = stored.storageKey;
      }
      await this.prisma.project.create({
        data: {
          id: project.id,
          ownerId: project.ownerId,
          folderId: project.folderId || null,
          name: project.name,
          coverUrl,
          coverStorageKey,
          deletedAt: project.deletedAt ? new Date(project.deletedAt) : null,
          createdAt: new Date(project.createdAt),
          updatedAt: new Date(project.updatedAt),
          canvases: {
            create: project.canvases.map((x, position) => ({
              id: x.id,
              name: x.name,
              nodes: x.nodes as Prisma.InputJsonValue,
              edges: x.edges as Prisma.InputJsonValue,
              viewport: x.viewport,
              position,
              updatedAt: new Date(x.updatedAt),
            })),
          },
        },
      });
    }
    for (const conversation of state.conversations || []) {
      await this.prisma.conversation.create({
        data: {
          id: conversation.id,
          ownerId: conversation.ownerId,
          projectId: conversation.projectId,
          title: conversation.title,
          archived: conversation.archived,
          createdAt: new Date(conversation.createdAt),
          updatedAt: new Date(conversation.updatedAt),
          messages: {
            create: conversation.messages.map((message) => ({
              id: message.id,
              role: message.role,
              content: message.content,
              createdAt: new Date(message.createdAt),
              assetRefs: {
                create: message.assetRefs.map((ref) => ({ assetId: ref.assetId, versionId: ref.versionId })),
              },
            })),
          },
        },
      });
    }
    if (state.market?.length)
      await this.prisma.skill.createMany({
        data: state.market.map((x) => ({
          id: x.id,
          ownerId: x.ownerId,
          title: x.title,
          description: x.description,
          content: x.content,
          inputHint: x.inputHint,
          outputKind: x.outputKind,
          visibility: x.visibility,
          version: x.version,
          createdAt: new Date(x.createdAt),
          updatedAt: new Date(x.updatedAt),
        })),
      });
    if (state.workflows?.length)
      await this.prisma.workflow.createMany({
        data: state.workflows.map((x) => ({
          id: x.id,
          ownerId: x.ownerId,
          title: x.title,
          description: x.description,
          category: x.category,
          version: x.version,
          status: x.status,
          fields: x.fields as Prisma.InputJsonValue,
          stages: x.stages as Prisma.InputJsonValue,
          graph: x.graph as Prisma.InputJsonValue | undefined,
          createdAt: new Date(x.createdAt),
          updatedAt: new Date(x.updatedAt),
        })),
      });
    if (state.workflowRuns?.length)
      await this.prisma.workflowRun.createMany({
        data: state.workflowRuns.map((x) => ({
          id: x.id,
          ownerId: x.ownerId,
          workflowId: x.workflowId,
          workflowVersion: x.workflowVersion,
          definitionSnapshot: x.definitionSnapshot as Prisma.InputJsonValue | undefined,
          projectId: x.projectId,
          inputs: x.inputs,
          status: x.status,
          stages: x.stages as Prisma.InputJsonValue,
          currentStage: x.currentStage,
          createdAt: new Date(x.createdAt),
          updatedAt: new Date(x.updatedAt),
        })),
      });
  }
}
