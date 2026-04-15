import { PrismaClient, Prisma, ServiceCategory, BookingFrequency } from '@prisma/client';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════
// AU SUBURBS (Perth metro - seed sample)
// ═══════════════════════════════════════════════════════════
const SUBURBS = [
  { name: 'Perth', state: 'WA', postcode: '6000', slug: 'perth-wa-6000' },
  { name: 'Fremantle', state: 'WA', postcode: '6160', slug: 'fremantle-wa-6160' },
  { name: 'Joondalup', state: 'WA', postcode: '6027', slug: 'joondalup-wa-6027' },
  { name: 'Rockingham', state: 'WA', postcode: '6168', slug: 'rockingham-wa-6168' },
  { name: 'Armadale', state: 'WA', postcode: '6112', slug: 'armadale-wa-6112' },
  { name: 'Subiaco', state: 'WA', postcode: '6008', slug: 'subiaco-wa-6008' },
  { name: 'Cottesloe', state: 'WA', postcode: '6011', slug: 'cottesloe-wa-6011' },
  { name: 'Scarborough', state: 'WA', postcode: '6019', slug: 'scarborough-wa-6019' },
  { name: 'Mount Lawley', state: 'WA', postcode: '6050', slug: 'mount-lawley-wa-6050' },
  { name: 'Victoria Park', state: 'WA', postcode: '6100', slug: 'victoria-park-wa-6100' },
  { name: 'Leederville', state: 'WA', postcode: '6007', slug: 'leederville-wa-6007' },
  { name: 'Northbridge', state: 'WA', postcode: '6003', slug: 'northbridge-wa-6003' },
  { name: 'South Perth', state: 'WA', postcode: '6151', slug: 'south-perth-wa-6151' },
  { name: 'Claremont', state: 'WA', postcode: '6010', slug: 'claremont-wa-6010' },
  { name: 'Nedlands', state: 'WA', postcode: '6009', slug: 'nedlands-wa-6009' },
];

