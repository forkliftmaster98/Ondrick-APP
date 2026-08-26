import type { PrismaClient } from '@prisma/client';

// Seed content mirrors the prototype's seed arrays verbatim (see
// BACKEND_SPEC.md "Data model" and the CATEGORIES / DUMPING_ITEMS / etc.
// constants in Material Calculator App.dc.html) so the API returns the same
// numbers and copy the yard already reviewed. Prices outside dumping are
// placeholders, as documented in the spec. Shared by prisma/seed.ts (the
// dev/prod CLI entry) and the test suite's fixture setup.

const CATEGORIES = [
  {
    key: 'mulch',
    name: 'Mulch & Wood Chips',
    hint: 'Cedar, hemlock, pine & color-enhanced blends',
    typicalDepthIn: 3,
    weightPerYardLb: 500,
    products: [
      { name: 'Deluxe Red Cedar', price: 44, desc: 'Premium double-ground, color-enhanced cedar/spruce blend' },
      { name: 'Hemlock Blend', price: 44, desc: 'Color-enhanced double-ground, natural brown with a hint of red' },
      { name: 'Natural Forest Blend', price: 39, desc: 'Dark all-natural bark mulch, no color enhancing' },
    ],
  },
  {
    key: 'soil',
    name: 'Soil & Compost',
    hint: 'Screened topsoil, contractor loam & compost',
    typicalDepthIn: 4,
    weightPerYardLb: 2100,
    products: [
      { name: 'Premium Screened Topsoil', price: 32, desc: 'Fine-screened, dark and rich; ready for planting' },
      { name: 'Contractor Grade Loam', price: 28, desc: 'Coarsely screened, sand-based; for drainage or thick coverage' },
      { name: 'Compost', price: 35, desc: 'For garden bed amendment or top-dressing', typicalDepthIn: 2 },
    ],
  },
  {
    key: 'stone',
    name: 'Landscaping Stone',
    hint: 'Decorative stone, gravel & river rounds',
    typicalDepthIn: 3,
    weightPerYardLb: 2700,
    products: [
      { name: '3/4" Crushed Stone', price: 52, desc: 'Angular gray stone for drainage & pathways' },
      { name: 'River Rounds', price: 68, desc: 'Smooth mixed-size rounds for borders & beds' },
    ],
  },
  {
    key: 'sand',
    name: 'Sand',
    hint: 'Mason, concrete & stone sand',
    typicalDepthIn: 2,
    weightPerYardLb: 2700,
    products: [
      { name: 'Mason Sand', price: 38, desc: 'Fine sand for paver bedding & masonry' },
    ],
  },
];

const DUMPING_ITEMS = [
  {
    key: 'yard',
    name: 'Grass, Leaves & Wood Chips',
    priceLabel: '$5/c.y.',
    priceNote: null,
    rules:
      'Yard waste only — no plastic bags, bins, root balls, or trash mixed in. Attendant will direct you to the drop zone; please stay clear of active equipment. Load will be measured on arrival and priced by total yardage.',
  },
  {
    key: 'brush',
    name: 'Brush',
    priceLabel: '$15 / $35 per c.y.',
    priceNote: 'standard / oversize load',
    rules:
      'Branches and limbs only, ideally under 6" diameter. Branches or limbs cannot be more than 6\' in length. Load will be measured on arrival and priced by total yardage.',
  },
  {
    key: 'concrete',
    name: 'Concrete',
    priceLabel: '$15 / $35 per c.y.',
    priceNote: 'standard / oversize load',
    rules:
      'Clean concrete only — No rebar, wire mesh, painted concrete, or attached materials unless pre-approved by staff. Load will be measured on arrival and priced by total yardage.',
  },
  {
    key: 'asphalt',
    name: 'Asphalt',
    priceLabel: 'Free',
    priceNote: null,
    rules:
      'Clean asphalt only, free of dirt, concrete, and other debris. Call ahead or check in with an attendant for large-load scheduling. Load will be measured on arrival and priced by total yardage.',
  },
  {
    key: 'brick',
    name: 'Brick',
    priceLabel: 'Call for pricing',
    priceNote: 'ask an attendant',
    rules:
      'Whole or broken brick only. Sorted loads (brick separated from mortar-heavy debris) move faster. Check in with an attendant for current rates. Load will be measured on arrival and priced by total yardage.',
  },
];

