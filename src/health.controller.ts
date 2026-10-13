import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @ApiOperation({ summary: 'Check API liveness' })
  @ApiOkResponse({
    description: 'API is running',
    schema: { example: { status: 'ok', app: 'bookstore-backend', stage: 'starter' } },
  })
  @Get() health() { return { status: 'ok', app: 'bookstore-backend', stage: 'starter' }; }
}
