import { Controller, Get, Param, Query, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ContentService } from './content.service';

@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get('pages/:slug')
  @ApiOperation({ summary: 'Get a published content page' })
  async getPage(@Param('slug') slug: string) {
    return this.contentService.getPage(slug);
  }

  @Get('pages')
  @ApiOperation({ summary: 'List published content pages' })
  async listPages(@Query('type') type?: string) {
    return this.contentService.listPages(type);
  }

  @Get('faqs')
  @ApiOperation({ summary: 'Get all FAQ entries' })
  async getFAQs() {
    return this.contentService.getFAQs();
  }

  @Post('suburb-pages/generate')
  @ApiOperation({ summary: 'Generate a suburb landing page (draft, requires approval)' })
  async generateSuburbPage(
    @Body() body: { suburbName: string; state: string },
  ) {
    return this.contentService.generateSuburbPage(body.suburbName, body.state);
  }
}
