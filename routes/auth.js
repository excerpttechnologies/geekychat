// const express = require('express');
// const router = express.Router();
// const User = require('../models/User');

// // Register
// router.post('/register', async (req, res) => {
//   const { phone, password, firstname, lastname } = req.body;
//   try {
//     const existing = await User.findOne({ phone });
//     if (existing) return res.status(400).json({ message: 'User already exists' });

//     const newUser = new User({ phone, password, firstName: firstname, lastName: lastname });
//     await newUser.save();
//     res.status(201).json({ message: 'User registered' });
//   } catch (err) {
//     res.status(500).json({ message: 'Error registering user' });
//   }
// });



// // Update user
// router.put('/:id', async (req, res) => {
//   try {
//     const updatedUser = await User.findByIdAndUpdate(
//       req.params.id,
//       req.body,
//       { new: true }
//     );
//     if (!updatedUser) {
//       return res.status(404).json({ message: 'User not found' });
//     }
//     res.json({ message: 'User updated', updatedUser });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Error updating user' });
//   }
// });

// // Delete user
// router.delete('/:id', async (req, res) => {
//   try {
//     const deletedUser = await User.findByIdAndDelete(req.params.id);
//     if (!deletedUser) {
//       return res.status(404).json({ message: 'User not found' });
//     }
//     res.json({ message: 'User deleted' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Error deleting user' });
//   }
// });
// // Login
// router.post('/login', async (req, res) => {
//   const { phone, password } = req.body;
//   try {
//     const user = await User.findOne({ phone });
//     if (!user || user.password !== password) {
//       return res.status(401).json({ message: 'Invalid credentials' });
//     }
//     // Send userId along with success message
//     res.json({ message: 'Login successful', userId: user._id.toString() });
//   } catch (err) {
//     res.status(500).json({ message: 'Login failed' });
//   }
// });

// module.exports = router;



// auth.js - Backend authentication routes
// const express = require('express');
// const bcrypt = require('bcryptjs');
// const multer = require('multer');
// const path = require('path');
// const User = require('../models/User');
// const router = express.Router();

// // Configure multer for file uploads
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, 'document/')
//   },
//   filename: function (req, file, cb) {
//     cb(null, req.body.phone + '-' + file.fieldname + '-' + Date.now() + path.extname(file.originalname))
//   }
// });

// const upload = multer({ 
//   storage: storage,
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = /jpeg|jpg|png|pdf/;
//     const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
//     const mimetype = allowedTypes.test(file.mimetype);
    
//     if (mimetype && extname) {
//       return cb(null, true);
//     } else {
//       cb('Error: Only images (JPEG, JPG, PNG) and PDF files are allowed!');
//     }
//   },
//   limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
// });
// router.post('/register', async (req, res) => {
//   const { phone, password, firstname, lastname } = req.body;
//   try {
//     const existing = await User.findOne({ phone });
//     if (existing) return res.status(400).json({ message: 'User already exists' });

//     const newUser = new User({ phone, password, firstName: firstname, lastName: lastname });
//     await newUser.save();
//     res.status(201).json({ message: 'User registered' });
//   } catch (err) {
//     res.status(500).json({ message: 'Error registering user' });
//   }
// });
// // Login route - Check verification status
// router.post('/login', async (req, res) => {
//   try {
//     const { phone, password } = req.body;

//     const user = await User.findOne({ phone });
//     if (!user) {
//       return res.status(400).json({ message: 'User not found' });
//     }

// if (user.password !== password) {
//       return res.status(400).json({ message: 'Invalid credentials' });
//     }

//     // Check if user needs verification
//     const needsVerification = !user.panVerification.isVerified || 
//                              !user.address || 
//                              !user.aadhaarDocument.fileName || 
//                              !user.agreementDocument.fileName;

//     res.json({
//       message: 'Login successful',
//       userId: user._id,
//       needsVerification: needsVerification,
//       user: {
//         firstName: user.firstName,
//         lastName: user.lastName,
//         phone: user.phone,
//         isFullyVerified: user.isFullyVerified
//       }
//     });
//   } catch (error) {
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // Get user details for verification page
// router.get('/user/:userId', async (req, res) => {
//   try {
//     const user = await User.findById(req.params.userId).select('-password');
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }
//     res.json(user);
//   } catch (error) {
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // Update user verification details
// router.post('/verify-user', upload.fields([
//   { name: 'aadhaarDocument', maxCount: 1 },
//   { name: 'agreementDocument', maxCount: 1 }
// ]), async (req, res) => {
//   try {
//     const { userId, address, gender, dateOfBirth, panCardNumber } = req.body;
    