// ═══════════════════════════════════════════════════════════
// SERVICES
// ═══════════════════════════════════════════════════════════
const SERVICES: {
  category: ServiceCategory;
  name: string;
  description: string;
  basePrice: number;
  pricePerHour: number;
  pricePerBedroom: number;
  pricePerBathroom: number;
  minDurationMin: number;
  pricePerSqm: number;
  includes: string[];
  excludedAreas: string[];
  gstInclusive: boolean;
}[] = [
  {
    category: 'REGULAR',
    name: 'Regular House Clean',
    description: 'Scheduled cleaning with your dedicated cleaner. Kitchen, bathrooms, living areas, and bedrooms.',
    basePrice: 129,
    pricePerHour: 45,
    pricePerBedroom: 15,
    pricePerBathroom: 20,
    minDurationMin: 120,
    pricePerSqm: 0.5,
    includes: ['Kitchen surfaces & floors', 'Bathroom sanitisation', 'Vacuum & mop', 'Dusting', 'Trash removal'],
    excludedAreas: ['Inside oven', 'Inside fridge', 'Windows (exterior)', 'Laundry fold'],
    gstInclusive: true,
  },
  {
    category: 'DEEP',
    name: 'Deep Clean',
    description: 'Thorough top-to-bottom clean. Ideal for first-time bookings or seasonal refresh.',
    basePrice: 249,
    pricePerHour: 55,
    pricePerBedroom: 25,
    pricePerBathroom: 30,
    minDurationMin: 180,
    pricePerSqm: 0.8,
    includes: ['Everything in Regular', 'Inside cabinets', 'Skirting boards', 'Light fixtures', 'Behind furniture'],
    excludedAreas: ['Roof void', 'Outside windows > 2m'],
    gstInclusive: true,
  },
  {
    category: 'END_OF_LEASE',
    name: 'End of Lease / Bond Clean',
    description: 'Bond-back guaranteed clean. Meets REIWA checklist standards.',
    basePrice: 399,
    pricePerHour: 60,
    pricePerBedroom: 40,
    pricePerBathroom: 50,
    minDurationMin: 240,
    pricePerSqm: 1.0,
    includes: ['Full deep clean', 'Oven interior', 'Fridge interior', 'Carpet spot clean', 'Window tracks', 'Blinds dust'],
    excludedAreas: ['Professional carpet steam (can add)', 'Pest treatment', 'Garden cleanup'],
    gstInclusive: true,
  },
  {
    category: 'COMMERCIAL',
    name: 'Office / Commercial Clean',
    description: 'After-hours cleaning for offices, retail, and warehouses across Perth metro.',
    basePrice: 199,
    pricePerHour: 50,
    pricePerBedroom: 0,
    pricePerBathroom: 25,
    minDurationMin: 150,
    pricePerSqm: 0.7,
    includes: ['Desks & surfaces', 'Kitchen/breakout areas', 'Restrooms', 'Vacuum/mop', 'Bins emptied'],
    excludedAreas: ['High-rise windows', 'Carpet shampoo', 'External facades'],
    gstInclusive: true,
  },
  {
    category: 'CARPET',
    name: 'Carpet Steam Clean',
    description: 'Hot water extraction carpet cleaning. Stain treatment included.',
    basePrice: 149,
    pricePerHour: 65,
    pricePerBedroom: 30,
    pricePerBathroom: 0,
    minDurationMin: 90,
    pricePerSqm: 3.5,
    includes: ['Hot water extraction', 'Stain pre-treatment', 'Deodoriser', 'Quick dry'],
    excludedAreas: ['Delicate rugs', 'Outdoor carpets'],
    gstInclusive: true,
  },
  {
    category: 'WINDOW',
    name: 'Window Clean',
    description: 'Interior & exterior window cleaning. Frames and tracks included.',
    basePrice: 99,
    pricePerHour: 55,
    pricePerBedroom: 0,
    pricePerBathroom: 0,
    minDurationMin: 60,
    pricePerSqm: 0,
    includes: ['Interior glass', 'Exterior glass (ground + 1st floor)', 'Frames & tracks', 'Sills'],
    excludedAreas: ['Windows > 6m height', 'Solar panels', 'Skylights'],
    gstInclusive: true,
  },
  {
    category: 'OVEN',
    name: 'Oven Deep Clean',
    description: 'Full oven interior & exterior degrease. Racks, trays, and doors.',
    basePrice: 89,
    pricePerHour: 60,
    pricePerBedroom: 0,
    pricePerBathroom: 0,
    minDurationMin: 60,
    pricePerSqm: 0,
    includes: ['Interior degrease', 'Racks & trays', 'Glass door panels', 'Exterior polish'],
    excludedAreas: ['Self-clean cycle activation', 'Gas line disconnection'],
    gstInclusive: true,
  },
  {
    category: 'FRIDGE',
    name: 'Fridge Deep Clean',
    description: 'Full fridge interior clean. Shelves, drawers, and seals sanitised.',
    basePrice: 79,
    pricePerHour: 55,
    pricePerBedroom: 0,
    pricePerBathroom: 0,
    minDurationMin: 45,
    pricePerSqm: 0,
    includes: ['Interior sanitisation', 'Shelf cleaning', 'Drawer cleaning', 'Seal wipe', 'Exterior polish'],
    excludedAreas: ['Motor compartment', 'Freon system'],
    gstInclusive: true,
  },
];

// ═══════════════════════════════════════════════════════════
// PRICING RULES
// ═══════════════════════════════════════════════════════════
const PRICING_RULES = [
  { frequency: BookingFrequency.ONCE, discountPct: 0 },
  { frequency: BookingFrequency.WEEKLY, discountPct: 20 },
  { frequency: BookingFrequency.FORTNIGHTLY, discountPct: 15 },
  { frequency: BookingFrequency.MONTHLY, discountPct: 10 },
];