const DUMPING_RESTRICTIONS = [
  'No plastic bags, bins, root balls or household trash mixed into yard waste',
  'No branches or limbs over 6" diameter or more than 6\' in length',
  'No rebar, wire mesh or attached materials in concrete',
  'No painted concrete',
  'No dirt, concrete or debris mixed into asphalt loads',
  'No mortar-heavy or mixed debris in brick loads — sorted loads move faster',
];

const TOOLS = [
  { key: 't1', name: 'Wheelbarrow', note: 'Steel tub, standard size', priceLabel: '$0.00' },
  { key: 't2', name: 'Plate Compactor', note: 'For paver base & sub-grade', priceLabel: '$0.00' },
  { key: 't3', name: 'Sod Cutter', note: 'Walk-behind, gas powered', priceLabel: '$0.00' },
  { key: 't4', name: 'Post-Hole Digger', note: 'Manual, 6" and 8" heads', priceLabel: '$0.00' },
  { key: 't5', name: 'Paver Splitter', note: 'Hand-operated, guillotine style', priceLabel: '$0.00' },
  { key: 't6', name: 'Hand Tampers & Rakes', note: 'Sold at the yard', priceLabel: '$0.00' },
];

const CLEARANCE_ITEMS = [
  {
    key: 'cl1',
    name: 'Techo-Bloc Blu 60 — Shale Grey',
    note: 'Discontinued color, 3 pallets',
    priceLabel: '$3.85 / sq ft',
    wasPriceLabel: '$5.60 / sq ft',
    qtyLabel: '3 pallets left',
  },
  {
    key: 'cl2',
    name: 'Unilock Brussels Block — Sandstone',
    note: 'Odd lot, mixed pallet',
    priceLabel: '$2.95 / sq ft',
    wasPriceLabel: '$4.40 / sq ft',
    qtyLabel: '1 pallet left',
  },
  {
    key: 'cl3',
    name: 'Color-Enhanced Black Mulch',
    note: 'End-of-season overstock',
    priceLabel: '$26 / c.y.',
    wasPriceLabel: '$39 / c.y.',
    qtyLabel: 'While supplies last',
  },
  {
    key: 'cl4',
    name: 'Bluestone Treads — Seconds',
    note: 'Minor chips, structurally sound',
    priceLabel: '$42 each',
    wasPriceLabel: '$78 each',
    qtyLabel: '9 pieces left',
  },
];

// day/monthShort from the prototype are derived; here we anchor to the next
// upcoming occurrence of that month/day so seeded events don't look stale.
const CLASS_EVENTS = [
  {
    month: 8, // August
    day: 23,
    title: 'Fall Container Workshop',
    timeLabel: '10:00am – 12:00pm',
    note: 'Hands-on planting demo, space limited — sign up in-store.',
  },
  {
    month: 8,
    day: 29,
    title: 'Paver Patio Showcase',
    timeLabel: '11:00am – 2:00pm',
    note: 'Live install demo with Techo-Bloc & Unilock reps, refreshments served.',
  },
];

const TEAM_MEMBERS = [
  { key: 'm1', name: 'Team member name', role: 'Role at Ondrick', bio: 'Their story, in their own words — what brought them here and what they love about helping customers and the community — will go here.' },
  { key: 'm2', name: 'Team member name', role: 'Role at Ondrick', bio: 'Their story, in their own words — what brought them here and what they love about helping customers and the community — will go here.' },
  { key: 'm3', name: 'Team member name', role: 'Role at Ondrick', bio: 'Their story, in their own words — what brought them here and what they love about helping customers and the community — will go here.' },
];

