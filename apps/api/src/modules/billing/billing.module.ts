import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { PricingConfigService } from "./pricing-config.service";
import { PricingService } from "./pricing.service";

/** 提供模型计价配置、积分预扣、消费落账和失败返还能力。 */
@Module({
  controllers: [BillingController],
  providers: [PricingService, PricingConfigService],
  exports: [PricingService],
})
export class BillingModule {}
