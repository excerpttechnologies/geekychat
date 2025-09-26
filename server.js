// 📁 server/server.js
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Campaign = require("./models/Campigns");
require("dotenv").config();
const xlsx = require("xlsx");

const multer = require("multer");
const axios = require("axios");
const fs = require("fs");

const messageLogsRoutes = require("./routes/messageLogs");
const campaignLogsRoute = require("./routes/campaignLogs");
const paymentRoutes = require("./routes/payment");
const campaignRoutes = require("./routes/campigns");
const history = require('connect-history-api-fallback');
const app = express();

app.use(cors()); 
app.use(express.json());
app.use(express.json({ limit: '100mb' })); // Increase from default 100kb
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Add request timeout for long-running operations
app.use((req, res, next) => {
  req.setTimeout(300000); // 5 minutes timeout
  next();
});
// Routes imports
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/Users");
const whatsappRoutes = require("./routes/whatsapp");
app.get('/api/campaigns/detailed', async (req, res) => {
  try {
    const campaigns = await Campaign.find()
      .sort({ createdAt: -1 })
      .populate('messageDetails')
      .lean();
    
    // Calculate enhanced stats for each campaign
    const enhancedCampaigns = campaigns.map(campaign => {
      const messageDetails = campaign.messageDetails || [];
      
      const stats = {
        totalContacts: messageDetails.length || campaign.contacts?.length || 0,
        successfulMessages: messageDetails.filter(msg => 
          msg.status === 'sent' || msg.status === 'delivered' || msg.status === 'pending'
        ).length,
        failedMessages: messageDetails.filter(msg => msg.status === 'failed').length,
        deliveredMessages: messageDetails.filter(msg => msg.status === 'delivered').length,
        readMessages: messageDetails.filter(msg => msg.status === 'read').length,
      };
      
      stats.successRate = stats.totalContacts > 0 
        ? (stats.successfulMessages / stats.totalContacts) * 100 
        : 0;
      
      return {
        ...campaign,
        stats
      };
    });
    
    res.json(enhancedCampaigns);
  } catch (error) {
    console.error('Error fetching detailed campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("DB connection error:", err));

const upload = multer({ dest: "uploads/" });
// Routes usage
app.use("/api/auth", authRoutes);
app.use("/api/Users", userRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/messageLogs", messageLogsRoutes);
app.use("/api/campaignLogs", campaignLogsRoute);
app.use("/api/campaigns", campaignRoutes);
// DB connection


// 🔑 Meta config (move these to .env in production)
const accessToken = process.env.ACCESS_TOKEN;
const appId = process.env.APP_ID;
const wabaId = process.env.WABA_ID;
const apiVersion = "v23.0";

// // 📌 Create WhatsApp Template correct
// app.post("/create-template", upload.single("file"), async (req, res) => {
//   const { templateName, headerType, bodyText, footerText } = req.body;
//   const file = req.file;

//   if (!templateName) {
//     return res.status(400).json({ error: "Template name is required." });
//   }

//   try {
//     let headerComponent = null;

//     // If header requires file (IMAGE, VIDEO, DOCUMENT)
//     if (headerType !== "TEXT" && file) {
//       // Step 1: Upload session
//       const sessionRes = await axios.post(
//         `https://graph.facebook.com/${apiVersion}/${appId}/uploads`,
//         null,
//         {
//           params: {
//             file_name: file.originalname,
//             file_length: file.size,
//             file_type: file.mimetype,
//             access_token: accessToken,
//           },
//         }
//       );

//       const uploadSessionId = sessionRes.data.id;

//       // Step 2: Upload binary
//       const fileBuffer = fs.readFileSync(file.path);
//       const uploadRes = await axios.post(
//         `https://graph.facebook.com/${apiVersion}/${uploadSessionId}`,
//         fileBuffer,
//         {
//           headers: {
//             Authorization: `OAuth ${accessToken}`,
//             "file_offset": "0",
//             "Content-Type": "application/octet-stream",
//           },
//         }
//       );

//       const fileHandle = uploadRes.data.h;

//       // Step 3: Build header component
//       headerComponent = {
//         type: "HEADER",
//         format: headerType, // IMAGE | VIDEO | DOCUMENT
//         example: { header_handle: [fileHandle] },
//       };

//       // cleanup file
//       fs.unlinkSync(file.path);
//     } else if (headerType === "TEXT") {
//       // Text header
//       headerComponent = {
//         type: "HEADER",
//         format: "TEXT",
//         text: bodyText?.substring(0, 60) || "Header text", // Meta limit: 60 chars
//       };
//     }

//     // Body component
//     const bodyComponent = {
//       type: "BODY",
//       text: bodyText || "Hello, this is a body text.",
//     };

//     // Footer component (optional)
//     const footerComponent =
//       footerText && footerText.trim()
//         ? {
//             type: "FOOTER",
//             text: footerText.trim(),
//           }
//         : null;

//     const components = [headerComponent, bodyComponent];
//     if (footerComponent) components.push(footerComponent);

//     // Step 4: Create template
//     const templateRes = await axios.post(
//       `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates`,
//       {
//         name: templateName,
//         language: "en_US",
//         category: "MARKETING",
//         components,
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//         },
//       }
//     );

//     res.json({ success: true, data: templateRes.data });
//   } catch (err) {
//     console.error("❌ Error creating template:", err.response?.data || err.message);
//     res.status(500).json({ error: err.response?.data || err.message });
//   }
// });



// Updated backend code for handling templates

// Create Template Endpoint (Updated)
app.post("/create-template", upload.single("file"), async (req, res) => {
  const { templateName, headerType, bodyText, footerText, headerText } = req.body;
  const file = req.file;

  if (!templateName) {
    return res.status(400).json({ error: "Template name is required." });
  }

  try {
    let headerComponent = null;

    // If header requires file (IMAGE, VIDEO, DOCUMENT)
    if (headerType !== "TEXT" && file) {
      // Step 1: Upload session
      const sessionRes = await axios.post(
        `https://graph.facebook.com/${apiVersion}/${appId}/uploads`,
        null,
        {
          params: {
            file_name: file.originalname,
            file_length: file.size,
            file_type: file.mimetype,
            access_token: accessToken,
          },
        }
      );

      const uploadSessionId = sessionRes.data.id;

      // Step 2: Upload binary
      const fileBuffer = fs.readFileSync(file.path);
      const uploadRes = await axios.post(
        `https://graph.facebook.com/${apiVersion}/${uploadSessionId}`,
        fileBuffer,
        {
          headers: {
            Authorization: `OAuth ${accessToken}`,
            "file_offset": "0",
            "Content-Type": "application/octet-stream",
          },
        }
      );

      const fileHandle = uploadRes.data.h;

      // Step 3: Build header component
      headerComponent = {
        type: "HEADER",
        format: headerType, // IMAGE | VIDEO | DOCUMENT
        example: { header_handle: [fileHandle] },
      };

      // cleanup file
      fs.unlinkSync(file.path);
    } else if (headerType === "TEXT") {
      // Text header - use separate headerText field
      headerComponent = {
        type: "HEADER",
        format: "TEXT",
        text: headerText?.trim() || "Header text", // Use headerText instead of bodyText
      };
    }

    // Body component - always use bodyText
    const bodyComponent = {
      type: "BODY",
      text: bodyText || "Hello, this is a body text.",
    };

    // Footer component (optional)
    const footerComponent =
      footerText && footerText.trim()
        ? {
            type: "FOOTER",
            text: footerText.trim(),
          }
        : null;

    const components = [headerComponent, bodyComponent];
    if (footerComponent) components.push(footerComponent);

    // Step 4: Create template
    const templateRes = await axios.post(
      `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates`,
      {
        name: templateName,
        language: "en_US",
        category: "MARKETING",
        components,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    res.json({ success: true, data: templateRes.data });
  } catch (err) {
    console.error("❌ Error creating template:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// ADD THIS NEW ENDPOINT TO YOUR EXISTING BACKEND CODE

// ADD THIS NEW ENDPOINT TO YOUR EXISTING BACKEND CODE

app.post("/create-auth-template", async (req, res) => {
  const { templateName } = req.body; // ONLY templateName - no footer allowed!
  
  if (!templateName) {
    return res.status(400).json({ error: "Template name is required." });
  }

  // Same validation as your existing endpoint
  if (templateName !== templateName.toLowerCase()) {
    return res.status(400).json({ error: "Template name must be in lowercase." });
  }

  if (!/^[a-z0-9_]+$/.test(templateName)) {
    return res.status(400).json({ error: "Use only lowercase letters, numbers, and underscores." });
  }

  try {
    // Authentication template components - ONLY 2 components allowed!
    const components = [];

    // 1. Body component (required, preset by WhatsApp)
    const bodyComponent = {
      type: "BODY"
      // No text field - WhatsApp provides preset text: "{{1}} is your verification code"
    };
    components.push(bodyComponent);

    // 2. Button component (required for authentication)
    const buttonComponent = {
      type: "BUTTONS",
      buttons: [
        {
          type: "OTP",
          otp_type: "COPY_CODE"
        }
      ]
    };
    components.push(buttonComponent);

    // Create authentication template - NO FOOTER, NO HEADER allowed!
    const templateRes = await axios.post(
      `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates`,
      {
        name: templateName.trim(),
        language: "en_US",
        category: "AUTHENTICATION",
        components, // Only BODY + BUTTONS
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    res.json({ 
      success: true, 
      data: templateRes.data,
      message: "Authentication template created successfully"
    });

  } catch (err) {
    console.error("❌ Error creating authentication template:", err.response?.data || err.message);
    res.status(500).json({ 
      error: err.response?.data?.error?.message || err.message,
      details: err.response?.data
    });
  }
})
// New Endpoint: Fetch Templates
app.get("/api/templates", async (req, res) => {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          // Optional parameters
          limit: 100, // Adjust as needed
          // fields: 'id,name,status,category,language,components' // Specify fields if needed
        }
      }
    );

    res.json({
      success: true,
      data: response.data.data || [],
      paging: response.data.paging || null
    });
  } catch (err) {
    console.error("❌ Error fetching templates:", err.response?.data || err.message);
    res.status(500).json({ 
      success: false,
      error: err.response?.data || err.message 
    });
  }
});

// New Endpoint: Get Single Template Details
app.get("/api/templates/:templateId", async (req, res) => {
  const { templateId } = req.params;
  
  try {
    const response = await axios.get(
      `https://graph.facebook.com/${apiVersion}/${templateId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        }
      }
    );

    res.json({
      success: true,
      data: response.data
    });
  } catch (err) {
    console.error("❌ Error fetching template details:", err.response?.data || err.message);
    res.status(500).json({ 
      success: false,
      error: err.response?.data || err.message 
    });
  }
});

// Add these new endpoints to your existing Express.js server

// Delete Template Endpoint
app.delete("/api/templates/:templateId", async (req, res) => {
  const { templateId } = req.params;
  console.log("Deleting template ID:", templateId);
  try {
    const response = await axios.delete(
      `https://graph.facebook.com/${apiVersion}/${templateId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        }
      }
    );

    res.json({
      success: true,
      message: "Template deleted successfully",
      data: response.data
    });
  } catch (err) {
    console.error("❌ Error deleting template:", err.response?.data || err.message);
    res.status(500).json({ 
      success: false,
      error: err.response?.data || err.message 
    });
  }
});

// Delete Template by Name (Alternative approach - some APIs prefer template name)
app.delete("/api/templates/by-name/:templateName", async (req, res) => {
  const { templateName } = req.params;
  console.log("Deleting template by name:", templateName);
  try {
    // First, get all templates to find the one with matching name
    const templatesResponse = await axios.get(
      `https://graph.facebook.com/${wabaId}/message_templates`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          limit: 1000 // Get all templates to find the right one
        }
      }
    );

    const template = templatesResponse.data.data?.find(t => t.name === templateName);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: "Template not found"
      });
    }

    // Delete using template ID
    const deleteResponse = await axios.delete(
      `https://graph.facebook.com/${apiVersion}/${template.id}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        }
      }
    );

    res.json({
      success: true,
      message: "Template deleted successfully",
      data: deleteResponse.data
    });
  } catch (err) {
    console.error("❌ Error deleting template by name:", err.response?.data || err.message);
    res.status(500).json({ 
      success: false,
      error: err.response?.data || err.message 
    });
  }
});

// Edit Template Endpoint (Note: WhatsApp API has limitations on editing)
app.put("/api/templates/:templateId", async (req, res) => {
  const { templateId } = req.params;
  const updateData = req.body;
  
  try {
    // Note: WhatsApp API doesn't allow direct editing of approved templates
    // You typically need to create a new template version instead
    // This endpoint is for updating template metadata if supported
    
    const response = await axios.post(
      `https://graph.facebook.com/${apiVersion}/${templateId}`,
      updateData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      success: true,
      message: "Template updated successfully",
      data: response.data
    });
  } catch (err) {
    console.error("❌ Error updating template:", err.response?.data || err.message);
    
    // Check if the error is because editing isn't allowed
    if (err.response?.status === 400 && 
        err.response?.data?.error?.message?.includes('edit')) {
      return res.status(400).json({
        success: false,
        error: "Templates cannot be edited once approved. You can delete and create a new version instead.",
        canEdit: false
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: err.response?.data || err.message 
    });
  }
});

// Duplicate Template (Alternative to editing - create a copy)
app.post("/api/templates/:templateId/duplicate", async (req, res) => {
  const { templateId } = req.params;
  const { newName, modifications } = req.body;
  
  try {
    // First get the original template
    const originalResponse = await axios.get(
      `https://graph.facebook.com/${apiVersion}/${templateId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        }
      }
    );

    const originalTemplate = originalResponse.data;
    
    // Create new template data based on original
    const newTemplateData = {
      name: newName || `${originalTemplate.name}_copy`,
      category: originalTemplate.category,
      language: originalTemplate.language,
      components: modifications?.components || originalTemplate.components
    };
    
    // Apply any modifications
    if (modifications) {
      Object.assign(newTemplateData, modifications);
    }

    // Create the new template
    const createResponse = await axios.post(
      `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates`,
      newTemplateData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      success: true,
      message: "Template duplicated successfully",
      data: createResponse.data
    });
  } catch (err) {
    console.error("❌ Error duplicating template:", err.response?.data || err.message);
    res.status(500).json({ 
      success: false,
      error: err.response?.data || err.message 
    });
  }
});

// Bulk Delete Templates
app.delete("/api/templates/bulk", async (req, res) => {
  const { templateIds } = req.body;
  
  if (!Array.isArray(templateIds) || templateIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: "templateIds array is required"
    });
  }

  const results = [];
  const errors = [];

  try {
    // Delete templates in parallel (but be careful about rate limits)
    const deletePromises = templateIds.map(async (templateId) => {
      try {
        const response = await axios.delete(
          `https://graph.facebook.com/${apiVersion}/${templateId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            }
          }
        );
        return { templateId, success: true, data: response.data };
      } catch (error) {
        return { 
          templateId, 
          success: false, 
          error: error.response?.data || error.message 
        };
      }
    });

    const deleteResults = await Promise.all(deletePromises);
    
    deleteResults.forEach(result => {
      if (result.success) {
        results.push(result);
      } else {
        errors.push(result);
      }
    });

    res.json({
      success: errors.length === 0,
      message: `${results.length} templates deleted successfully${errors.length ? `, ${errors.length} failed` : ''}`,
      deleted: results,
      errors: errors
    });
  } catch (err) {
    console.error("❌ Error in bulk delete:", err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// Get Template Status/Analytics (useful for monitoring)
app.get("/api/templates/:templateId/status", async (req, res) => {
  const { templateId } = req.params;
  
  try {
    const response = await axios.get(
      `https://graph.facebook.com/${apiVersion}/${templateId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          fields: 'id,name,status,category,language,components,created_time,updated_time'
        }
      }
    );

    res.json({
      success: true,
      data: response.data
    });
  } catch (err) {
    console.error("❌ Error fetching template status:", err.response?.data || err.message);
    res.status(500).json({ 
      success: false,
      error: err.response?.data || err.message 
    });
  }
});

// Helper function to get template quality rating
app.get("/api/templates/:templateId/quality", async (req, res) => {
  const { templateId } = req.params;
  
  try {
    const response = await axios.get(
      `https://graph.facebook.com/${apiVersion}/${templateId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          fields: 'quality_score'
        }
      }
    );

    res.json({
      success: true,
      data: response.data
    });
  } catch (err) {
    console.error("❌ Error fetching template quality:", err.response?.data || err.message);
    res.status(500).json({ 
      success: false,
      error: err.response?.data || err.message 
    });
  }
});



app.get("/list-templates", async (req, res) => {
  try {
    const resp = await axios.get(
      `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    res.json(resp.data);
  } catch (err) {
    console.error("❌ Error fetching templates:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});


// ------------------ DELETE TEMPLATE ------------------
app.delete("/delete-template/:name", async (req, res) => {
  const { name } = req.params;

  if (!name) {
    return res.status(400).json({ error: "Template name is required." });
  }

  try {
    const resp = await axios.delete(
      `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates`,
      {
        params: { name: name.trim() }, // ✅ ensure trimmed, exact
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    res.json({ success: true, data: resp.data });
  } catch (err) {
    console.error("❌ Error deleting template:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// ------------------ UPDATE TEMPLATE ------------------
// ✅ Update Template (Safe Approach: create new template if name changes)
app.put("/update-template/:name", upload.single("file"), async (req, res) => {
  const { name } = req.params;
  const { newName, headerType, bodyText, footerText } = req.body;
  const file = req.file;

  try {
    // Step 1: Build header component
    let headerComponent = null;

    if (headerType !== "TEXT" && file) {
      // Upload media file
      const sessionRes = await axios.post(
        `https://graph.facebook.com/${apiVersion}/${appId}/uploads`,
        null,
        {
          params: {
            file_name: file.originalname,
            file_length: file.size,
            file_type: file.mimetype,
            access_token: accessToken,
          },
        }
      );

      const uploadSessionId = sessionRes.data.id;
      const fileBuffer = fs.readFileSync(file.path);

      const uploadRes = await axios.post(
        `https://graph.facebook.com/${apiVersion}/${uploadSessionId}`,
        fileBuffer,
        {
          headers: {
            Authorization: `OAuth ${accessToken}`,
            "file_offset": "0",
            "Content-Type": "application/octet-stream",
          },
        }
      );

      const fileHandle = uploadRes.data.h;

      headerComponent = {
        type: "HEADER",
        format: headerType,
        example: { header_handle: [fileHandle] },
      };

      fs.unlinkSync(file.path);
    } else if (headerType === "TEXT") {
      headerComponent = {
        type: "HEADER",
        format: "TEXT",
        text: bodyText?.substring(0, 60) || "Header text",
      };
    }

    // Step 2: Body + Footer
  

    const footerComponent =
      footerText && footerText.trim()
        ? { type: "FOOTER", text: footerText.trim() }
        : null;

    const components = [headerComponent, bodyComponent];
    if (footerComponent) components.push(footerComponent);

    // Step 3: Create new template (with new name if provided)
    const templateRes = await axios.post(
      `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates`,
      {
        name: newName || `${name}_v2`, // ✅ ensure new name
        language: "en_US",
        category: "MARKETING",
        components,
      },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    res.json({ success: true, data: templateRes.data });
  } catch (err) {
    console.error("❌ Error updating template:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});



const messageSchema = new mongoose.Schema({
    messageId: {
        type: String,
        required: true,
        unique: true
    },
    phoneNumberId: {
        type: String,
        required: true
    },
    to: {
        type: String,
        required: true
    },
    from: {
        type: String,
        required: true
    },
    direction: {
        type: String,
        enum: ['incoming', 'outgoing'],
        required: true
    },
    messageType: {
        type: String,
        enum: ['text', 'template', 'image', 'document', 'audio', 'video'],
        default: 'text'
    },
    content: {
        text: String,
        templateName: String,
        mediaUrl: String,
        caption: String
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read', 'failed'],
        default: 'sent'
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaign',
        default: null
    },
    metadata: {
        type: Object,
        default: {}
    }
});

const Message = mongoose.model('Message', messageSchema);

const webhookDataSchema = new mongoose.Schema({
    rawData: {
        type: mongoose.Schema.Types.Mixed, // Accepts any data type/structure
        required: true
    },
    dataType: {
        type: String,
        enum: ['whatsapp_message', 'whatsapp_history', 'whatsapp_status', 'unknown'],
        default: 'unknown'
    },
    source: {
        type: String,
        default: 'webhook'
    },
    requestHeaders: {
        type: Object,
        default: {}
    },
    // Add to your webhookDataSchema
processed: { type: Boolean, default: false },
    timestamp: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const WebhookData = mongoose.model('WebhookData', webhookDataSchema);


// Add this new API endpoint to your existing server file

// app.post('/api/campaigns/update-status', async (req, res) => {
//     try {
//         console.log('Processing message status updates...');
        
//         // Fetch all unprocessed webhook status data
//         const webhookStatusData = await WebhookData.find({
//             dataType: 'whatsapp_status',
//             processed: { $ne: true } // Only get unprocessed webhooks
//         }).sort({ timestamp: -1 });

//         let updatedCount = 0;
//         let notFoundCount = 0;

//         for (const webhook of webhookStatusData) {
//             try {
//                 const statuses = webhook.rawData?.entry?.[0]?.changes?.[0]?.value?.statuses;
                
//                 if (statuses && statuses.length > 0) {
//                     for (const status of statuses) {
//                         // Update campaign messageDetails
//                         const updateData = {
//                             "messageDetails.$.status": status.status,
//                             "messageDetails.$.webhookUpdatedAt": new Date()
//                         };

//                         // Add error info if status is failed
//                         if (status.status === 'failed' && status.errors) {
//                             updateData["messageDetails.$.error"] = status.errors[0].message;
//                             updateData["messageDetails.$.errorCode"] = status.errors[0].code.toString();
//                         }

//                         // Add delivery/read timestamps
//                         if (status.status === 'delivered') {
//                             updateData["messageDetails.$.deliveredAt"] = new Date(status.timestamp * 1000);
//                         } else if (status.status === 'read') {
//                             updateData["messageDetails.$.readAt"] = new Date(status.timestamp * 1000);
//                         }

//                         const updatedCampaign = await Campaign.findOneAndUpdate(
//                             { "messageDetails.messageId": status.id },
//                             { $set: updateData },
//                             { new: true }
//                         );

//                         if (updatedCampaign) {
//                             updatedCount++;
//                             console.log(`✅ Updated message ${status.id} to status: ${status.status}`);
                            
//                             // Recalculate campaign stats
//                             const messageDetails = updatedCampaign.messageDetails;
//                             const stats = {
//                                 totalContacts: messageDetails.length,
//                                 successfulMessages: messageDetails.filter(m => m.status === 'sent' || m.status === 'delivered' || m.status === 'read').length,
//                                 failedMessages: messageDetails.filter(m => m.status === 'failed').length,
//                                 deliveredMessages: messageDetails.filter(m => m.status === 'delivered' || m.status === 'read').length,
//                                 readMessages: messageDetails.filter(m => m.status === 'read').length
//                             };
//                             stats.successRate = messageDetails.length > 0 ? (stats.successfulMessages / stats.totalContacts * 100).toFixed(2) : 0;
                            
//                             // Update campaign stats
//                             await Campaign.findByIdAndUpdate(updatedCampaign._id, { stats });
                            
//                         } else {
//                             notFoundCount++;
//                             console.log(`❌ Message ${status.id} not found in any campaign`);
//                         }
//                     }
//                 }

//                 // Mark webhook as processed
//                 await WebhookData.findByIdAndUpdate(webhook._id, { processed: true });

//             } catch (webhookError) {
//                 console.error('Error processing webhook:', webhookError);
//             }
//         }

//         console.log(`✅ Status update complete: ${updatedCount} updated, ${notFoundCount} not found`);
        
//         res.json({
//             success: true,
//             updatedCount,
//             notFoundCount,
//             message: `Updated ${updatedCount} message statuses`
//         });

//     } catch (error) {
//         console.error('❌ Error updating message statuses:', error);
//         res.status(500).json({
//             success: false,
//             error: error.message
//         });
//     }
// });
app.post('/api/campaigns/update-status', async (req, res) => {
    try {
        console.log('Processing message status updates...');
        
        // Fetch all unprocessed webhook status data
        const webhookStatusData = await WebhookData.find({
            dataType: 'whatsapp_status',
            processed: { $ne: true }
        }).sort({ timestamp: -1 });

        let updatedCount = 0;
        let notFoundCount = 0;
        let processedWebhooks = 0;

        for (const webhook of webhookStatusData) {
            try {
                const statuses = webhook.rawData?.entry?.[0]?.changes?.[0]?.value?.statuses;
                
                if (statuses && statuses.length > 0) {
                    for (const status of statuses) {
                        console.log(`Processing status update for message ${status.id}: ${status.status}`);
                        
                        // Prepare update data based on status
                        const updateData = {
                            "messageDetails.$.status": status.status,
                            "messageDetails.$.webhookUpdatedAt": new Date()
                        };

                        // Handle different status types
                        switch (status.status) {
                            case 'delivered':
                                if (status.timestamp) {
                                    updateData["messageDetails.$.deliveredAt"] = new Date(status.timestamp * 1000);
                                }
                                console.log(`📨 Message ${status.id} delivered at ${new Date(status.timestamp * 1000)}`);
                                break;
                                
                            case 'read':
                                if (status.timestamp) {
                                    updateData["messageDetails.$.readAt"] = new Date(status.timestamp * 1000);
                                }
                                console.log(`👁️ Message ${status.id} read at ${new Date(status.timestamp * 1000)}`);
                                break;
                                
                            case 'failed':
                                if (status.errors && status.errors.length > 0) {
                                    updateData["messageDetails.$.error"] = status.errors[0].message || 'Message failed';
                                    updateData["messageDetails.$.errorCode"] = status.errors[0].code?.toString() || 'unknown';
                                    updateData["messageDetails.$.errorType"] = status.errors[0].error_data?.details || 'general_error';
                                }
                                console.log(`❌ Message ${status.id} failed: ${status.errors?.[0]?.message || 'Unknown error'}`);
                                break;
                                
                            case 'sent':
                                console.log(`✅ Message ${status.id} confirmed sent`);
                                break;
                                
                            default:
                                console.log(`ℹ️ Message ${status.id} status: ${status.status}`);
                        }

                        // Update the campaign with new status
                        const updatedCampaign = await Campaign.findOneAndUpdate(
                            { "messageDetails.messageId": status.id },
                            { $set: updateData },
                            { new: true }
                        );

                        if (updatedCampaign) {
                            updatedCount++;
                            console.log(`✅ Successfully updated message ${status.id} to status: ${status.status}`);
                            
                            // Recalculate campaign statistics
                            await recalculateCampaignStats(updatedCampaign._id);
                            
                        } else {
                            notFoundCount++;
                            console.log(`❌ Message ${status.id} not found in any campaign`);
                        }
                    }
                } else {
                    console.log('⚠️ No status data found in webhook');
                }

                // Mark webhook as processed
                await WebhookData.findByIdAndUpdate(webhook._id, { 
                    processed: true,
                    processedAt: new Date()
                });
                processedWebhooks++;

            } catch (webhookError) {
                console.error('❌ Error processing individual webhook:', webhookError);
                // Mark as processed even if there's an error to avoid reprocessing
                await WebhookData.findByIdAndUpdate(webhook._id, { 
                    processed: true,
                    processingError: webhookError.message,
                    processedAt: new Date()
                });
            }
        }

        console.log(`🎉 Status update complete: ${updatedCount} updated, ${notFoundCount} not found, ${processedWebhooks} webhooks processed`);
        
        res.json({
            success: true,
            updatedCount,
            notFoundCount,
            processedWebhooks,
            message: `Updated ${updatedCount} message statuses from ${processedWebhooks} webhooks`
        });

    } catch (error) {
        console.error('❌ Error updating message statuses:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Helper function to recalculate campaign statistics
async function recalculateCampaignStats(campaignId) {
    try {
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) return;

        const messageDetails = campaign.messageDetails;
        const stats = {
            totalContacts: messageDetails.length,
            successfulMessages: messageDetails.filter(m => 
                ['sent', 'delivered', 'read'].includes(m.status)
            ).length,
            failedMessages: messageDetails.filter(m => m.status === 'failed').length,
            deliveredMessages: messageDetails.filter(m => 
                ['delivered', 'read'].includes(m.status)
            ).length,
            readMessages: messageDetails.filter(m => m.status === 'read').length
        };
        
        stats.successRate = messageDetails.length > 0 
            ? parseFloat((stats.successfulMessages / stats.totalContacts * 100).toFixed(2))
            : 0;
        
        stats.deliveryRate = messageDetails.length > 0 
            ? parseFloat((stats.deliveredMessages / stats.totalContacts * 100).toFixed(2))
            : 0;
            
        stats.readRate = messageDetails.length > 0 
            ? parseFloat((stats.readMessages / stats.totalContacts * 100).toFixed(2))
            : 0;

        // Update campaign stats and timestamp
        await Campaign.findByIdAndUpdate(campaignId, { 
            stats,
            updatedAt: new Date()
        });

        console.log(`📊 Updated stats for campaign ${campaignId}:`, {
            total: stats.totalContacts,
            successful: stats.successfulMessages,
            delivered: stats.deliveredMessages,
            read: stats.readMessages,
            failed: stats.failedMessages,
            successRate: `${stats.successRate}%`,
            deliveryRate: `${stats.deliveryRate}%`,
            readRate: `${stats.readRate}%`
        });

    } catch (error) {
        console.error('❌ Error recalculating campaign stats:', error);
    }
}


// Add these routes to your backend Express.js file

// 1. Enhanced GET route for detailed campaigns


// 2. Route for batch campaign saving (for large campaigns)
app.post('/api/campaigns/batch', async (req, res) => {
  try {
    const {
      campaignName,
      templateName,
      phoneNumberId,
      headerType,
      contacts,
      messageDetails,
      status,
      userPhone,
      batchNumber,
      parentCampaign,
      stats
    } = req.body;

    const campaign = new Campaign({
      campaignName,
      templateName,
      phoneNumberId,
      headerType,
      contacts: contacts || [],
      messageDetails: messageDetails || [],
      status,
      userPhone,
      batchNumber,
      parentCampaign,
      stats,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const savedCampaign = await campaign.save();
    res.json({ 
      success: true, 
      campaign: savedCampaign,
      message: `Batch ${batchNumber} saved successfully`
    });
  } catch (error) {
    console.error('Error saving batch campaign:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save batch campaign',
      details: error.message 
    });
  }
});

// 3. Route for resending failed messages
app.post('/api/campaigns/resend-failed', async (req, res) => {
  try {
    const { campaignId, failedMessages, accessToken, phoneNumberId } = req.body;
    
    if (!failedMessages || failedMessages.length === 0) {
      return res.json({ success: false, message: 'No failed messages to resend' });
    }

    let successCount = 0;
    let failedCount = 0;
    const resendResults = [];

    // Process each failed message
    for (const message of failedMessages) {
      try {
        const payload = {
          messaging_product: "whatsapp",
          to: message.phoneNumber,
          type: "template",
          template: {
            name: message.messageContent?.template?.name || "hello_world",
            language: { code: "en_US" }
          }
        };

        // Add any components if they existed in original message
        if (message.messageContent?.template?.components) {
          payload.template.components = message.messageContent.template.components;
        }

        const response = await fetch(
          `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );

        const data = await response.json();

        if (data.messages && data.messages[0]) {
          successCount++;
          resendResults.push({
            phoneNumber: message.phoneNumber,
            status: 'success',
            messageId: data.messages[0].id,
            newStatus: 'pending'
          });

          // Update the message status in database
          await Campaign.updateOne(
            { 
              _id: campaignId,
              'messageDetails.phoneNumber': message.phoneNumber 
            },
            { 
              $set: { 
                'messageDetails.$.status': 'pending',
                'messageDetails.$.messageId': data.messages[0].id,
                'messageDetails.$.retryCount': (message.retryCount || 0) + 1,
                'messageDetails.$.error': null,
                'messageDetails.$.errorCode': null,
                'messageDetails.$.sentAt': new Date()
              } 
            }
          );
        } else {
          failedCount++;
          const errorMsg = data.error?.message || 'Resend failed';
          resendResults.push({
            phoneNumber: message.phoneNumber,
            status: 'failed',
            error: errorMsg
          });

          // Update retry count even for failed attempts
          await Campaign.updateOne(
            { 
              _id: campaignId,
              'messageDetails.phoneNumber': message.phoneNumber 
            },
            { 
              $set: { 
                'messageDetails.$.retryCount': (message.retryCount || 0) + 1,
                'messageDetails.$.error': errorMsg
              } 
            }
          );
        }

        // Small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        failedCount++;
        console.error(`Error resending to ${message.phoneNumber}:`, error);
        resendResults.push({
          phoneNumber: message.phoneNumber,
          status: 'error',
          error: error.message
        });
      }
    }

    // Update campaign stats after resend
    const campaign = await Campaign.findById(campaignId);
    if (campaign && campaign.messageDetails) {
      const updatedStats = {
        totalContacts: campaign.messageDetails.length,
        successfulMessages: campaign.messageDetails.filter(msg => 
          msg.status === 'sent' || msg.status === 'delivered' || msg.status === 'pending'
        ).length,
        failedMessages: campaign.messageDetails.filter(msg => msg.status === 'failed').length,
        deliveredMessages: campaign.messageDetails.filter(msg => msg.status === 'delivered').length,
        readMessages: campaign.messageDetails.filter(msg => msg.status === 'read').length,
      };
      
      updatedStats.successRate = updatedStats.totalContacts > 0 
        ? (updatedStats.successfulMessages / updatedStats.totalContacts) * 100 
        : 0;

      await Campaign.findByIdAndUpdate(campaignId, { 
        stats: updatedStats,
        updatedAt: new Date()
      });
    }

    res.json({
      success: true,
      successCount,
      failedCount,
      totalProcessed: failedMessages.length,
      results: resendResults,
      message: `Resend completed. Success: ${successCount}, Failed: ${failedCount}`
    });

  } catch (error) {
    console.error('Error in resend failed messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resend messages',
      details: error.message
    });
  }
});

// 4. Enhanced status update route
app.post('/api/campaigns/update-status', async (req, res) => {
  try {
    const campaigns = await Campaign.find({ 
      'messageDetails.messageId': { $exists: true, $ne: null },
      'messageDetails.status': { $in: ['pending', 'sent'] }
    });

    let updatedCount = 0;
    let notFoundCount = 0;

    for (const campaign of campaigns) {
      const accessToken = "YOUR_ACCESS_TOKEN"; // You should pass this from frontend
      
      for (const messageDetail of campaign.messageDetails) {
        if (messageDetail.messageId && (messageDetail.status === 'pending' || messageDetail.status === 'sent')) {
          try {
            const response = await fetch(
              `https://graph.facebook.com/v18.0/${messageDetail.messageId}`,
              {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            if (response.ok) {
              const data = await response.json();
              let newStatus = messageDetail.status;
              let deliveredAt = messageDetail.deliveredAt;
              let readAt = messageDetail.readAt;

              // Update based on WhatsApp API response
              if (data.status) {
                switch (data.status) {
                  case 'delivered':
                    newStatus = 'delivered';
                    deliveredAt = new Date();
                    break;
                  case 'read':
                    newStatus = 'read';
                    readAt = new Date();
                    break;
                  case 'failed':
                    newStatus = 'failed';
                    break;
                }
              }

              // Update in database if status changed
              if (newStatus !== messageDetail.status) {
                await Campaign.updateOne(
                  { 
                    _id: campaign._id,
                    'messageDetails.messageId': messageDetail.messageId
                  },
                  { 
                    $set: { 
                      'messageDetails.$.status': newStatus,
                      'messageDetails.$.deliveredAt': deliveredAt,
                      'messageDetails.$.readAt': readAt,
                      updatedAt: new Date()
                    } 
                  }
                );
                updatedCount++;
              }
            } else {
              notFoundCount++;
            }

            // Rate limiting delay
            await new Promise(resolve => setTimeout(resolve, 100));

          } catch (error) {
            console.error(`Error checking status for message ${messageDetail.messageId}:`, error);
            notFoundCount++;
          }
        }
      }

      // Recalculate campaign stats
      const updatedCampaign = await Campaign.findById(campaign._id);
      if (updatedCampaign?.messageDetails) {
        const stats = {
          totalContacts: updatedCampaign.messageDetails.length,
          successfulMessages: updatedCampaign.messageDetails.filter(msg => 
            msg.status === 'sent' || msg.status === 'delivered' || msg.status === 'pending'
          ).length,
          failedMessages: updatedCampaign.messageDetails.filter(msg => msg.status === 'failed').length,
          deliveredMessages: updatedCampaign.messageDetails.filter(msg => msg.status === 'delivered').length,
          readMessages: updatedCampaign.messageDetails.filter(msg => msg.status === 'read').length,
        };
        
        stats.successRate = stats.totalContacts > 0 
          ? (stats.successfulMessages / stats.totalContacts) * 100 
          : 0;

        await Campaign.findByIdAndUpdate(campaign._id, { 
          stats,
          updatedAt: new Date()
        });
      }
    }

    res.json({
      success: true,
      updatedCount,
      notFoundCount,
      message: `Status update completed. Updated: ${updatedCount}, Not found: ${notFoundCount}`
    });

  } catch (error) {
    console.error('Error updating message statuses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update message statuses',
      details: error.message
    });
  }
});
// Also update your WebhookData schema to include processed field
// Add this to your webhookDataSchema:
// processed: { type: Boolean, default: false }
app.get('/api/conversations/:phoneNumberId', async (req, res) => {
    try {
        const { phoneNumberId } = req.params;
        console.log(`Fetching all conversations for Phone Number ID: ${phoneNumberId}`);
        
        // Get all documents for this phone number
        const allDocs = await WebhookData.find({
            'rawData.entry.0.changes.0.value.metadata.phone_number_id': phoneNumberId
        });
        
        console.log(`Found ${allDocs.length} total documents for phone ${phoneNumberId}`);
        
        // Process documents manually to avoid aggregation issues
        const conversationMap = new Map();
        
        allDocs.forEach(doc => {
            const value = doc.rawData?.entry?.[0]?.changes?.[0]?.value;
            if (!value) return;
            
            let customerNumber = null;
            let lastMessageText = 'No content';
            let contactName = null;
            let messageType = 'status';
            
            // Extract customer number and message info
            if (value.messages && value.messages.length > 0) {
                const message = value.messages[0];
                customerNumber = message.from;
                lastMessageText = message.text?.body || 'No text content';
                messageType = message.type || 'text';
            } else if (value.statuses && value.statuses.length > 0) {
                const status = value.statuses[0];
                customerNumber = status.recipient_id;
                lastMessageText = `Status: ${status.status}`;
                messageType = 'status';
            }
            
            // Extract contact name
            if (value.contacts && value.contacts.length > 0) {
                contactName = value.contacts[0].profile?.name || null;
            }
            
            // Skip if no customer number found
            if (!customerNumber) return;
            
            // Update conversation map
            if (conversationMap.has(customerNumber)) {
                const existing = conversationMap.get(customerNumber);
                existing.totalMessages++;
                if (doc.createdAt > existing.lastActivity) {
                    existing.lastActivity = doc.createdAt;
                    existing.lastMessage = lastMessageText;
                    existing.messageType = messageType;
                    if (contactName) {
                        existing.contactName = contactName;
                    }
                }
            } else {
                conversationMap.set(customerNumber, {
                    customerNumber,
                    contactName,
                    totalMessages: 1,
                    lastActivity: doc.createdAt,
                    lastMessage: lastMessageText,
                    messageType
                });
            }
        });
        
        // Convert map to array and sort
        const conversations = Array.from(conversationMap.values())
            .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
        
        console.log('Processed conversations:', JSON.stringify(conversations, null, 2));

        res.json({
            phoneNumberId,
            conversations: conversations.map(conv => ({
                customerNumber: conv.customerNumber,
                contactName: conv.contactName,
                totalMessages: conv.totalMessages,
                lastActivity: conv.lastActivity,
                lastMessage: conv.lastMessage || 'No message',
                messageType: conv.messageType,
                unreadCount: 0
            })),
            totalConversations: conversations.length
        });
        
        console.log(`Total conversations found: ${conversations.length}`);
        
    } catch (error) {
        console.error('Error fetching phone number conversations:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Updated API endpoint to get conversation summary for each phone number
app.get('/api/conversations/summary', async (req, res) => {
    try {
        const conversations = await WebhookData.aggregate([
            {
                $match: {
                    dataType: { $in: ['whatsapp_message', 'whatsapp_status'] }
                }
            },
            {
                $addFields: {
                    phoneNumberId: {
                        $cond: {
                            if: { $ne: ['$rawData.entry.0.changes.0.value.metadata.phone_number_id', null] },
                            then: '$rawData.entry.0.changes.0.value.metadata.phone_number_id',
                            else: '$rawData.metadata.phone_number_id'
                        }
                    },
                    customerNumber: {
                        $cond: {
                            if: { $eq: ['$dataType', 'whatsapp_message'] },
                            then: {
                                $cond: {
                                    if: { $ne: ['$rawData.entry.0.changes.0.value.messages.0.from', null] },
                                    then: '$rawData.entry.0.changes.0.value.messages.0.from',
                                    else: {
                                        $cond: {
                                            if: { $ne: ['$rawData.messages.0.from', null] },
                                            then: '$rawData.messages.0.from',
                                            else: '$rawData.entry.0.changes.0.value.statuses.0.recipient_id'
                                        }
                                    }
                                }
                            },
                            else: '$rawData.entry.0.changes.0.value.statuses.0.recipient_id'
                        }
                    },
                    lastMessageText: {
                        $cond: {
                            if: { $ne: ['$rawData.entry.0.changes.0.value.messages.0.text.body', null] },
                            then: '$rawData.entry.0.changes.0.value.messages.0.text.body',
                            else: {
                                $cond: {
                                    if: { $ne: ['$rawData.messages.0.text.body', null] },
                                    then: '$rawData.messages.0.text.body',
                                    else: {
                                        $cond: {
                                            if: { $ne: ['$rawData.entry.0.changes.0.value.statuses.0.status', null] },
                                            then: { $concat: ['Status: ', '$rawData.entry.0.changes.0.value.statuses.0.status'] },
                                            else: 'Message'
                                        }
                                    }
                                }
                            }
                        }
                    },
                    contactName: {
                        $cond: {
                            if: { $ne: ['$rawData.entry.0.changes.0.value.contacts.0.profile.name', null] },
                            then: '$rawData.entry.0.changes.0.value.contacts.0.profile.name',
                            else: null
                        }
                    }
                }
            },
            {
                $match: {
                    phoneNumberId: { $ne: null },
                    customerNumber: { $ne: null }
                }
            },
            {
                $group: {
                    _id: {
                        phoneNumberId: '$phoneNumberId',
                        customerNumber: '$customerNumber'
                    },
                    totalMessages: { $sum: 1 },
                    lastActivity: { $max: '$createdAt' },
                    lastMessage: { $first: '$lastMessageText' },
                    contactName: { $first: '$contactName' },
                    lastMessageData: { $first: '$rawData' }
                }
            },
            {
                $group: {
                    _id: '$_id.phoneNumberId',
                    conversations: {
                        $push: {
                            customerNumber: '$_id.customerNumber',
                            totalMessages: '$totalMessages',
                            lastActivity: '$lastActivity',
                            lastMessage: '$lastMessage',
                            contactName: '$contactName',
                            lastMessageData: '$lastMessageData'
                        }
                    },
                    totalConversations: { $sum: 1 },
                    totalMessages: { $sum: '$totalMessages' }
                }
            },
            {
                $sort: { totalMessages: -1 }
            }
        ]);

        res.json({
            phoneNumbers: conversations,
            summary: {
                totalPhoneNumbers: conversations.length,
                totalConversations: conversations.reduce((sum, phone) => sum + phone.totalConversations, 0),
                totalMessages: conversations.reduce((sum, phone) => sum + phone.totalMessages, 0)
            }
        });
    } catch (error) {
        console.error('Error fetching conversation summary:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Updated API endpoint to get messages for a specific phone number and customer
// app.get('/api/conversations/:phoneNumberId/:customerNumber', async (req, res) => {
//     try {
//         const { phoneNumberId, customerNumber } = req.params;
//         console.log(`Fetching conversation for Phone Number ID: ${phoneNumberId}, Customer Number: ${customerNumber}`);
//         const page = parseInt(req.query.page) || 1;
//         const limit = parseInt(req.query.limit) || 50;
//         const skip = (page - 1) * limit;

//         // Build query to find messages between the phone number and customer
//       // Replace the existing query with this:
// const messages = await WebhookData.find({
//     $and: [
//         {
//             $or: [
//                 { 'rawData.entry.0.changes.0.value.metadata.phone_number_id': phoneNumberId },
//                 { 'rawData.metadata.phone_number_id': phoneNumberId }
//             ]
//         },
//         {
//             $or: [
//                 // Incoming messages from customer
//                 { 'rawData.entry.0.changes.0.value.messages.0.from': customerNumber },
//                 // Alternative message structure
//                 { 'rawData.messages.0.from': customerNumber },
//                 // Outgoing message statuses to customer  
//                 { 'rawData.entry.0.changes.0.value.statuses.0.recipient_id': customerNumber },
//                 // Alternative status structure
//                 { 'rawData.statuses.0.recipient_id': customerNumber }
//             ]
//         },
//         {
//             // Ensure we have actual message or status data
//             $or: [
//                 { 'rawData.entry.0.changes.0.value.messages': { $exists: true, $ne: [] } },
//                 { 'rawData.entry.0.changes.0.value.statuses': { $exists: true, $ne: [] } },
//                 { 'rawData.messages': { $exists: true, $ne: [] } },
//                 { 'rawData.statuses': { $exists: true, $ne: [] } }
//             ]
//         }
//     ]
// })
//         .sort({ createdAt: 1 }) // Changed to ascending order to show chronological conversation
//         .skip(skip)
//         .limit(limit);

//         // Enhanced message processing to extract all relevant information
//        const processedMessages = messages.map(msg => {
//     const rawData = msg.rawData;
//     let messageData = {
//         id: msg._id,
//         timestamp: msg.createdAt,
//         type: msg.dataType,
//         direction: 'unknown',
//         content: {}
//     };

//     // Check for incoming messages in nested structure
//     const entryMessages = rawData.entry?.[0]?.changes?.[0]?.value?.messages;
//     const directMessages = rawData.messages;
//     const entryStatuses = rawData.entry?.[0]?.changes?.[0]?.value?.statuses;
//     const directStatuses = rawData.statuses;

//     // Process incoming messages
//     if (entryMessages && entryMessages.length > 0) {
//         const message = entryMessages[0];
//         messageData.direction = 'incoming';
//         messageData.content = {
//             type: message.type || 'text',
//             text: message.text?.body || '',
//             from: message.from,
//             messageId: message.id,
//             timestamp: message.timestamp
//         };
//     } else if (directMessages && directMessages.length > 0) {
//         const message = directMessages[0];
//         messageData.direction = 'incoming';
//         messageData.content = {
//             type: message.type || 'text',
//             text: message.text?.body || '',
//             from: message.from,
//             messageId: message.id,
//             timestamp: message.timestamp
//         };
//     }
//     // Process status updates (outgoing)
//     else if (entryStatuses && entryStatuses.length > 0) {
//         const status = entryStatuses[0];
//         messageData.direction = 'outgoing';
//         messageData.content = {
//             type: 'status',
//             status: status.status,
//             recipient_id: status.recipient_id,
//             messageId: status.id,
//             timestamp: status.timestamp,
//             text: `Message ${status.status}`
//         };
//     } else if (directStatuses && directStatuses.length > 0) {
//         const status = directStatuses[0];
//         messageData.direction = 'outgoing';
//         messageData.content = {
//             type: 'status',
//             status: status.status,
//             recipient_id: status.recipient_id,
//             messageId: status.id,
//             timestamp: status.timestamp,
//             text: `Message ${status.status}`
//         };
//     }

//     return messageData;
// });
//      const total = await WebhookData.countDocuments({
//     $and: [
//         {
//             $or: [
//                 { 'rawData.entry.0.changes.0.value.metadata.phone_number_id': phoneNumberId },
//                 { 'rawData.metadata.phone_number_id': phoneNumberId }
//             ]
//         },
//         {
//             $or: [
//                 { 'rawData.entry.0.changes.0.value.messages.0.from': customerNumber },
//                 { 'rawData.messages.0.from': customerNumber },
//                 { 'rawData.entry.0.changes.0.value.statuses.0.recipient_id': customerNumber },
//                 { 'rawData.statuses.0.recipient_id': customerNumber }
//             ]
//         }
//     ]
// });

//         res.json({
          
//             messages: processedMessages,
//             pagination: {
//                 page,
//                 limit,
//                 total,
//                 pages: Math.ceil(total / limit)
//             },
//             conversation: {
//                 phoneNumberId,
//                 customerNumber
//             }
//         });
        
//     } catch (error) {
//         console.error('Error fetching conversation messages:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// });
app.get('/api/conversations/:phoneNumberId/:customerNumber', async (req, res) => {
    try {
        const { phoneNumberId, customerNumber } = req.params;
        console.log(`Fetching messages for Phone: ${phoneNumberId}, Customer: ${customerNumber}`);
        
        // Get webhook messages
        const webhookMessages = await WebhookData.find({
            $or: [
                { 'rawData.entry.0.changes.0.value.messages.0.from': customerNumber },
                { 'rawData.entry.0.changes.0.value.statuses.0.recipient_id': customerNumber }
            ],
            'rawData.entry.0.changes.0.value.metadata.phone_number_id': phoneNumberId
        }).sort({ createdAt: 1 });
 const storedMessages = await Message.find({
            phoneNumberId: phoneNumberId,
            $or: [
                { to: customerNumber },
                { from: customerNumber }
            ]
        }).sort({ timestamp: 1 });
        // Get campaign messages for this customer and phone number
        const campaignMessages = await Campaign.find({
            phoneNumberId: phoneNumberId,
            'messageDetails.phoneNumber': customerNumber.replace(/^\+?91/, '') // Remove +91 if present
        }).sort({ createdAt: 1 });

        const messages = [];

        // Process webhook messages (incoming and status updates)
        webhookMessages.forEach(doc => {
            const value = doc.rawData?.entry?.[0]?.changes?.[0]?.value;
            if (!value) return;
 let contactName = null;
    if (value.contacts && value.contacts.length > 0) {
        contactName = value.contacts[0].profile?.name;
    }
            // Incoming messages
            if (value.messages && value.messages.length > 0) {
                const message = value.messages[0];
                messages.push({
                    id: message.id,
                    direction: 'incoming',
                    content: {
                        text: message.text?.body || 'No content',
                        type: message.type
                    },
                    timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
                    from: message.from,
                    contactName: contactName // Add this line

                });
            }

            // Status updates for outgoing messages
            if (value.statuses && value.statuses.length > 0) {
                const status = value.statuses[0];
                // Update existing outgoing message status if found
                const existingMsg = messages.find(m => m.id === status.id);
                if (existingMsg) {
                    existingMsg.content.status = status.status;
                }
            }
        });

        // Process campaign messages (outgoing template messages)
        for (const campaign of campaignMessages) {
            const messageDetail = campaign.messageDetails.find(
                detail => detail.phoneNumber === customerNumber.replace(/^\+?91/, '')
            );
            
            if (messageDetail) {
                let templateContent = '';
                
                // Fetch template details from Meta API if templateName exists
                if (campaign.templateName) {
                    try {
                        const templateResponse = await fetch(
                            `https://graph.facebook.com/v20.0/1377314883331309/message_templates?name=${campaign.templateName.trim()}`,
                            {
                                headers: {
                                    'Authorization': `Bearer ${accessToken}` // You'll need to pass this
                                }
                            }
                        );
                        
                        if (templateResponse.ok) {
                            const templateData = await templateResponse.json();
                            if (templateData.data && templateData.data.length > 0) {
                                const template = templateData.data[0];
                                const components = template.components || [];
                                
                                // Build template content from components
                                const headerComponent = components.find(c => c.type === 'HEADER');
                                const bodyComponent = components.find(c => c.type === 'BODY');
                                
                                if (headerComponent && headerComponent.text) {
                                    templateContent += `*${headerComponent.text}*\n`;
                                }
                                if (bodyComponent && bodyComponent.text) {
                                    templateContent += bodyComponent.text;
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error fetching template:', error);
                        templateContent = `Template: ${campaign.templateName}`;
                    }
                }

                messages.push({
                    id: messageDetail.messageId,
                    direction: 'outgoing',
                    content: {
                        text: templateContent || `Campaign: ${campaign.campaignName}`,
                        type: 'template',
                        templateName: campaign.templateName,
                        status: messageDetail.status
                    },
                    timestamp: messageDetail.sentAt,
                    campaignId: campaign._id,
                    campaignName: campaign.campaignName
                });
            }
        }
storedMessages.forEach(msg => {
            messages.push({
                id: msg.messageId,
                direction: msg.direction,
                content: {
                    text: msg.content.text,
                    type: msg.messageType,
                    status: msg.status
                },
                timestamp: msg.timestamp,
                from: msg.direction === 'incoming' ? msg.from : msg.to,
                messageSource: 'stored' // To identify source
            });
        });
        // Sort all messages by timestamp
        messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        console.log(`Found ${messages.length} messages for conversation`);
        
        // res.json({
        //     phoneNumberId,
        //     customerNumber,
        //         contactName: messages.find(m => m.contactName)?.contactName || null, // Add this

        //     messages,
        //     totalMessages: messages.length
        // });
//  messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        res.json({
            phoneNumberId,
            customerNumber,
            contactName: messages.find(m => m.contactName)?.contactName || null,
            messages,
            totalMessages: messages.length
        });
    } catch (error) {
        console.error('Error fetching conversation messages:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Updated API endpoint to get all conversations for a specific phone number



app.post('/api/send-message', async (req, res) => {
    try {
        const { phoneNumberId, to, message, accessToken } = req.body;

        if (!phoneNumberId || !to || !message || !accessToken) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Make API call to WhatsApp Business API
        const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: to,
                type: 'text',
                text: { body: message }
            })
        });

        if (!response.ok) {
            throw new Error(`WhatsApp API error! status: ${response.status}`);
        }

        const data = await response.json();
        const messageId = data.messages[0].id;

        // Store the outgoing message in database
        const newMessage = new Message({
            messageId: messageId,
            phoneNumberId: phoneNumberId,
            to: to,
            from: phoneNumberId, // Business phone number
            direction: 'outgoing',
            messageType: 'text',
            content: {
                text: message
            },
            status: 'sent',
            timestamp: new Date()
        });

        await newMessage.save();
        console.log('Message stored in database:', newMessage);

        res.json({
            success: true,
            messageId: messageId,
            data: data
        });

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message', details: error.message });
    }
});

// // API endpoint to send a message (you'll need to implement the actual WhatsApp API call)
// app.post('/api/send-message', async (req, res) => {
//     try {
//         const { phoneNumberId, to, message, accessToken } = req.body;

//         if (!phoneNumberId || !to || !message || !accessToken) {
//             return res.status(400).json({ error: 'Missing required fields' });
//         }

//         // Make API call to WhatsApp Business API
//         const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
//             method: 'POST',
//             headers: {
//                 'Authorization': `Bearer ${accessToken}`,
//                 'Content-Type': 'application/json',
//             },
//             body: JSON.stringify({
//                 messaging_product: 'whatsapp',
//                 to: to,
//                 type: 'text',
//                 text: { body: message }
//             })
//         });

//         if (!response.ok) {
//             throw new Error(`WhatsApp API error! status: ${response.status}`);
//         }

//         const data = await response.json();
//         console.log('Message sent successfully:', data);

//         res.json({
//             success: true,
//             messageId: data.messages[0].id,
//             data: data
//         });

//     } catch (error) {
//         console.error('Error sending message:', error);
//         res.status(500).json({ error: 'Failed to send message', details: error.message });
//     }
// });

// app.post('/webhook', async (req, res) => {
//     console.log('Received WhatsApp webhook at:', new Date().toISOString());
//     console.log('Full payload:', JSON.stringify(req.body, null, 2));

//     try {
//         // Determine data type based on payload structure
//         let dataType = 'unknown';
        
//         if (req.body.field === 'history') {
//             dataType = 'whatsapp_history';
//         } else if (req.body.entry && req.body.entry[0] && req.body.entry[0].changes) {
//             const changes = req.body.entry[0].changes[0];
//             if (changes.value && changes.value.messages) {
//                 dataType = 'whatsapp_message';
//             } else if (changes.value && changes.value.statuses) {
//                 dataType = 'whatsapp_status';
//             }
//         } else if (req.body.messages) {
//             dataType = 'whatsapp_message';
//         }

//         // Create webhook data object
//         const webhookData = {
//             rawData: req.body, // Store complete payload as-is
//             dataType: dataType,
//             source: 'webhook',
//             requestHeaders: {
//                 'user-agent': req.headers['user-agent'],
//                 'content-type': req.headers['content-type'],
//                 'x-forwarded-for': req.headers['x-forwarded-for'],
//                 'authorization': req.headers['authorization'] ? '[HIDDEN]' : undefined
//             },
//             timestamp: new Date()
//         };

//         // Save to MongoDB
//         const newWebhookData = new WebhookData(webhookData);
//         const savedData = await newWebhookData.save();
        
//         console.log(`Webhook data saved to MongoDB with ID: ${savedData._id}`);
//         console.log(`Data type detected: ${dataType}`);

//         res.status(200).json({
//             status: 'received',
//             id: savedData._id,
//             dataType: dataType,
//             timestamp: savedData.timestamp,
//             message: 'Webhook data stored successfully'
//         });

//     } catch (error) {
//         console.error('Error processing webhook:', error);
//         res.status(500).json({ 
//             error: 'Internal server error',
//             message: error.message 
//         });
//     }
// });
const autoReplyRuleSchema = new mongoose.Schema({
    name: String,
    phoneNumberId: String,
    isActive: { type: Boolean, default: true },
    triggerType: {
        type: String,
        enum: ['first_reply', 'keyword', 'campaign_response'],
        default: 'first_reply'
    },
    keywords: [String], // For keyword triggers
    campaignId: String, // For campaign-specific replies
    responseMessage: String, // The auto-reply message
    maxExecutions: { type: Number, default: 1 }, // How many times per customer
    timeDelay: { type: Number, default: 0 }, // Delay in seconds
    createdAt: { type: Date, default: Date.now }
});

const AutoReplyRule = mongoose.model('AutoReplyRule', autoReplyRuleSchema);

// Auto-Reply Log Schema
const autoReplyLogSchema = new mongoose.Schema({
    ruleId: String,
    phoneNumberId: String,
    customerNumber: String,
    messageContent: String,
    sentAt: { type: Date, default: Date.now }
});

const AutoReplyLog = mongoose.model('AutoReplyLog', autoReplyLogSchema);

// ADD THIS FUNCTION TO YOUR INDEX.JS

// async function processAutoReply(webhookData) {
//     try {
//         const value = webhookData.rawData?.entry?.[0]?.changes?.[0]?.value;
//         if (!value || !value.messages) return;

//         const message = value.messages[0];
//         const phoneNumberId = value.metadata.phone_number_id;
//         const customerNumber = message.from;
//         const messageContent = message.text?.body || '';
//         const contactName = value.contacts?.[0]?.profile?.name;
// console.log('=== AUTO-REPLY DEBUG ===');
//         console.log(`Customer: ${customerNumber}`);
//         console.log(`Phone ID: ${phoneNumberId}`);
//         console.log(`Message: ${messageContent}`);
//         console.log('========================');
//         console.log(`Checking auto-reply for customer: ${customerNumber}`);

//         // Get all active rules for this phone number
//         const rules = await AutoReplyRule.find({
//             phoneNumberId: phoneNumberId,
//             isActive: true
//         });

//         for (const rule of rules) {
//             let shouldSend = false;

//             // Check if rule should trigger
//             if (rule.triggerType === 'first_reply') {
//                 // Check if this is customer's first message
//                 const previousMessages = await WebhookData.countDocuments({
//                     'rawData.entry.0.changes.0.value.metadata.phone_number_id': phoneNumberId,
//                     'rawData.entry.0.changes.0.value.messages.0.from': customerNumber,
//                     dataType: 'whatsapp_message'
//                 });
//                 shouldSend = previousMessages <= 1;
//             } 
//             else if (rule.triggerType === 'keyword') {
//                 // Check if message contains any keywords
//                 const content = messageContent.toLowerCase();
//                 shouldSend = rule.keywords.some(keyword => 
//                     content.includes(keyword.toLowerCase())
//                 );
//             }
//            else if (rule.triggerType === 'campaign_response') {
//     // Check if customer received ANY campaign message from this phone number
//     const campaigns = await Campaign.find({
//         phoneNumberId: phoneNumberId,
//         'messageDetails.phoneNumber': {
//             $in: [
//                 customerNumber,
//                 customerNumber.replace(/^\+/, ''),
//                 customerNumber.replace(/^\+?91/, ''),
//                 customerNumber.replace(/^\+?91/, '').replace(/^91/, '')
//             ]
//         }
//     });
    
//     shouldSend = campaigns.length > 0;
//     console.log(`Campaign response check: Found ${campaigns.length} campaigns for ${customerNumber}`);
// }

//             // Check execution limit
//             if (shouldSend && rule.maxExecutions > 0) {
//                 const executionCount = await AutoReplyLog.countDocuments({
//                     ruleId: rule._id.toString(),
//                     customerNumber: customerNumber
//                 });
                
//                 if (executionCount >= rule.maxExecutions) {
//                     shouldSend = false;
//                     console.log(`Rule ${rule.name} reached max executions for ${customerNumber}`);
//                 }
//             }

//             // Send auto-reply
//             if (shouldSend) {
//                 setTimeout(async () => {
//                     await sendAutoReply(rule, phoneNumberId, customerNumber, contactName);
//                 }, rule.timeDelay * 1000);
//             }
//         }
//     } catch (error) {
//         console.error('Error processing auto-reply:', error);
//     }
// }
async function processAutoReply(webhookData) {
    console.log('🔍 AUTO-REPLY DEBUG START');
    console.log('Raw webhook data:', JSON.stringify(webhookData, null, 2));
    
    try {
        const value = webhookData.rawData?.entry?.[0]?.changes?.[0]?.value;
        
        console.log('📱 Value object:', JSON.stringify(value, null, 2));
        
        if (!value || !value.messages) {
            console.log('❌ No value or messages found in webhook');
            return;
        }

        const message = value.messages[0];
        const phoneNumberId = value.metadata.phone_number_id;
        const customerNumber = message.from;
        const messageContent = message.text?.body || '';
        const contactName = value.contacts?.[0]?.profile?.name;

        console.log('📋 Extracted data:');
        console.log(`  Customer: ${customerNumber}`);
        console.log(`  Phone ID: ${phoneNumberId}`);  
        console.log(`  Message: "${messageContent}"`);
        console.log(`  Contact Name: ${contactName}`);

        // Check if rules exist
        const rules = await AutoReplyRule.find({
            phoneNumberId: phoneNumberId,
            isActive: true
        });

        console.log(`🎯 Found ${rules.length} active rules for phone ${phoneNumberId}`);
        rules.forEach(rule => {
            console.log(`  Rule: "${rule.name}" - Type: ${rule.triggerType}`);
        });

        if (rules.length === 0) {
            console.log('❌ No active rules found - auto-reply will not trigger');
            return;
        }

        for (const rule of rules) {
            console.log(`\n🔄 Processing rule: "${rule.name}"`);
            let shouldSend = false;

            if (rule.triggerType === 'first_reply') {
                console.log('  Checking first_reply trigger...');
                
                const previousMessages = await WebhookData.countDocuments({
                    'rawData.entry.0.changes.0.value.metadata.phone_number_id': phoneNumberId,
                    'rawData.entry.0.changes.0.value.messages.0.from': customerNumber,
                    dataType: 'whatsapp_message'
                });
                
                console.log(`  Previous messages from ${customerNumber}: ${previousMessages}`);
                shouldSend = previousMessages <= 1;
                console.log(`  Should send first_reply? ${shouldSend}`);
            }
            else if (rule.triggerType === 'keyword') {
                console.log('  Checking keyword trigger...');
                console.log(`  Keywords: ${JSON.stringify(rule.keywords)}`);
                
                const content = messageContent.toLowerCase();
                shouldSend = rule.keywords.some(keyword => {
                    const matches = content.includes(keyword.toLowerCase());
                    console.log(`    "${keyword}" in "${content}"? ${matches}`);
                    return matches;
                });
                console.log(`  Should send keyword reply? ${shouldSend}`);
            }
            else if (rule.triggerType === 'campaign_response') {
                console.log('  Checking campaign_response trigger...');
                
                const campaigns = await Campaign.find({
                    phoneNumberId: phoneNumberId,
                    'messageDetails.phoneNumber': {
                        $in: [
                            customerNumber,
                            customerNumber.replace(/^\+/, ''),
                            customerNumber.replace(/^\+?91/, ''),
                            customerNumber.replace(/^\+?91/, '').replace(/^91/, '')
                        ]
                    }
                });
                
                console.log(`  Found ${campaigns.length} campaigns for customer`);
                campaigns.forEach(campaign => {
                    console.log(`    Campaign: ${campaign._id}`);
                });
                
                shouldSend = campaigns.length > 0;
                console.log(`  Should send campaign reply? ${shouldSend}`);
            }

            // Check execution limit
            if (shouldSend && rule.maxExecutions > 0) {
                console.log('  Checking execution limits...');
                
                const executionCount = await AutoReplyLog.countDocuments({
                    ruleId: rule._id.toString(),
                    customerNumber: customerNumber
                });
                
                console.log(`  Executions so far: ${executionCount}/${rule.maxExecutions}`);
                
                if (executionCount >= rule.maxExecutions) {
                    shouldSend = false;
                    console.log(`  ❌ Rule reached max executions`);
                }
            }

            // Send auto-reply
            if (shouldSend) {
                console.log(`✅ TRIGGERING AUTO-REPLY: "${rule.name}"`);
                console.log(`   Delay: ${rule.timeDelay} seconds`);
                
                setTimeout(async () => {
                    await sendAutoReply(rule, phoneNumberId, customerNumber, contactName);
                }, rule.timeDelay * 1000);
            } else {
                console.log(`❌ Rule "${rule.name}" will not trigger`);
            }
        }
    } catch (error) {
        console.error('💥 Error processing auto-reply:', error);
        console.error('Stack trace:', error.stack);
    }
    
    console.log('🔍 AUTO-REPLY DEBUG END\n');
}
// async function sendAutoReply(rule, phoneNumberId, customerNumber, contactName) {
//     try {
//         // Personalize message
//                 const accessToken = process.env.ACCESS_TOKEN; 
//         let message = rule.responseMessage;
//         if (contactName) {
//             message = message.replace('{customer_name}', contactName);
//         }
//         message = message.replace('{phone}', customerNumber);

//         // Send message via WhatsApp API
//         const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
//             method: 'POST',
//             headers: {
//                 'Authorization': `Bearer ${accessToken}`,
//                 'Content-Type': 'application/json',
//             },
//             body: JSON.stringify({
//                 messaging_product: 'whatsapp',
//                 to: customerNumber,
//                 type: 'text',
//                 text: { body: message }
//             })
//         });

//         if (response.ok) {
//             const data = await response.json();
//             const messageId = data.messages[0].id;

//             // Store the auto-reply message
//             const newMessage = new Message({
//                 messageId: messageId,
//                 phoneNumberId: phoneNumberId,
//                 to: customerNumber,
//                 from: phoneNumberId,
//                 direction: 'outgoing',
//                 messageType: 'text',
//                 content: { text: message },
//                 status: 'sent',
//                 timestamp: new Date(),
//                 isAutoReply: true
//             });
//             await newMessage.save();

//             // Log execution
//             const log = new AutoReplyLog({
//                 ruleId: rule._id.toString(),
//                 phoneNumberId: phoneNumberId,
//                 customerNumber: customerNumber,
//                 messageContent: message
//             });
//             await log.save();

//             console.log(`Auto-reply sent: ${messageId}`);
//         }
//     } catch (error) {
//         console.error('Error sending auto-reply:', error);
//     }
// }

async function sendAutoReply(rule, phoneNumberId, customerNumber, contactName) {
    try {
        const accessToken = process.env.ACCESS_TOKEN; // Make sure this matches your .env file
        
        let message = rule.responseMessage;
        if (contactName) {
            message = message.replace('{customer_name}', contactName);
        }
        message = message.replace('{phone}', customerNumber);

        console.log(`Sending auto-reply to ${customerNumber}: ${message}`);

        const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: customerNumber,
                type: 'text',
                text: { body: message }
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log(`✅ Auto-reply sent successfully: ${data.messages[0].id}`);
            
            // Log execution
            const log = new AutoReplyLog({
                ruleId: rule._id.toString(),
                phoneNumberId: phoneNumberId,
                customerNumber: customerNumber,
                messageContent: message
            });
            await log.save();
        } else {
            console.error('❌ Failed to send auto-reply:', response.status, await response.text());
        }
    } catch (error) {
        console.error('❌ Error sending auto-reply:', error);
    }
}

app.post('/webhook', async (req, res) => {
    console.log('Received WhatsApp webhook at:', new Date().toISOString());
    console.log('Full payload:', JSON.stringify(req.body, null, 2));

    try {
        // Determine data type based on payload structure
        let dataType = 'unknown';
        
        if (req.body.field === 'history') {
            dataType = 'whatsapp_history';
        } else if (req.body.entry && req.body.entry[0] && req.body.entry[0].changes) {
            const changes = req.body.entry[0].changes[0];
            if (changes.value && changes.value.messages) {
                dataType = 'whatsapp_message';
            } else if (changes.value && changes.value.statuses) {
                dataType = 'whatsapp_status';
            }
        } else if (req.body.messages) {
            dataType = 'whatsapp_message';
        }

        // Create webhook data object
        const webhookData = {
            rawData: req.body,
            dataType: dataType,
            source: 'webhook',
            requestHeaders: {
                'user-agent': req.headers['user-agent'],
                'content-type': req.headers['content-type'],
                'x-forwarded-for': req.headers['x-forwarded-for'],
                'authorization': req.headers['authorization'] ? '[HIDDEN]' : undefined
            },
            timestamp: new Date()
        };

       
// Save to MongoDB
const newWebhookData = new WebhookData(webhookData);
const savedData = await newWebhookData.save();

if (dataType === 'whatsapp_message') {
    console.log('🚀 MESSAGE RECEIVED - CHECKING FOR AUTO-REPLY');
    
    // Extract message data immediately
    const value = req.body.entry?.[0]?.changes?.[0]?.value;
    if (value && value.messages && value.messages[0]) {
        const message = value.messages[0];
        const phoneNumberId = value.metadata.phone_number_id;
        const customerNumber = message.from;
        const messageContent = message.text?.body || '';
        
        console.log(`Customer ${customerNumber} sent: "${messageContent}"`);
        
        // Check if this is a first reply (count previous messages)
        const messageCount = await WebhookData.countDocuments({
            'rawData.entry.0.changes.0.value.metadata.phone_number_id': phoneNumberId,
            'rawData.entry.0.changes.0.value.messages.0.from': customerNumber,
            dataType: 'whatsapp_message'
        });
        
        console.log(`Total messages from ${customerNumber}: ${messageCount}`);
        
        // If this is first message, trigger auto-reply
        if (messageCount === 1) {
            console.log('✅ FIRST MESSAGE - TRIGGERING AUTO-REPLY');
            
            // Find first_reply rules for this phone number
            const firstReplyRules = await AutoReplyRule.find({
                phoneNumberId: phoneNumberId,
                triggerType: 'first_reply',
                isActive: true
            });
            
            console.log(`Found ${firstReplyRules.length} first-reply rules`);
            
            for (const rule of firstReplyRules) {
                // Check execution limit
                const executionCount = await AutoReplyLog.countDocuments({
                    ruleId: rule._id.toString(),
                    customerNumber: customerNumber
                });
                
                if (executionCount < rule.maxExecutions) {
                    console.log(`Sending auto-reply: ${rule.name}`);
                    
                    setTimeout(async () => {
                        await sendAutoReply(rule, phoneNumberId, customerNumber, value.contacts?.[0]?.profile?.name);
                    }, rule.timeDelay * 1000);
                }
            }
        }
    }
} else {
    console.log('❌ NOT A MESSAGE - SKIPPING AUTO-REPLY');
}

        // ADD THIS SECTION - Update message status if it's a status webhook
        if (dataType === 'whatsapp_status' && req.body.entry && req.body.entry[0] && req.body.entry[0].changes) {
            const value = req.body.entry[0].changes[0].value;
            
            if (value.statuses && value.statuses.length > 0) {
                const status = value.statuses[0];
                
                try {
                  try {
    // Update status in Campaign messageDetails
    const updatedCampaign = await Campaign.findOneAndUpdate(
        { "messageDetails.messageId": status.id },
        { 
            $set: {
                "messageDetails.$.status": status.status,
                "messageDetails.$.webhookUpdatedAt": new Date(),
                "messageDetails.$.error": status.errors ? status.errors[0].message : null
            }
        },
        { new: true }
    );

    if (updatedCampaign) {
        console.log(`Updated campaign message ${status.id} status to: ${status.status}`);
    } else {
        console.log(`Message ${status.id} not found in any campaign`);
    }
} catch (statusUpdateError) {
    console.error('Error updating campaign message status:', statusUpdateError);
}
                    // Update status in Message schema
                    const updatedMessage = await Message.findOneAndUpdate(
                        { messageId: status.id },
                        { 
                            status: status.status,
                            metadata: {
                                ...status,
                                updatedAt: new Date()
                            }
                        },
                        { new: true }
                    );
                    
                    if (updatedMessage) {
                        console.log(`Updated message ${status.id} status to: ${status.status}`);
                    } else {
                        console.log(`Message ${status.id} not found in Message schema`);
                    }
                } catch (statusUpdateError) {
                    console.error('Error updating message status:', statusUpdateError);
                }
            }
        }
        
        console.log(`Webhook data saved to MongoDB with ID: ${savedData._id}`);
        console.log(`Data type detected: ${dataType}`);

        res.status(200).json({
            status: 'received',
            id: savedData._id,
            dataType: dataType,
            timestamp: savedData.timestamp,
            message: 'Webhook data stored successfully'
        });

    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});
// WhatsApp webhook verification (GET) - MUST come before the catch-all route
app.get('/webhook', (req, res) => {
    const verify_token = process.env.VERIFY_TOKEN || 'demo';

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('Webhook verification attempt:');
    console.log('Mode:', mode);
    console.log('Token received:', token);
    console.log('Challenge:', challenge);

    if (mode && token) {
        if (mode === 'subscribe' && token === verify_token) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            console.log('Verification failed - token mismatch');
            res.sendStatus(403);
        }
    } else {
        console.log('Missing required parameters');
        res.sendStatus(400);
    }
});

app.post('/api/auto-reply-rules', async (req, res) => {
    try {
        const rule = new AutoReplyRule(req.body);
        await rule.save();
        res.json(rule);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all rules for a phone number
app.get('/api/auto-reply-rules/:phoneNumberId', async (req, res) => {
    try {
        const rules = await AutoReplyRule.find({
            phoneNumberId: req.params.phoneNumberId
        });
        res.json(rules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update rule
app.put('/api/auto-reply-rules/:id', async (req, res) => {
    try {
        const rule = await AutoReplyRule.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json(rule);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete rule
app.delete('/api/auto-reply-rules/:id', async (req, res) => {
    try {
        await AutoReplyRule.findByIdAndDelete(req.params.id);
        res.json({ message: 'Rule deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get auto-reply logs
app.get('/api/auto-reply-logs/:phoneNumberId', async (req, res) => {
    try {
        const logs = await AutoReplyLog.find({
            phoneNumberId: req.params.phoneNumberId
        }).sort({ sentAt: -1 }).limit(50);
        
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// QUICK SETUP - CREATE SAMPLE RULES
app.post('/api/create-sample-rules/:phoneNumberId', async (req, res) => {
    try {
        const { phoneNumberId } = req.params;
        
        const sampleRules = [
          // Add this to your sampleRules array in the /api/create-sample-rules endpoint:
{
    name: "Campaign Follow-up",
    phoneNumberId: phoneNumberId,
    triggerType: "campaign_response",
    responseMessage: "Thanks for your reply! We received your message and will get back to you soon.",
    maxExecutions: 1,
    timeDelay: 3
},
            {
                name: "Welcome Message",
                phoneNumberId: phoneNumberId,
                triggerType: "first_reply",
                responseMessage: "Hi {customer_name}! Thanks for reaching out. How can we help you today?",
                maxExecutions: 1,
                timeDelay: 2
            },
            {
                name: "Help Keywords",
                phoneNumberId: phoneNumberId,
                triggerType: "keyword",
                keywords: ["help", "support", "assistance"],
                responseMessage: "I'm here to help! Please describe your issue and our team will assist you shortly.",
                maxExecutions: 3,
                timeDelay: 1
            },
            {
                name: "Pricing Inquiry",
                phoneNumberId: phoneNumberId,
                triggerType: "keyword", 
                keywords: ["price", "cost", "pricing", "quote"],
                responseMessage: "Thanks for your interest in our pricing! A team member will contact you with detailed pricing information within 30 minutes.",
                maxExecutions: 2,
                timeDelay: 5
            }
        ];

        const createdRules = [];
        for (const ruleData of sampleRules) {
            const existingRule = await AutoReplyRule.findOne({
                name: ruleData.name,
                phoneNumberId: phoneNumberId
            });

            if (!existingRule) {
                const rule = new AutoReplyRule(ruleData);
                const savedRule = await rule.save();
                createdRules.push(savedRule);
            }
        }

        res.json({
            message: `Created ${createdRules.length} sample rules`,
            rules: createdRules
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// API endpoint to retrieve all webhook data
app.get('/api/webhook-data', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const dataType = req.query.dataType; // Optional filter by data type
        const skip = (page - 1) * limit;

        let query = {};
        if (dataType && dataType !== 'all') {
            query.dataType = dataType;
        }

        const webhookData = await WebhookData.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await WebhookData.countDocuments(query);

        res.json({
            data: webhookData,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            filters: {
                dataType: dataType || 'all'
            }
        });
    } catch (error) {
        console.error('Error retrieving webhook data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
const getDateRange = (startDate, endDate) => {
    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0);
    
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
};

// Helper function to extract message status from webhook data
const getMessageStatus = (rawData) => {
    try {
        // Check for WhatsApp webhook status updates
        if (rawData.entry && rawData.entry[0] && rawData.entry[0].changes) {
            const change = rawData.entry[0].changes[0];
            if (change.value && change.value.statuses) {
                return change.value.statuses[0].status; // sent, delivered, read, failed
            }
        }
        
        // Check for message sending attempts
        if (rawData.messages) {
            return 'sent';
        }
        
        // Check for errors
        if (rawData.error || (rawData.rawData && rawData.rawData.error)) {
            return 'failed';
        }
        
        return 'unknown';
    } catch (error) {
        return 'unknown';
    }
};

// Helper function to extract phone number
// Helper function to extract phone number (UPDATED - now gets display phone number)
const getPhoneNumber = (rawData) => {
    try {
        if (rawData.entry && rawData.entry[0] && rawData.entry[0].changes) {
            const change = rawData.entry[0].changes[0];
            if (change.value && change.value.metadata && change.value.metadata.display_phone_number) {
                // Return the display phone number (sender's WhatsApp Business number)
                return change.value.metadata.display_phone_number;
            }
        }
        
        // Fallback: From direct message data (if structure is different)
        if (rawData.from) {
            return rawData.from;
        }
        
        // Another fallback for different webhook structures
        if (rawData.display_phone_number) {
            return rawData.display_phone_number;
        }
        
        return null;
    } catch (error) {
        return null;
    }
};

// Main analytics API endpoint (UPDATED)
app.get('/api/analytics', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const { start, end } = getDateRange(startDate, endDate);
        
        // Base query for date range
        const baseQuery = {
            timestamp: { $gte: start, $lte: end }
        };
        
        // Get all webhook data for the period
        const webhookData = await WebhookData.find(baseQuery).lean();
        
        // Process the data
        let totalSent = 0;
        let totalFailed = 0;
        let totalDelivered = 0;
        let totalRead = 0;
        const phoneNumbers = new Set();
        const dailyStats = {};
        const phoneNumberStats = {};
        
        webhookData.forEach(record => {
            const status = getMessageStatus(record.rawData);
            const phoneNumber = getPhoneNumber(record.rawData);
            const date = record.timestamp.toISOString().split('T')[0];
            
            // Track phone numbers (now tracking sender numbers)
            if (phoneNumber) {
                phoneNumbers.add(phoneNumber);
                
                // Phone number specific stats
                if (!phoneNumberStats[phoneNumber]) {
                    phoneNumberStats[phoneNumber] = {
                        sent: 0,
                        failed: 0,
                        delivered: 0,
                        read: 0
                    };
                }
            }
            
            // Daily stats initialization
            if (!dailyStats[date]) {
                dailyStats[date] = {
                    sent: 0,
                    failed: 0,
                    delivered: 0,
                    read: 0
                };
            }
            
            // Count by status
            switch (status) {
                case 'sent':
                    totalSent++;
                    dailyStats[date].sent++;
                    if (phoneNumber) phoneNumberStats[phoneNumber].sent++;
                    break;
                case 'failed':
                    totalFailed++;
                    dailyStats[date].failed++;
                    if (phoneNumber) phoneNumberStats[phoneNumber].failed++;
                    break;
                case 'delivered':
                    totalDelivered++;
                    dailyStats[date].delivered++;
                    if (phoneNumber) phoneNumberStats[phoneNumber].delivered++;
                    break;
                case 'read':
                    totalRead++;
                    dailyStats[date].read++;
                    if (phoneNumber) phoneNumberStats[phoneNumber].read++;
                    break;
            }
        });
        
        // Prepare daily chart data
        const chartData = Object.keys(dailyStats).sort().map(date => ({
            date,
            sent: dailyStats[date].sent,
            failed: dailyStats[date].failed,
            delivered: dailyStats[date].delivered,
            read: dailyStats[date].read
        }));
        
        // Prepare phone number breakdown (now shows sender numbers with their message counts)
        const phoneNumberBreakdown = Object.keys(phoneNumberStats).map(phone => ({
            phoneNumber: phone,
            ...phoneNumberStats[phone],
            total: phoneNumberStats[phone].sent + phoneNumberStats[phone].failed + 
                   phoneNumberStats[phone].delivered + phoneNumberStats[phone].read
        })).sort((a, b) => b.total - a.total);
        
        // Calculate success rate
        const totalMessages = totalSent + totalFailed + totalDelivered + totalRead;
        const successRate = totalMessages > 0 ? ((totalSent + totalDelivered + totalRead) / totalMessages * 100).toFixed(2) : 0;
        
        res.json({
            summary: {
                totalSent,
                totalFailed,
                totalDelivered,
                totalRead,
                totalMessages,
                uniquePhoneNumbers: phoneNumbers.size,
                successRate: parseFloat(successRate)
            },
            chartData,
            phoneNumberBreakdown,
            dateRange: {
                start: start.toISOString().split('T')[0],
                end: end.toISOString().split('T')[0]
            }
        });
        
    } catch (error) {
        console.error('Analytics API error:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message 
        });
    }
});



// API endpoint to get a specific webhook data entry
app.get('/api/webhook-data/:id', async (req, res) => {
    try {
        const webhookData = await WebhookData.findById(req.params.id);
        if (!webhookData) {
            return res.status(404).json({ error: 'Webhook data not found' });
        }
        res.json(webhookData);
    } catch (error) {
        console.error('Error retrieving webhook data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API endpoint to get data type statistics
app.get('/api/webhook-stats', async (req, res) => {
    try {
        const stats = await WebhookData.aggregate([
            {
                $group: {
                    _id: '$dataType',
                    count: { $sum: 1 },
                    latestEntry: { $max: '$createdAt' }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        const total = await WebhookData.countDocuments();

        res.json({
            totalEntries: total,
            byDataType: stats,
            summary: stats.map(stat => ({
                type: stat._id,
                count: stat.count,
                percentage: ((stat.count / total) * 100).toFixed(2),
                latestEntry: stat.latestEntry
            }))
        });
    } catch (error) {
        console.error('Error retrieving webhook stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API endpoint to delete webhook data (optional - for cleanup)
app.delete('/api/webhook-data/:id', async (req, res) => {
    try {
        const deletedData = await WebhookData.findByIdAndDelete(req.params.id);
        if (!deletedData) {
            return res.status(404).json({ error: 'Webhook data not found' });
        }
        res.json({ message: 'Webhook data deleted successfully', id: req.params.id });
    } catch (error) {
        console.error('Error deleting webhook data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Add these new API endpoints to your existing Express server

const contactSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  phone: String,
});

const Contact = mongoose.model("Contact", contactSchema);

// Save single contact
app.post("/save-contact", async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const newContact = new Contact({ firstName, lastName, phone });
    await newContact.save();
    res.json({ message: "Contact saved successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Error saving contact" });
  }
});

// File upload config


// Upload Excel/CSV
app.post("/upload-contacts", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
console.log("condata",data)
    // Save contacts
    for (const row of data) {
      if (row.firstName && row.phone) {
        const contact = new Contact({
          firstName: row.firstName,
          lastName: row.lastName || "",
          phone: row.phone,
        });
        await contact.save();
      }
    }

    fs.unlinkSync(filePath); // cleanup
    res.json({ message: "Contacts uploaded successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error uploading contacts" });
  }
});

// Fetch all contacts
app.get("/contacts", async (req, res) => {
  try {
    const contacts = await Contact.find();
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ message: "Error fetching contacts" });
  }
});

// Update a contact
app.put("/contacts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone } = req.body;
    await Contact.findByIdAndUpdate(id, { firstName, lastName, phone });
    res.json({ message: "Contact updated successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Error updating contact" });
  }
});

app.use(history());
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback route for SPA (React Router)
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, 'dist', 'index.html'));
// });

// Server start
app.listen(process.env.PORT || 8002, () => {
  console.log(`Server running on port ${process.env.PORT || 8002}`);
});