const CONTRACTOR_DOCS = [
  { key: 'd1', name: 'Contractor Price List', updatedLabel: 'Updated this season', fileKey: 'contractor-docs/price-list.pdf' },
  { key: 'd2', name: 'Volume & Delivery Terms', updatedLabel: 'Updated this season', fileKey: 'contractor-docs/volume-delivery-terms.pdf' },
];

function nextOccurrence(month: number, day: number): Date {
  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, month - 1, day);
  if (candidate < now) year += 1;
  return new Date(year, month - 1, day);
}

export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, tradeDiscountPct: 10 },
  });

  await prisma.contractorCode.upsert({
    where: { code: 'ONDRICKPRO0' },
    update: {},
    create: { code: 'ONDRICKPRO0', label: 'Demo / seed code', active: true },
  });

  for (const [index, category] of CATEGORIES.entries()) {
    await prisma.materialCategory.upsert({
      where: { key: category.key },
      update: {
        name: category.name,
        hint: category.hint,
        typicalDepthIn: category.typicalDepthIn,
        weightPerYardLb: category.weightPerYardLb,
        sortOrder: index,
      },
      create: {
        key: category.key,
        name: category.name,
        hint: category.hint,
        typicalDepthIn: category.typicalDepthIn,
        weightPerYardLb: category.weightPerYardLb,
        sortOrder: index,
      },
    });

    const dbCategory = await prisma.materialCategory.findUniqueOrThrow({ where: { key: category.key } });

    for (const [productIndex, product] of category.products.entries()) {
      const existing = await prisma.materialProduct.findFirst({
        where: { categoryId: dbCategory.id, name: product.name },
      });
      const data = {
        categoryId: dbCategory.id,
        name: product.name,
        description: product.desc,
        pricePerYard: product.price,
        typicalDepthIn: 'typicalDepthIn' in product ? (product.typicalDepthIn ?? null) : null,
        active: true,
        sortOrder: productIndex,
      };
      if (existing) {
        await prisma.materialProduct.update({ where: { id: existing.id }, data });
      } else {
        await prisma.materialProduct.create({ data });
      }
    }
  }

  for (const [index, item] of DUMPING_ITEMS.entries()) {
    await prisma.dumpingItem.upsert({
      where: { key: item.key },
      update: { ...item, sortOrder: index },
      create: { ...item, sortOrder: index },
    });
  }

  await prisma.dumpingRestriction.deleteMany({});
  await prisma.dumpingRestriction.createMany({
    data: DUMPING_RESTRICTIONS.map((text, index) => ({ text, sortOrder: index })),
  });

  for (const [index, tool] of TOOLS.entries()) {
    await prisma.tool.upsert({
      where: { key: tool.key },
      update: { ...tool, sortOrder: index },
      create: { ...tool, sortOrder: index },
    });
  }

  for (const [index, item] of CLEARANCE_ITEMS.entries()) {
    await prisma.clearanceItem.upsert({
      where: { key: item.key },
      update: { ...item, sortOrder: index },
      create: { ...item, sortOrder: index },
    });
  }

  for (const teamMember of TEAM_MEMBERS) {
    await prisma.teamMember.upsert({
      where: { key: teamMember.key },
      update: teamMember,
      create: teamMember,
    });
  }

  for (const doc of CONTRACTOR_DOCS) {
    await prisma.contractorDoc.upsert({
      where: { key: doc.key },
      update: doc,
      create: doc,
    });
  }

  // Events aren't upserted on a natural key in the prototype (no stable id),
  // so seeding just ensures at least these two exist without duplicating on
  // repeated runs, matched by title.
  for (const event of CLASS_EVENTS) {
    const existing = await prisma.event.findFirst({ where: { title: event.title } });
    const data = {
      title: event.title,
      startsOn: nextOccurrence(event.month, event.day),
      timeLabel: event.timeLabel,
      note: event.note,
      active: true,
    };
    if (existing) {
      await prisma.event.update({ where: { id: existing.id }, data });
    } else {
      await prisma.event.create({ data });
    }
  }
}