//     const updateData = {
//       address,
//       gender,
//       dateOfBirth: new Date(dateOfBirth),
//       panCardNumber,
//       // Hardcoded PAN verification for now
//       'panVerification.isVerified': true,
//       'panVerification.verificationName': req.body.firstName + ' ' + req.body.lastName
//     };

//     // Handle file uploads
//     if (req.files.aadhaarDocument) {
//       updateData['aadhaarDocument.fileName'] = req.files.aadhaarDocument[0].originalname;
//       updateData['aadhaarDocument.filePath'] = req.files.aadhaarDocument[0].path;
//       updateData['aadhaarDocument.uploadDate'] = new Date();
//     }

//     if (req.files.agreementDocument) {
//       updateData['agreementDocument.fileName'] = req.files.agreementDocument[0].originalname;
//       updateData['agreementDocument.filePath'] = req.files.agreementDocument[0].path;
//       updateData['agreementDocument.uploadDate'] = new Date();
//     }

//     // Check if user is fully verified
//     if (updateData.address && updateData.panCardNumber && 
//         req.files.aadhaarDocument && req.files.agreementDocument) {
//       updateData.isFullyVerified = true;
//     }

//     const user = await User.findByIdAndUpdate(userId, updateData, { new: true });
    
//     res.json({
//       message: 'Verification details updated successfully',
//       isFullyVerified: user.isFullyVerified
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // Download agreement template
// router.get('/download-agreement', (req, res) => {
//   const file = path.join(__dirname, '../document/doc.pdf');
//   res.download(file, 'Agreement-Template.pdf');
// });

// module.exports = router;


const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const axios = require('axios');
const fs = require('fs');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'document/')
  },
  filename: function (req, file, cb) {
    cb(null, req.body.phone + '-' + file.fieldname + '-' + Date.now() + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb('Error: Only images (JPEG, JPG, PNG) and PDF files are allowed!');
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.post('/register', async (req, res) => {
  const { phone, password, firstname, lastname ,email} = req.body;
  try {
    const existing = await User.findOne({ phone });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const newUser = new User({ phone, password, email,firstName: firstname, lastName: lastname });
    await newUser.save();
    res.status(201).json({ message: 'User registered' });
  } catch (err) {
    res.status(500).json({ message: 'Error registering user' });
  }
});

// Login route - Check verification status
// router.post('/login', async (req, res) => {
//   try {
//     const { phone, password } = req.body;

//     const user = await User.findOne({ phone });
//     if (!user) {
//       return res.status(400).json({ message: 'User not found' });
//     }

//     if (user.password !== password) {
//       return res.status(400).json({ message: 'Invalid credentials' });
//     }

//     // Check if user needs verification
//     const needsVerification = !user.panVerification.isVerified || 
//                              !user.address || 
//                              !user.aadhaarDocument.fileName || 
//                              !user.agreementDocument.fileName;

//     res.json({
//       message: 'Login successful',
//       userId: user._id,
//       needsVerification: needsVerification,
//       user: {
//         firstName: user.firstName,
//         lastName: user.lastName,
//         phone: user.phone,
//         isFullyVerified: user.isFullyVerified,
//         creditCoins: user.creditCoins
//       }
//     });
//   } catch (error) {
//     res.status(500).json({ message: 'Server error' });
//   }
// });
router.get('/', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
    console.log("users",users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});
// Get all users

// Approve user
router.patch('/:userId/approve', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isFullyVerified: true },
      { new: true }
    );
    res.json({ message: 'User approved', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// View/Download documents
// View documents - Enhanced with proper headers
router.get('/documents/view', (req, res) => {
  try {
    const filePath = req.query.path;
    
    if (!filePath) {
      return res.status(400).json({ message: 'File path is required' });
    }

    const absolutePath = path.resolve(filePath);
    
    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Get file extension to set proper content type
    const ext = path.extname(absolutePath).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.pdf':
        contentType = 'application/pdf';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
    }

    // Set proper headers for inline viewing
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    
    // For PDF files, add additional headers to ensure proper display
    if (ext === '.pdf') {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    res.sendFile(absolutePath);
  } catch (error) {
    console.error('Error viewing document:', error);
    res.status(500).json({ message: 'Error viewing document' });
  }
});

// Download documents - Enhanced with error handling
router.get('/documents/download', (req, res) => {
  try {
    const filePath = req.query.path;
    
    if (!filePath) {
      return res.status(400).json({ message: 'File path is required' });
    }

    const absolutePath = path.resolve(filePath);
    
    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Extract filename for download
    const filename = path.basename(absolutePath);
    
    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    res.download(absolutePath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error downloading file' });
        }
      }
    });
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ message: 'Error downloading document' });
  }
});
// Get user details for verification page


