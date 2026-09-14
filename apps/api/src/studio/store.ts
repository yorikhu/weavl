import { Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { hashSync } from "bcryptjs";
import type {
  AgentConversation,
  AccountEvent,
  AccountPlanId,
  Asset,
  AssetKind,
  AssetSource,
  CanvasProject,
  Folder,
  ProjectFolder,
  MarketEntry,
  StudioUser,
  WorkflowDefinition,
  WorkflowRunRecord,
} from "@weavl/shared";

export interface StoredUser extends StudioUser {
  passwordHash: string;
}
export interface StoredSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
}
export interface StudioState {
  users: StoredUser[];
  sessions: StoredSession[];
  folders: Folder[];
  assets: Asset[];
  projects: CanvasProject[];
  projectFolders: ProjectFolder[];
  conversations: AgentConversation[];
  market: MarketEntry[];
  workflows: WorkflowDefinition[];
  workflowRuns: WorkflowRunRecord[];
  accounts: AccountRecord[];
}

export interface AccountRecord {
  userId: string;
  plan: AccountPlanId;
  credits: number;
  pendingPlan?: AccountPlanId;
  events: AccountEvent[];
}

export function welcomeAccount(userId: string, credits = 20): AccountRecord {
  return {
    userId,
    plan: "Free",
    credits,
    events: [
      {
        id: newId("event"),
        type: "credit",
        title: "体验积分",
        detail: "用于接入真实服务后的体验；当前模拟生成不扣积分。",
        delta: credits,
        createdAt: now(),
      },
    ],
  };
}

const now = () => new Date().toISOString();
export const newId = (prefix: string) => `${prefix}_${randomUUID()}`;

const seedMarket = (): MarketEntry[] => [
  {
    id: "official.skill.ip-position",
    ownerId: null,
    type: "skill",
    title: "人物定位访谈",
    description: "将零散访谈整理为人物标签、受众与内容支柱。",
    content: "请根据资料整理人物定位：经历、可信证据、目标受众、内容支柱与表达禁区。\n资料：{{资料}}",
    inputHint: "访谈记录或问卷",
    outputKind: "text",
    visibility: "official",
    version: 1,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "official.skill.script",
    ownerId: null,
    type: "skill",
    title: "口播脚本打磨",
    description: "按人物定位生成可拍摄的短视频口播脚本。",
    content: "先确定受众痛点，再写开场钩子、三段叙述、收束与行动建议；保留人物原有说话方式。",
    inputHint: "人物定位与选题",
    outputKind: "text",
    visibility: "official",
    version: 1,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "official.skill.brief",
    ownerId: null,
    type: "skill",
    title: "资料整理与提纲",
    description: "从上传资料提炼要点，形成可继续编辑的提纲。",
    content: "阅读引用资料，提炼目标、事实、约束、待确认问题和下一步提纲。",
    inputHint: "文档或文字资料",
    outputKind: "text",
    visibility: "official",
    version: 1,
    createdAt: now(),
    updatedAt: now(),
  },
];

const seedWorkflows = (): WorkflowDefinition[] => [
  {
    id: "official.ip-studio",
    ownerId: null,
    title: "人物 IP 内容策划",
    description: "从客户资料到定位、选题与口播脚本的审核式流程。当前运行使用模拟产物。",
    category: "内容运营",
    version: 1,
    status: "published",
    createdAt: now(),
    updatedAt: now(),
    fields: [
      { id: "person", label: "人物名称", type: "text", required: true },
      { id: "business", label: "业务与目标受众", type: "textarea", required: true },
      { id: "materials", label: "已有资料", type: "asset", required: false },
      { id: "tone", label: "表达风格", type: "select", required: true, options: ["专业克制", "亲切自然", "观点鲜明"] },
    ],
    stages: [
      {
        id: "brief",
        title: "资料梳理",
        instruction: "整理人物经历、业务与受众。",
        outputKind: "text",
        visibility: "summary",
      },
      {
        id: "position",
        title: "定位方案",
        instruction: "提出定位、人设和内容支柱。",
        outputKind: "text",
        visibility: "review",
      },
      {
        id: "topics",
        title: "选题规划",
        instruction: "列出适合启动的三个选题方向。",
        outputKind: "text",
        visibility: "preview",
      },
      {
        id: "script",
        title: "口播脚本",
        instruction: "完成一篇可拍摄的脚本。",
        outputKind: "text",
        visibility: "review",
      },
      {
        id: "delivery",
        title: "交付清单",
        instruction: "汇总后续拍摄与数字人制作所需材料。",
        outputKind: "text",
        visibility: "preview",
      },
    ],
  },
  {
    id: "official.weekly-brief",
    ownerId: null,
    title: "团队周报提炼",
    description: "把散乱的进度记录整理为管理层可读的摘要；验证非 IP 业务的扩展路径。",
    category: "办公效率",
    version: 1,
    status: "published",
    createdAt: now(),
    updatedAt: now(),
    fields: [
      { id: "team", label: "团队名称", type: "text", required: true },
      { id: "notes", label: "本周进度记录", type: "textarea", required: true },
    ],
    stages: [
      {
        id: "summary",
        title: "进度摘要",
        instruction: "提炼成果、问题和下周计划。",
        outputKind: "text",
        visibility: "review",
      },
      {
        id: "report",
        title: "周报文稿",
        instruction: "输出适合分享的简明周报。",
        outputKind: "text",
        visibility: "preview",
      },
    ],
  },
];

