// const mongoose = require('mongoose');

// const userSchema = new mongoose.Schema({
//   firstName: { type: String },
//   lastName: { type: String},
//   phone: { type: String, required: true, unique: true },
//   password: { type: String, required: true },

//   // WhatsApp API details (optional per user)
//   accessToken: { type: String, default: "" },
//   apiVersion: { type: String, default: "v23.0" },
//   phoneNumberId: { type: String, default: "" },

//   // Credits balance
//   creditCoins: { type: Number, default: 0 },

//   // Store created template IDs
//   templates: [{ type: String }],
// }, { timestamps: true });

// module.exports = mongoose.model('User', userSchema);


const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Basic registration fields
  firstName: { type: String },
  lastName: { type: String },
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

  // Additional verification fields
  address: { type: String, default: "" },
  gender: { 
    type: String, 
    enum: ['Male', 'Female', 'Other', ''], 
    default: "" 
  },
  dateOfBirth: { type: Date },
  
  // PAN Card verification
  panCardNumber: { type: String, default: "" },
  panVerification: {
    isVerified: { type: Boolean, default: false },
    verificationName: { type: String, default: "" }
  },

  // Aadhaar details (file upload)
  aadhaarDocument: {
    fileName: { type: String, default: "" },
    filePath: { type: String, default: "" },
    uploadDate: { type: Date }
  },

  // Agreement document (signed and uploaded)
  agreementDocument: {
    fileName: { type: String, default: "" },
    filePath: { type: String, default: "" },
    uploadDate: { type: Date }
  },

  // Overall verification status
  isFullyVerified: { type: Boolean, default: false }

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);