// ═══════════════════════════════════════════════════════════
// AGENT CONFIGS (OASIS-IS governed)
// ═══════════════════════════════════════════════════════════
const AGENT_CONFIGS = [
  {
    role: 'SEO_CONTENT' as const,
    name: 'SEO Content Agent',
    description: 'Generates and optimises suburb landing pages and FAQ content',
    enabled: true,
    config: { model: 'gpt-4', maxTokens: 4000, temperature: 0.7 },
    allowedResources: ['content', 'faqs', 'suburbs', 'analytics'],
    deniedResources: ['payments', 'customer_pii', 'audit_logs'],
    geoScope: 'all',
    requireHumanApproval: true,
  },
  {
    role: 'SUPPORT_TRIAGE' as const,
    name: 'Support Triage Agent',
    description: 'Classifies and routes customer support tickets',
    enabled: true,
    config: { model: 'gpt-3.5-turbo', maxTokens: 2000, temperature: 0.3 },
    allowedResources: ['faqs', 'bookings', 'policies'],
    deniedResources: ['pricing', 'cleaner_assignments'],
    geoScope: 'customer_suburb',
    requireHumanApproval: true,
  },
  {
    role: 'ROUTE_OPTIMIZER' as const,
    name: 'Route Optimizer Agent',
    description: 'Optimises cleaner schedules and travel routes',
    enabled: true,
    config: { model: 'gpt-4', maxTokens: 3000, temperature: 0.1 },
    allowedResources: ['bookings', 'cleaners', 'geo', 'traffic'],
    deniedResources: ['content', 'payments', 'customer_contacts'],
    geoScope: 'assigned_service_areas',
    requireHumanApproval: false,
  },
  {
    role: 'REVENUE' as const,
    name: 'Revenue Agent',
    description: 'Analyses revenue trends and suggests pricing adjustments',
    enabled: false,
    config: { model: 'gpt-4', maxTokens: 5000, temperature: 0.2 },
    allowedResources: ['bookings', 'pricing', 'analytics'],
    deniedResources: ['customer_pii', 'cleaner_personal'],
    geoScope: 'all',
    requireHumanApproval: true,
  },
];

// ═══════════════════════════════════════════════════════════
// SEED FUNCTION
// ═══════════════════════════════════════════════════════════
async function main() {
  console.log('🌱 Starting seed...');

  // 1. Seed Suburbs
  console.log('📍 Seeding suburbs...');
  for (const suburb of SUBURBS) {
    await prisma.suburb.upsert({
      where: { slug: suburb.slug },
      update: {},
      create: { ...suburb, searchVolume: Math.floor(Math.random() * 2000) + 100 },
    });
  }

  // 2. Seed Services
  console.log('🧹 Seeding services...');
  const serviceRecords: Record<string, any> = {};
  for (const svc of SERVICES) {
    const created = await prisma.service.upsert({
      where: { category: svc.category },
      update: svc,
      create: svc,
    });
    serviceRecords[svc.category] = created;
  }

  // 3. Seed Pricing Rules
  console.log('💰 Seeding pricing rules...');
  const suburbs = await prisma.suburb.findMany();
  for (const service of Object.values(serviceRecords)) {
    for (const rule of PRICING_RULES) {
      await prisma.pricingRule.create({
        data: {
          serviceId: service.id,
          frequency: rule.frequency,
          discountPct: rule.discountPct,
          minimumCharge: service.basePrice,
        },
      });
    }
  }

  // 4. Seed Agent Configs (OASIS-IS)
  console.log('🤖 Seeding agent configs...');
  for (const agent of AGENT_CONFIGS) {
    await prisma.agentConfig.upsert({
      where: { role: agent.role },
      update: agent,
      create: agent,
    });
  }

  // 5. Seed Admin User
  console.log('👤 Seeding admin user...');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@sparkleclean.com.au' },
    update: {},
    create: {
      email: 'admin@sparkleclean.com.au',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      adminProfile: {
        create: {
          twoFactorEnabled: false,
          departments: ['ops', 'content', 'seo', 'finance'],
        },
      },
    },
  });

  // 6. Seed test customer
  console.log('🧑 Seeding test customer...');
  const customer = await prisma.user.upsert({
    where: { email: 'test@example.com.au' },
    update: {},
    create: {
      email: 'test@example.com.au',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+61400000001',
      role: 'CUSTOMER',
      customer: {
        create: {
          properties: {
            create: {
              addressLine1: '123 Murray Street',
              suburb: 'Perth',
              state: 'WA',
              postcode: '6000',
              propertyType: 'apartment',
              bedrooms: 2,
              bathrooms: 1,
              totalAreaSqm: 85,
            },
          },
        },
      },
    },
    include: { customer: { include: { properties: true } } },
  });

  console.log('✅ Seed complete!');
  console.log(`   • ${SUBURBS.length} suburbs`);
  console.log(`   • ${SERVICES.length} services`);
  console.log(`   • ${AGENT_CONFIGS.length} agent configs`);
  console.log(`   • Admin user: ${adminUser.email}`);
  console.log(`   • Test customer: ${customer.email}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