@Injectable()
export class StudioStore {
  private readonly file = resolve(process.env.WEAVL_MOCK_DATA_FILE || "./data/weavl.mock.json");
  private state: StudioState;

  constructor() {
    if (existsSync(this.file)) {
      this.state = JSON.parse(readFileSync(this.file, "utf8")) as StudioState;
    } else {
      const demo: StoredUser = {
        id: newId("user"),
        email: process.env.WEAVL_DEMO_EMAIL || "demo@weavl.local",
        name: "演示工作台",
        passwordHash: hashSync(process.env.WEAVL_DEMO_PASSWORD || "weavl1234", 10),
        createdAt: now(),
      };
      this.state = {
        users: [demo],
        sessions: [],
        folders: [],
        assets: [],
        projects: [],
        projectFolders: [],
        conversations: [],
        market: seedMarket(),
        workflows: seedWorkflows(),
        workflowRuns: [],
        accounts: [welcomeAccount(demo.id, 45)],
      };
      this.save();
    }
    if (!this.state.accounts) {
      this.state.accounts = this.state.users.map((user) =>
        welcomeAccount(user.id, user.email === (process.env.WEAVL_DEMO_EMAIL || "demo@weavl.local") ? 45 : 20),
      );
      this.save();
    }
    if (!this.state.projectFolders) {
      this.state.projectFolders = [];
      this.save();
    }
    // 旧版市场条目保留内容和 ID，仅统一归入 Skill。
    const legacyMarket = this.state.market as unknown as Array<{ type: string }>;
    if (legacyMarket.some((entry) => entry.type === "prompt")) {
      legacyMarket.forEach((entry) => {
        if (entry.type === "prompt") entry.type = "skill";
      });
      this.save();
    }
  }

  read(): StudioState {
    return this.state;
  }

  update<T>(change: (state: StudioState) => T): T {
    const result = change(this.state);
    this.save();
    return result;
  }

  private save(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    const temp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify(this.state, null, 2));
    renameSync(temp, this.file);
  }

  userFromToken(token?: string): StudioUser | null {
    if (!token) return null;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const session = this.state.sessions.find((item) => item.tokenHash === tokenHash && item.expiresAt > now());
    if (!session) return null;
    const user = this.state.users.find((item) => item.id === session.userId);
    if (!user) return null;
    const { passwordHash: _passwordHash, ...publicUser } = user;
    void _passwordHash;
    return publicUser;
  }

  createAsset(input: {
    ownerId: string;
    name: string;
    kind: AssetKind;
    source: AssetSource;
    sourceId?: string;
    folderId?: string | null;
    content: string;
    mimeType?: string;
  }): Asset {
    const timestamp = now();
    const version = {
      id: newId("version"),
      createdAt: timestamp,
      name: input.name,
      mimeType: input.mimeType || "text/plain",
      size: input.content.length,
      content: input.content,
    };
    const asset: Asset = {
      id: newId("asset"),
      ownerId: input.ownerId,
      folderId: input.folderId || null,
      name: input.name,
      kind: input.kind,
      source: input.source,
      sourceId: input.sourceId,
      versions: [version],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.update((state) => state.assets.push(asset));
    return asset;
  }
}
