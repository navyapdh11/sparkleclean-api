import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/config/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

interface XeroContact {
  ContactID: string;
  Name: string;
  EmailAddress: string;
}

interface XeroLineItem {
  Description: string;
  Quantity: number;
  UnitAmount: number;
  AccountCode: string;
  TaxType: string;
}

@Injectable()
export class XeroService {
  private readonly logger = new Logger(XeroService.name);
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  private readonly tenantId = process.env.XERO_TENANT_ID;
  private readonly clientId = process.env.XERO_CLIENT_ID;
  private readonly clientSecret = process.env.XERO_CLIENT_SECRET;

  constructor(private prisma: PrismaService) {}

  /**
   * Get or refresh Xero OAuth2 token
   */
  private async ensureToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt && this.tokenExpiresAt > new Date()) {
      return this.accessToken;
    }

    // In production: use refresh token flow
    // For now: env-provided access token
    const token = process.env.XERO_ACCESS_TOKEN;
    if (!token) {
      this.logger.warn('XERO_ACCESS_TOKEN not configured — Xero sync disabled');
      return '';
    }

    this.accessToken = token;
    this.tokenExpiresAt = new Date(Date.now() + 3600000); // 1 hour
    return token;
  }

  /**
   * Make authenticated request to Xero API
   */
  private async xeroRequest(method: string, path: string, body?: any): Promise<any> {
    const token = await this.ensureToken();
    if (!token || !this.tenantId) return null;

    const url = `https://api.xero.com/api.xro/2.0${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Xero-tenant-id': this.tenantId,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Xero API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Find or create a Xero contact for a customer
   */
  async findOrCreateContact(customer: any): Promise<XeroContact | null> {
    const email = customer.email;
    if (!email) return null;

    // Search existing
    const searchResult = await this.xeroRequest('GET', `/Contacts?where=EmailAddress=="${email}"`);
    const existing = searchResult?.Contacts?.[0];
    if (existing) return existing;

    // Create new contact
    const contactData = {
      Contacts: [
        {
          Name: `${customer.firstName} ${customer.lastName}`,
          EmailAddress: email,
          FirstName: customer.firstName,
          LastName: customer.lastName,
        },
      ],
    };

    const result = await this.xeroRequest('PUT', '/Contacts', contactData);
    return result?.Contacts?.[0] ?? null;
  }

  /**
   * Create an invoice in Xero for a booking
   */
  async createInvoice(invoice: any): Promise<string | null> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: invoice.bookingId },
      include: { customer: { include: { user: true } } },
    });
    if (!booking) return null;

    // Find or create Xero contact
    const contact = await this.findOrCreateContact(booking.customer);
    if (!contact) return null;

    // Build line items
    const service = await this.prisma.service.findUnique({
      where: { id: booking.serviceId },
    });

    const lineItems: XeroLineItem[] = [
      {
        Description: `${service?.name ?? 'Cleaning Service'} — ${booking.bookingNumber}`,
        Quantity: 1,
        UnitAmount: booking.basePrice,
        AccountCode: '200', // Sales (AU)
        TaxType: 'OUTPUT2', // GST 10% AU
      },
    ];

    // Add GST line if not inclusive
    if (!service?.gstInclusive) {
      lineItems.push({
        Description: 'GST (10%)',
        Quantity: 1,
        UnitAmount: booking.gstAmount,
        AccountCode: '220', // GST Payable
        TaxType: 'NONE',
      });
    }

    const invoiceData = {
      Invoices: [
        {
          Type: 'ACCREC', // Accounts Receivable
          Contact: { ContactID: contact.ContactID },
          Date: new Date().toISOString().split('T')[0],
          DueDate: new Date(booking.scheduledDate).toISOString().split('T')[0],
          LineAmountTypes: 'Inclusive',
          LineItems: lineItems,
          Reference: booking.bookingNumber,
          Status: invoice.status === 'paid' ? 'PAID' : 'AUTHORISED',
        },
      ],
    };

    const result = await this.xeroRequest('PUT', '/Invoices', invoiceData);
    const xeroInvoiceId = result?.Invoices?.[0]?.InvoiceID;

    if (xeroInvoiceId) {
      await this.prisma.invoice.updateMany({
        where: { invoiceNumber: invoice.invoiceNumber },
        data: { xeroInvoiceId },
      });
    }

    return xeroInvoiceId ?? null;
  }

  /**
   * Mark invoice as paid in Xero
   */
  async markInvoicePaid(xeroInvoiceId: string, amount: number): Promise<boolean> {
    const paymentData = {
      Amount: amount,
      Date: new Date().toISOString().split('T')[0],
      Invoice: { InvoiceID: xeroInvoiceId },
      Account: { Code: '001' }, // Bank Account
    };

    try {
      await this.xeroRequest('PUT', '/Payments', paymentData);
      return true;
    } catch (err) {
      this.logger.error(`Failed to mark Xero invoice paid: ${err}`);
      return false;
    }
  }

  /**
   * Cron: sync unsynced invoices to Xero every 15 min
   */
  @Cron(CronExpression.EVERY_15_MINUTES)
  async syncPendingInvoices() {
    if (!this.tenantId) return; // Xero not configured

    const invoices = await this.prisma.invoice.findMany({
      where: { xeroInvoiceId: null },
      include: { customer: true, booking: true },
      take: 50,
    });

    this.logger.log(`🔄 Syncing ${invoices.length} pending invoices to Xero`);

    for (const invoice of invoices) {
      try {
        const xeroId = await this.createInvoice(invoice);
        if (xeroId && invoice.status === 'paid') {
          await this.markInvoicePaid(xeroId, invoice.total);
        }
      } catch (err) {
        this.logger.error(`Failed to sync invoice ${invoice.invoiceNumber}: ${err}`);
      }
    }
  }

  /**
   * Sync payment status to Xero
   */
  async syncPaymentToXero(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          include: {
            invoices: { where: { xeroInvoiceId: { not: null } } },
          },
        },
      },
    });
    if (!payment) return;

    for (const invoice of payment.booking.invoices) {
      if (invoice.xeroInvoiceId && payment.status === 'PAID') {
        await this.markInvoicePaid(invoice.xeroInvoiceId, payment.amount);
      }
    }
  }
}
