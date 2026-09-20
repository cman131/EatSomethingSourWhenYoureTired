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
  previewCss: { type: String, default: null },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('ShopItem', shopItemSchema);
