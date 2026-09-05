import {
  TemplateManifest,
  Step,
  CandidateArtifact,
  ConfirmationDecision,
  ContentPackage,
  RunView,
  RunStatus,
} from '@weavl/shared';

/**
 * 模拟引擎 —— 产出结构可信、内容够 demo 的候选产物。
 * 真实引擎接入时替换 mockStep 即可，状态机不动。
 */
const TONES: Record<string, string> = {
  warm: '温暖治愈', pro: '专业测评', trendy: '潮流种草', story: '生活故事',
};

const TOPIC_STYLES = ['测评型 · 数据与对比切入', '故事型 · 场景与情绪切入', '清单型 · 干货与合集切入'];
const COPY_STYLES = ['安利向 · 强情绪开头', '干货向 · 痛点解决方案', '氛围向 · 沉浸式描述'];

function mockStep(step: Step, ctx: RunContext, index: number): CandidateArtifact[] {
  const p = ctx.inputs;
  const product = String(p.productName ?? '商品');
  const tone = TONES[String(p.tone ?? 'warm')] ?? '温暖治愈';
  const points = String(p.sellingPoints ?? '').split(/[,，、]/).filter(Boolean).slice(0, 3);
  const audience = String(p.audience ?? '目标人群');

  const mk = (content: string, variantLabel: string): CandidateArtifact => ({
    id: `${ctx.runId}-${step.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    stepId: step.id,
    kind: step.type === 'image-gen' ? 'image' : step.id === 'topics' ? 'structured' : 'text',
    content,
    variantLabel,
    createdAt: new Date().toISOString(),
  });

  switch (step.id) {
    case 'topics':
      return TOPIC_STYLES.map((style) =>
        mk(JSON.stringify({
          style,
          title: `${style.split(' ·')[0]}｜${product}真实体验`,
          angle: `面向${audience}，围绕「${points[0] ?? '核心卖点'}」展开，制造「原来还能这样」的认知差`,
          hook: `${audience}最在意的问题开场，评论区引导「你们想要哪个测评」`,
        }), style),
      );
    case 'copywriting':
      return COPY_STYLES.map((style) =>
        mk([
          `【标题】${style.split(' ·')[0]}｜用了 3 周，${product}真的值得入吗`,
          ``,
          `【正文】`,
          `姐妹们，今天来交作业了。作为${audience}中的一员，我一直在找${points[0] ?? '品质在线'}的东西。`,
          ``,
          `先说结论：${points.join('、') || '整体表现超出预期'}，${tone}风格里它能排进我的年度清单。`,
          ``,
          `✅ 优点：`,
          ...(points.length ? points : ['品质稳定']).map((s: string) => `　· ${s}，实测没有翻车`),
          `　· 包装有质感，送人也不掉价`,
          ``,
          `⚠️ 小提醒：`,
          `　· 适合${audience}，如果你的需求不同建议先想清楚`,
          `　· ${p.priceBand ? `价格带${String(p.priceBand)}，蹲活动更香` : '建议蹲活动入手'}`,
          ``,
          `评论区告诉我你们还想看什么测评，下期安排～`,
          ``,
          `【话题标签】#好物分享 #${product.slice(0, 4)} #${audience.includes('女') ? '女生生活' : '品质生活'} #真实测评`,
        ].join('\n'), style),
      );
    case 'cover-concept':
    case 'cover':
      return ['大字报 · 主标语+商品特写', '场景感 · 使用场景+情绪光影', '对比图 · 前后对比+数据点'].map((style) =>
        mk(`3:4 封面方案：${style}｜主标语「${product} 真实测评」｜底图用商品图，标题压在上方 1/3`, style),
      );
    case 'check':
      return [mk(
        [
          `✅ 违禁词检查：通过（0 处）`,
          `✅ 广告法用语：通过（未检出「最/第一/绝对」类极限词）`,
          `✅ 平台规格：通过（标题 ${20} 字内，正文 800 字内，封面 3:4）`,
          `⚠️ 调性一致性：提示——文案情绪浓度与「${tone}」基本一致，注意话题标签别堆砌`,
          `✅ 图片规范：通过（AI 生成图将标注）`,
        ].join('\n'),
        '检查报告',
      )];
    case 'package':
      return [mk(
        `发布建议：工作日晚 20:00-22:00 或周末上午发布；封面用已确认版本；正文话题取已确认文案；首评自己置顶引导互动。`,
        '发布建议',
      )];
    default:
      return [mk(`（步骤 ${step.id} 的模拟产物）`, '模拟')];
  }
}