// Update user verification details
router.post('/verify-user', upload.fields([
  { name: 'aadhaarDocument', maxCount: 1 },
  { name: 'agreementDocument', maxCount: 1 }
]), async (req, res) => {
  try {
    const { userId, address, gender, dateOfBirth, panCardNumber } = req.body;
    
    // First, get the current user to check if they were already verified
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const wasAlreadyVerified = currentUser.isFullyVerified;
    
    const updateData = {
      address,
      gender,
      dateOfBirth: new Date(dateOfBirth),
      panCardNumber,
      // Hardcoded PAN verification for now
      'panVerification.isVerified': true,
      'panVerification.verificationName': req.body.firstName + ' ' + req.body.lastName
    };

    // Handle file uploads
    if (req.files.aadhaarDocument) {
      updateData['aadhaarDocument.fileName'] = req.files.aadhaarDocument[0].originalname;
      updateData['aadhaarDocument.filePath'] = req.files.aadhaarDocument[0].path;
      updateData['aadhaarDocument.uploadDate'] = new Date();
    }

    if (req.files.agreementDocument) {
      updateData['agreementDocument.fileName'] = req.files.agreementDocument[0].originalname;
      updateData['agreementDocument.filePath'] = req.files.agreementDocument[0].path;
      updateData['agreementDocument.uploadDate'] = new Date();
    }

    // Check if user will be fully verified after this update
    const willBeFullyVerified = updateData.address && 
                               updateData.panCardNumber && 
                               req.files.aadhaarDocument && 
                               req.files.agreementDocument;

    if (willBeFullyVerified) {
      // updateData.isFullyVerified = true;
      
      // Add 50 credits ONLY if user wasn't already verified
      if (!wasAlreadyVerified) {
        updateData.$inc = { creditCoins: 50 }; // Use MongoDB's $inc operator to add 50 credits
      }
    }

    const user = await User.findByIdAndUpdate(userId, updateData, { new: true });
    
    // Prepare response message
    let message = 'Verification details updated successfully';
    if (willBeFullyVerified && !wasAlreadyVerified) {
      message += '. 50 credits have been added to your account!';
    }
    
    res.status(200).json({
      message: message,
      // isFullyVerified: user.isFullyVerified,
      creditCoins: user.creditCoins,
      creditsAdded: willBeFullyVerified && !wasAlreadyVerified ? 50 : 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Download agreement template
router.get('/download-agreement', (req, res) => {
  const file = path.join(__dirname, '../document/doc.pdf');
  res.download(file, 'Agreement-Template.pdf');
});




// Store OTPs temporarily (in production, use Redis or database)
const otpStore = new Map();

// WhatsApp API configuration
const WHATSAPP_TOKEN = 'EAAdzxxobLG4BPU8Lei8DhhuZCjlCthpNQ55ok3LGlpY1PSIzXsOnTrEje2BvKUZCjFPOWlTtJg1TezXPgjp7NrCPN5Nzv6x2BOF7lMQml80v4NNIIWFEZAy5H7ZBZAgk7ZBku0y7QIBIwMsQ9ZCVe6JpbAa9wSz1dHb7xeDJTw7msm7AoxF1YMumg01P1LGBAZDZD'; // Replace with your token
const WHATSAPP_PHONE_ID = '671028016100461'; // Your phone number ID
const WHATSAPP_API_URL = `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`;

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send WhatsApp OTP
const sendWhatsAppOTP = async (phoneNumber, otp) => {
  try {
    const response = await axios.post(WHATSAPP_API_URL, {
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: "template",
      template: {
        name: "login_otp_a2",
        language: {
          code: "en_US"
        },
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: otp
              }
            ]
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [
              {
                type: "text",
                text: otp
              }
            ]
          }
        ]
      }
    }, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error('WhatsApp API Error:', error.response?.data || error.message);
    throw new Error('Failed to send OTP via WhatsApp');
  }
};

// Step 1: Send OTP (Check if user exists and send OTP)
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Check if user exists
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(400).json({ message: 'User not found. Please register first.' });
    }

    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with expiration (5 minutes)
    const otpData = {
      otp: otp,
      phone: phone,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes from now
      attempts: 0
    };
    
    otpStore.set(phone, otpData);

    // Send OTP via WhatsApp
    await sendWhatsAppOTP(phone, otp);

    res.json({
      message: 'OTP sent successfully to your WhatsApp',
      success: true
    });

  } catch (error) {
    console.error('Send OTP Error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to send OTP',
      success: false 
    });
  }
});

