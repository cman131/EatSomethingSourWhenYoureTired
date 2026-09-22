const mongoose = require('mongoose');

const shopItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: {
    type: String,
    enum: ['nameColor', 'nameIcon', 'profileBorder', 'title'],
    required: true,
  },
  cost: { type: Number, required: true },
  value: { type: String, required: true },
  tier: { type: String, enum: ['entry', 'mid', 'premium', 'prestige'], default: 'entry' },
  // 'earned' items are granted for achievements and are never purchasable.
  acquisition: { type: String, enum: ['shop', 'earned'], default: 'shop' },
  // Purchasable only inside this window; null means unbounded on that side. Owners keep the item.
  availableFrom: { type: Date, default: null },
  availableUntil: { type: Date, default: null },
  // Identifies the event an earned item was created for (e.g. "tournament:<id>"); absent on shop items.
  sourceKey: { type: String, default: undefined },
  previewCss: { type: String, default: null },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

shopItemSchema.index({ sourceKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('ShopItem', shopItemSchema);
