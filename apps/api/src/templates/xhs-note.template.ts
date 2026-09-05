import { TemplateManifest } from '@weavl/shared';

/**
 * 首个官方模板：商品小红书种草内容包
 * 对应产品设计 M1：商品素材 → 选题 → 文案 → 配图 → 检查 → 内容包
 */
export const xhsNoteTemplate: TemplateManifest = {
  id: 'ecom.xhs-note',
  vertical: 'ecom',
  name: '商品小红书种草内容包',
  category: 'image',
  price: 'standard',
  cost: { min: 0.15, max: 0.6 },

  inputs: [
    { type: 'text', name: 'productName', label: '商品名称', required: true, placeholder: '如：香薰蜡烛·雪松与海盐', maxLength: 40 },
    { type: 'textarea', name: 'sellingPoints', label: '核心卖点', required: true, placeholder: '3 个以内，逗号分隔。如：大豆蜡天然,燃烧无烟,留香 48h', maxLength: 200 },
    { type: 'text', name: 'audience', label: '目标人群', required: true, placeholder: '如：20-30 岁租房独居女性', maxLength: 60 },
    { type: 'select', name: 'tone', label: '品牌调性', required: true, options: [
      { value: 'warm', label: '温暖治愈' },
      { value: 'pro', label: '专业测评' },
      { value: 'trendy', label: '潮流种草' },
      { value: 'story', label: '生活故事' },
    ]},
    { type: 'text', name: 'priceBand', label: '价格带', placeholder: '如：¥89-129', maxLength: 20 },
    { type: 'textarea', name: 'notes', label: '补充要求（可选）', placeholder: '发布目标、避开的表达、必提的元素等', maxLength: 300 },
  ],

  steps: [
    { type: 'llm', id: 'topics', system: '你是小红书内容策划', prompt: '根据商品信息生成 3 个差异化的选题角度（标题方向+切入角度+互动点），输出 JSON 数组' },
    { type: 'llm', id: 'copywriting', system: '你是小红书爆款文案作者', prompt: '基于选定选题写笔记：标题(≤20字)+正文(300-800字)+话题标签，输出 3 版标注差异点' },
    { type: 'llm', id: 'cover-concept', system: '你是封面设计师', prompt: '基于选定文案生成 3 版封面方案：排版构图+主标语+用图建议' },
    { type: 'image-gen', id: 'cover', params: { ratio: '3:4' } },
    { type: 'llm', id: 'check', system: '你是内容合规审核员', prompt: '对成稿做 5 项检查：违禁词/广告法用语/平台规格/调性一致性/图片规范，输出报告' },
    { type: 'llm', id: 'package', system: '你是运营交付专家', prompt: '组装小红书发布内容包：标题/正文/封面/话题/发布时间建议' },
  ],

  gates: [
    { afterStep: 'topics', title: '确认选题方向', description: '方向错了后面全废——先选角度再继续', candidates: 3 },
    { afterStep: 'copywriting', title: '确认文案', description: '选 1 版，可微调后确认', candidates: 3 },
    { afterStep: 'cover', title: '确认封面画面', description: '确认封面方案，可要求重生成', candidates: 3 },
  ],

  output: {
    channel: 'xiaohongshu',
    fields: [
      { key: 'title', label: '标题', kind: 'title', fromStep: 'copywriting' },
      { key: 'body', label: '正文', kind: 'body', fromStep: 'copywriting' },
      { key: 'cover', label: '封面', kind: 'cover', fromStep: 'cover' },
      { key: 'topics', label: '话题标签', kind: 'topic', fromStep: 'copywriting' },
      { key: 'advice', label: '发布建议', kind: 'advice', fromStep: 'package' },
    ],
  },
};
