/**
 * Seed script — creates a default pricing template in MongoDB.
 * Run: npx tsx scripts/seed.ts
 */
import mongoose from 'mongoose'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env' })

const MONGODB_URI = process.env.MONGODB_URI!
if (!MONGODB_URI) throw new Error('MONGODB_URI not set in .env')

const TemplateFieldSchema = new mongoose.Schema({
  key: String,
  label: String,
  type: { type: String, enum: ['string', 'number', 'date', 'select'] },
  required: Boolean,
  options: [String],
  description: String,
  example: String,
}, { _id: false })

const PricingTemplateSchema = new mongoose.Schema({
  name: String,
  description: String,
  mandatoryFields: [TemplateFieldSchema],
  optionalFields: [TemplateFieldSchema],
  targetEmail: String,
  active: Boolean,
}, { timestamps: true })

const PricingTemplate = mongoose.models.PricingTemplate || mongoose.model('PricingTemplate', PricingTemplateSchema)

async function seed() {
  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB')

  const existing = await PricingTemplate.findOne({ name: 'Standard Product Price Update' })
  if (existing) {
    console.log('Seed template already exists. Skipping.')
    process.exit(0)
  }

  await PricingTemplate.create({
    name: 'Standard Product Price Update',
    description: 'Use this template to submit a standard product pricing update request.',
    targetEmail: (process.env.PRICING_EMAIL || 'testRates@domain.com').toLowerCase(),
    active: true,
    mandatoryFields: [
      { key: 'product_sku', label: 'Product SKU', type: 'string', required: true, description: 'Unique product identifier', example: 'PROD-001' },
      { key: 'product_name', label: 'Product Name', type: 'string', required: true, description: 'Full product name', example: 'Enterprise License' },
      { key: 'current_price', label: 'Current Price', type: 'number', required: true, description: 'Existing price in USD', example: '99.99' },
      { key: 'new_price', label: 'New Price', type: 'number', required: true, description: 'Requested new price in USD', example: '129.99' },
      { key: 'effective_date', label: 'Effective Date', type: 'date', required: true, description: 'When the new price takes effect', example: '2025-02-01' },
      { key: 'reason', label: 'Reason for Change', type: 'string', required: true, description: 'Business justification for the price change', example: 'Annual price adjustment' },
    ],
    optionalFields: [
      { key: 'region', label: 'Region', type: 'select', required: false, options: ['US', 'EU', 'APAC', 'GLOBAL'], description: 'Geographic region for this price', example: 'US' },
      { key: 'currency', label: 'Currency', type: 'string', required: false, description: 'ISO currency code', example: 'USD' },
      { key: 'notes', label: 'Additional Notes', type: 'string', required: false, description: 'Any extra context', example: 'Approved by Finance team' },
    ],
  })

  console.log('✅ Default template seeded successfully!')
  process.exit(0)
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
