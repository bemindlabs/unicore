import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { ProvisioningService } from "./provisioning.service";
import { ProvisionRequestDto } from "../dto/provision-request.dto";

@Controller("provision")
export class ProvisioningController {
  constructor(private readonly provisioningService: ProvisioningService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async provision(@Body() request: ProvisionRequestDto) {
    return this.provisioningService.provision(request);
  }
}
