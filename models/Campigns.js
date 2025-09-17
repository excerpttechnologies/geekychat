// const mongoose = require('mongoose');

// const CampaignSchema = new mongoose.Schema({
//   campaignName: { type: String, required: true },
//   phoneNumberId: { type: String, required: true },
//   templateName: { type: String, required: true },
//   headerType: { type: String, required: true },
//   contacts: [{ type: String }],
//   status: { type: String, default: 'sent' },
//   scheduleDate: { type: String },
//   scheduleTime: { type: String },
//   scheduleMode: { type: String },
//   fileName: { type: String },
//   fileUrl: { type: String },
  
//   // New fields for message tracking
//   messageDetails: [{
//     phoneNumber: { type: String, required: true },
//     messageId: { type: String }, // WhatsApp message ID
//     messageContent: { type: Object }, // Full message payload
//     sentAt: { type: Date, default: Date.now },
//     status: { type: String, default: 'sent' }, // sent, delivered, read, failed
//     error: { type: String } // Error message if failed
//   }],
  
//   createdAt: { type: Date, default: Date.now },
//   updatedAt: { type: Date, default: Date.now }
// });

// module.exports = mongoose.model('Campaign', CampaignSchema);



const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
  campaignName: { type: String, required: true },
  phoneNumberId: { type: String, required: true },
  templateName: { type: String, required: true },
  headerType: { type: String, required: true },
  contacts: [{ type: String }],
  status: { type: String, default: 'sent' },
  scheduleDate: { type: String },
  scheduleTime: { type: String },
  scheduleMode: { type: String },
  fileName: { type: String },
  fileUrl: { type: String },
  userPhone: { type: String }, // Track user who created campaign
 
  // Enhanced message tracking with detailed error handling
  messageDetails: [{
    phoneNumber: { type: String, required: true },
    messageId: { type: String }, // WhatsApp message ID
    messageContent: { type: Object }, // Full message payload
    sentAt: { type: Date, default: Date.now },
    status: { type: String, default: 'sent' }, // sent, delivered, read, failed
    error: { type: String }, // Detailed error message if failed
    errorCode: { type: String }, // WhatsApp API error code
    errorType: { type: String }, // Type of error (auth, rate_limit, invalid_number, etc.)
    retryCount: { type: Number, default: 0 }, // Number of retry attempts
    deliveredAt: { type: Date }, // When message was delivered
    readAt: { type: Date } // When message was read
  }],

  // New fields for batch processing
  batchNumber: { type: Number }, // Batch number for large campaigns
  parentCampaign: { type: String }, // Parent campaign name for batches
  totalBatches: { type: Number }, // Total number of batches
  
  // Campaign statistics
  stats: {
    totalContacts: { type: Number, default: 0 },
    successfulMessages: { type: Number, default: 0 },
    failedMessages: { type: Number, default: 0 },
    deliveredMessages: { type: Number, default: 0 },
    readMessages: { type: Number, default: 0 },
    successRate: { type: Number, default: 0 }
  },
 
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add index for efficient querying
CampaignSchema.index({ userPhone: 1, createdAt: -1 });
CampaignSchema.index({ parentCampaign: 1, batchNumber: 1 });

module.exports = mongoose.model('Campaign', CampaignSchema);