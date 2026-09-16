import { Global, Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionGuard } from "./session.guard";
import { SessionService } from "./session.service";

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionService, SessionGuard],
  exports: [SessionGuard, SessionService],
})
export class AuthModule {}
