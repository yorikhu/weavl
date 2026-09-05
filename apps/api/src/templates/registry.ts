import { TemplateManifest, validateSteps, validateGates, validateOutput } from '@weavl/shared';
import { xhsNoteTemplate } from './xhs-note.template';

/**
 * 模板注册中心 —— "垂直 = 数据，不是代码"。
 * 注册即生效；每个模板必须通过契约校验。
 */
class TemplateRegistry {
  private templates = new Map<string, TemplateManifest>();

  register(t: TemplateManifest): void {
    const stepErr = validateSteps(t.steps);
    if (stepErr) throw new Error(`模板 ${t.id} 步骤校验失败: ${stepErr}`);
    const gateErr = validateGates(t.steps, t.gates ?? []);
    if (gateErr) throw new Error(`模板 ${t.id} 确认门校验失败: ${gateErr}`);
    const outErr = validateOutput(t.steps, t.output);
    if (outErr) throw new Error(`模板 ${t.id} 输出规范校验失败: ${outErr}`);
    this.templates.set(t.id, t);
  }

  list(): TemplateManifest[] {
    return [...this.templates.values()];
  }

  get(id: string): TemplateManifest | undefined {
    return this.templates.get(id);
  }
}

export const registry = new TemplateRegistry();

// 注册官方模板
registry.register(xhsNoteTemplate);
