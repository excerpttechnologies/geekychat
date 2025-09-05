const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  // WhatsApp API details (optional per user)
  accessToken: { type: String, default: "" },
  apiVersion: { type: String, default: "v23.0" },
  phoneNumberId: { type: String, default: "" },

  // Credits balance
  creditCoins: { type: Number, default: 0 },

  // Store created template IDs
  templates: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
