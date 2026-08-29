import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  SolutionsService,
  CreateSolutionDto,
  UpdateSolutionDto,
} from './solutions.service';

@Controller('api/solutions')
@UseGuards(JwtAuthGuard)
export class SolutionsController {
  constructor(private solutionsService: SolutionsService) {}

  @Get()
  findAll() {
    return this.solutionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.solutionsService.findOne(+id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  create(@Body() dto: CreateSolutionDto) {
    return this.solutionsService.create(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  update(@Param('id') id: string, @Body() dto: UpdateSolutionDto) {
    return this.solutionsService.update(+id, dto);
  }

  @Delete('bulk')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  bulkRemove(@Body() body: { ids: number[] }) {
    return this.solutionsService.bulkRemove(body.ids);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  remove(@Param('id') id: string) {
    return this.solutionsService.remove(+id);
  }
}
