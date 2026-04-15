import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/config/prisma.service';

@Injectable()
export class ContentService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get a published content page by slug
   */
  async getPage(slug: string) {
    const page = await this.prisma.contentPage.findUnique({
      where: { slug, status: 'published' },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  /**
   * List all published pages of a type
   */
  async listPages(type?: string) {
    const where: any = { status: 'published' };
    if (type) where.type = type;

    return this.prisma.contentPage.findMany({
      where,
      select: {
        id: true,
        slug: true,
        type: true,
        title: true,
        metaTitle: true,
        metaDescription: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: 'desc' },
    });
  }

  /**
   * Get FAQ pages
   */
  async getFAQs() {
    const pages = await this.prisma.contentPage.findMany({
      where: { type: 'faq', status: 'published' },
      select: { title: true, body: true, slug: true },
      orderBy: { title: 'asc' },
    });

    return pages.map((p) => ({
      question: p.title,
      answer: p.body,
      slug: p.slug,
    }));
  }

  /**
   * Generate SEO-optimised suburb landing page content via AI
   * (OASIS-IS governed — requires human approval before publish)
   */
  async generateSuburbPage(suburbName: string, state: string) {
    // In production: call OpenAI / agent orchestrator
    // For now: return structured template
    return {
      slug: `${suburbName.toLowerCase()}-${state.toLowerCase()}`,
      type: 'suburb',
      title: `Professional Cleaning Services in ${suburbName}, ${state}`,
      metaTitle: `Cleaning Services ${suburbName} | SparkleClean Pro`,
      metaDescription: `Trusted cleaning services in ${suburbName}, ${state}. Regular, deep, end-of-lease & commercial cleaning. Get an instant quote today.`,
      status: 'draft',
      body: `# Professional Cleaning in ${suburbName}\n\nSparkleClean Pro offers premium residential and commercial cleaning services across ${suburbName}, ${state}.`,
      requireHumanApproval: true,
    };
  }
}