// Step 2: Verify OTP and Login
router.post('/verify-otp-login', async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP are required' });
    }

    // Check if OTP exists for this phone
    const otpData = otpStore.get(phone);
    
    if (!otpData) {
      return res.status(400).json({ message: 'OTP not found. Please request a new OTP.' });
    }

    // Check if OTP is expired
    if (Date.now() > otpData.expiresAt) {
      otpStore.delete(phone);
      return res.status(400).json({ message: 'OTP has expired. Please request a new OTP.' });
    }

    // Check attempts (max 3 attempts)
    if (otpData.attempts >= 3) {
      otpStore.delete(phone);
      return res.status(400).json({ message: 'Too many failed attempts. Please request a new OTP.' });
    }

    // Verify OTP
    if (otpData.otp !== otp) {
      otpData.attempts += 1;
      otpStore.set(phone, otpData);
      return res.status(400).json({ 
        message: `Invalid OTP. ${3 - otpData.attempts} attempts remaining.` 
      });
    }

    // OTP is valid, get user details
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Clear OTP from store
    otpStore.delete(phone);

    // Check if user needs verification
    const needsVerification = !user.panVerification.isVerified ||
                              !user.address ||
                              !user.aadhaarDocument.fileName ||
                              !user.agreementDocument.fileName;

    res.json({
      message: 'OTP verified successfully. Login successful!',
      userId: user._id,
      needsVerification: needsVerification,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        isFullyVerified: user.isFullyVerified,
        creditCoins: user.creditCoins
      },
      success: true
    });

  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ 
      message: 'Server error during OTP verification',
      success: false 
    });
  }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Check if user exists
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(400).json({ message: 'User not found. Please register first.' });
    }

    // Generate new OTP
    const otp = generateOTP();
    
    // Store new OTP
    const otpData = {
      otp: otp,
      phone: phone,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0
    };
    
    otpStore.set(phone, otpData);

    // Send OTP via WhatsApp
    await sendWhatsAppOTP(phone, otp);

    res.json({
      message: 'New OTP sent successfully to your WhatsApp',
      success: true
    });

  } catch (error) {
    console.error('Resend OTP Error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to resend OTP',
      success: false 
    });
  }
});

// Keep existing login route for password-based login
// router.post('/login', async (req, res) => {
//   try {
//     const { phone, password,email } = req.body;

//    const user = await User.findOne({
//   $or: [
//     { phone: phone },
//     { email: email }
//   ]
// });

//     if (!user) {
//       return res.status(400).json({ message: 'User not found' });
//     }

//     if (user.password !== password) {
//       return res.status(400).json({ message: 'Invalid credentials' });
//     }

//     // Check if user needs verification
//     const needsVerification = !user.panVerification.isVerified ||
//                               !user.address ||
//                               !user.aadhaarDocument.fileName ||
//                               !user.agreementDocument.fileName;

//     res.json({
//       message: 'Login successful',
//       userId: user._id,
//       needsVerification: needsVerification,
//       user: {
//         firstName: user.firstName,
//         lastName: user.lastName,
//         roles:user.roles,
//         phone: user.phone,
//         isFullyVerified: user.isFullyVerified,
//         creditCoins: user.creditCoins
//       }
//     });
//   } catch (error) {
//     res.status(500).json({ message: 'Server error' });
//   }
// });
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user by email
    const user = await User.findOne({ email: email });

    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Check password
    if (user.password !== password) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if user needs verification
    const needsVerification = !user.panVerification.isVerified ||
                              !user.address ||
                              !user.aadhaarDocument.fileName ||
                              !user.agreementDocument.fileName;

    res.json({
      message: 'Login successful',
      userId: user._id,
      needsVerification: needsVerification,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        phone: user.phone,
        email: user.email,
        isFullyVerified: user.isFullyVerified,
        creditCoins: user.creditCoins
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
module.exports = router;