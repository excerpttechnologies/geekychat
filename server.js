// 📁 server/server.js
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const multer = require("multer");
const axios = require("axios");
const fs = require("fs");

const messageLogsRoutes = require("./routes/messageLogs");
const campaignLogsRoute = require("./routes/campaignLogs");

const app = express();

app.use(cors()); 
app.use(express.json());

// Routes imports
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/Users");
const whatsappRoutes = require("./routes/whatsapp");

// Routes usage
app.use("/api/auth", authRoutes);
app.use("/api/Users", userRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/messageLogs", messageLogsRoutes);
app.use("/api/campaignLogs", campaignLogsRoute);

// DB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("DB connection error:", err));

const upload = multer({ dest: "uploads/" });

// 🔑 Meta config (move these to .env in production)
const accessToken = process.env.ACCESS_TOKEN;
const appId = process.env.APP_ID;
const wabaId = process.env.WABA_ID;
const apiVersion = "v23.0";

// 📌 Create WhatsApp Template
app.post("/create-template", upload.single("file"), async (req, res) => {
  const { templateName, headerType, bodyText, footerText } = req.body;
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
      // Text header
      headerComponent = {
        type: "HEADER",
        format: "TEXT",
        text: bodyText?.substring(0, 60) || "Header text", // Meta limit: 60 chars
      };
    }

    // Body component
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
    const bodyComponent = {
      type: "BODY",
      text: bodyText || "Hello, this is a body text.",
    };

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

app.use(express.static(path.join(__dirname, 'dist')));

// Fallback route for SPA (React Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Server start
app.listen(process.env.PORT || 8002, () => {
  console.log(`Server running on port ${process.env.PORT || 8080}`);
});