interface RunContext {
  runId: string;
  template: TemplateManifest;
  inputs: Record<string, unknown>;
}

/**
 * 运行时状态机。
 * pending → running → (gate) awaiting_confirmation → running → … → succeeded
 * regenerate → 重跑 gate 前那一步，回到 awaiting_confirmation
 */
export class RunEngine {
  private run: RunView & { ctx: RunContext; candidatesIndex: Map<string, CandidateArtifact>; packageVersion: number };

  constructor(id: string, template: TemplateManifest, inputs: Record<string, unknown>) {
    this.run = {
      id,
      templateId: template.id,
      status: 'pending' as RunStatus,
      completedSteps: 0,
      totalSteps: template.steps.length,
      decisions: [],
      ctx: { runId: id, template, inputs },
      candidatesIndex: new Map(),
      packageVersion: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /** 推进直到下一个确认门或结束 */
  start(): RunView {
    this.run.status = 'running';
    return this.advance();
  }

  private gateAfter(stepId: string) {
    return (this.run.ctx.template.gates ?? []).find((g) => g.afterStep === stepId);
  }

  private advance(): RunView {
    const { steps } = this.run.ctx.template;
    while (this.run.completedSteps < steps.length) {
      const step = steps[this.run.completedSteps];
      if (!step) break;
      const candidates = mockStep(step, this.run.ctx, this.run.completedSteps);
      candidates.forEach((c) => this.run.candidatesIndex.set(c.id, c));
      this.run.completedSteps += 1;
      this.touch();

      const gate = this.gateAfter(step.id);
      if (gate) {
        this.run.status = 'awaiting_confirmation';
        this.run.awaitingGate = gate.afterStep;
        this.run.candidates = candidates;
        this.touch();
        return this.view();
      }
    }
    this.finish();
    return this.view();
  }

  /** 用户决策：采纳/编辑采纳/重生成 */
  decide(decision: Omit<ConfirmationDecision, 'decidedAt' | 'gate'>): RunView {
    if (this.run.status !== 'awaiting_confirmation') throw new Error('当前不在确认门');
    const gate = (this.run.ctx.template.gates ?? []).find((g) => g.afterStep === this.run.awaitingGate);
    if (!gate) throw new Error('确认门不存在');
    const decision_: ConfirmationDecision = { ...decision, gate: gate.afterStep, decidedAt: new Date().toISOString() };
    this.run.decisions!.push(decision_);

    if (decision.action === 'regenerate') {
      // 回退一步重跑
      this.run.completedSteps -= 1;
      this.run.status = 'running';
      this.run.awaitingGate = undefined;
      this.run.candidates = undefined;
      this.touch();
      return this.advance();
    }

    this.run.status = 'running';
    this.run.awaitingGate = undefined;
    this.run.candidates = undefined;
    this.touch();
    return this.advance();
  }

  private finish() {
    const t = this.run.ctx.template;
    if (t.output) {
      this.run.packageVersion += 1;
      const fields = t.output.fields.map((f) => {
        // 找到该步骤被采纳的候选（或最后一个候选）
        const decided = this.run.decisions!.filter((d) => d.action !== 'regenerate');
        const stepCandidates = [...this.run.candidatesIndex.values()].filter((c) => c.stepId === f.fromStep);
        const picked = stepCandidates.find((c) => decided.some((d) => d.candidateId === c.id)) ?? stepCandidates.at(-1);
        return { key: f.key, label: f.label, kind: f.kind, value: picked?.content ?? '' };
      });
      const pkg: ContentPackage = {
        id: `${this.run.id}-pkg-v${this.run.packageVersion}`,
        runId: this.run.id,
        templateId: t.id,
        channel: t.output.channel,
        version: this.run.packageVersion,
        fields,
        files: [
          { name: '文案.txt', kind: 'text', content: fields.find((f) => f.key === 'body')?.value ?? '' },
          { name: '发布建议.md', kind: 'text', content: fields.find((f) => f.key === 'advice')?.value ?? '' },
        ],
        createdAt: new Date().toISOString(),
      };
      this.run.contentPackage = pkg;
    }
    this.run.status = 'succeeded';
    this.run.artifactUrls = [`/runs/${this.run.id}/package`];
    this.run.actualCost = Number((t.cost.min + Math.random() * (t.cost.max - t.cost.min)).toFixed(2));
    this.touch();
  }

  private touch() {
    this.run.updatedAt = new Date().toISOString();
  }

  view(): RunView {
    const { ctx, candidatesIndex, packageVersion, ...v } = this.run;
    return JSON.parse(JSON.stringify(v));
  }
}
