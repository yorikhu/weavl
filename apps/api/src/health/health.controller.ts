import { Controller, Get } from '@nestjs/common';
import { verticalOf, validateSteps } from '@loom/shared';

@Controller('health')
export class HealthController {
  @Get()
  check(): Record<string, unknown> {
    // 引用 shared 包，验证 workspace 联动 + 契约类型可用
    const vertical = verticalOf('ecom.product-image');
    const stepsOk = validateSteps([
      { type: 'llm', id: 'script', prompt: '...' },
      { type: 'image-gen', id: 'cover' },
    ]);
    return {
      ok: true,
      service: 'loom-api',
      verticalDemo: vertical,
      stepsValidation: stepsOk === null ? 'passed' : stepsOk,
      timestamp: new Date().toISOString(),
    };
  }
}
