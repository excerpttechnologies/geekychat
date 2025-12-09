// 📁 controllers/whatsappController.js
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const ACCESS_TOKEN = 'EAAdzxxobLG4BPEtZAP5MEjZBGD7k90zSbiOfQGkdnH1MsyhYqgQs6WFZBZB14rnoTPYxztiqePjDQFf95EHhYuDo8Bh18wClrfevzytVgfo6GxUOdfmLlZAXxumXUd4Tygg94cuoR2gfMImMZAHmRaMUb4uHO8rk9Ri6juN3bZAx1ZAVaN4cacqsbDJZBcRiSMBlmlp9alxe8hcV6bRi5qGDPKG8QnPWiXjLfyFVP';
const PHONE_ID = '671028016100461';
const VERSION = 'v23.0';

exports.sendWhatsAppMessage = async (req, res) => {
  const { numbers, message } = req.body;
  const image = req.files?.image?.[0];
  const video = req.files?.video?.[0];
  const doc = req.files?.doc?.[0];

  const recipients = numbers.split(',').map(n => n.trim()).filter(Boolean);

  // Upload media once and reuse media ids for all recipients
  // helpers: sleep + retry with exponential backoff + jitter
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const requestWithRetry = async (fn, opts = {}) => {
    const maxAttempts = opts.maxAttempts || 5;
    const initialDelay = opts.initialDelay || 500; // ms
    let attempt = 0;

    while (true) {
      try {
        return await fn();
      } catch (err) {
        attempt++;
        const status = err?.response?.status;
        if (attempt >= maxAttempts) {
          throw err;
        }

        // Exponential backoff with jitter
        let delay = initialDelay * Math.pow(2, attempt - 1);
        // If 429 (rate limit), increase base delay
        if (status === 429) delay = Math.max(delay, 1000);
        // jitter: +/-25%
        const jitter = Math.floor(delay * 0.25 * Math.random());
        delay = delay + jitter;

        console.warn(`Request failed (attempt ${attempt}) - status: ${status || 'N/A'}, retrying in ${delay}ms`, err?.response?.data || err.message);
        await sleep(delay);
      }
    }
  };

  const mediaUpload = async (media) => {
    const form = new FormData();
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const tempPath = path.join(tempDir, `${Date.now()}_${media.originalname}`);

    // Save file to temp folder
    fs.writeFileSync(tempPath, media.buffer);

    // Append media file as stream
    form.append('file', fs.createReadStream(tempPath), {
      filename: media.originalname,
      contentType: media.mimetype,
    });
    form.append('messaging_product', 'whatsapp');

    const doUpload = async () => {
      return await axios.post(
        `https://graph.facebook.com/${VERSION}/${PHONE_ID}/media`,
        form,
        {
          headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            ...form.getHeaders(),
          },
        }
      );
    };

    const { data } = await requestWithRetry(doUpload, { maxAttempts: 5, initialDelay: 500 });

    // Clean up temp file
    try { fs.unlinkSync(tempPath); } catch (e) { /* ignore */ }
    return data.id;
  };

  const sendToRecipient = async (phone, mediaIds) => {
    // send payload helper
    const postMessage = async (payload) => {
      const doPost = async () => axios.post(`https://graph.facebook.com/${VERSION}/${PHONE_ID}/messages`, payload, {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' }
      });
      return await requestWithRetry(doPost, { maxAttempts: 5, initialDelay: 500 });
    };

    try {
      // Send Text Message
      if (message) {
        await postMessage({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: message } });
      }

      // Send Image (reuse media id if available)
      if (image && mediaIds?.imageId) {
        await postMessage({ messaging_product: 'whatsapp', to: phone, type: 'image', image: { id: mediaIds.imageId } });
      }

      // Send Video
      if (video && mediaIds?.videoId) {
        await postMessage({ messaging_product: 'whatsapp', to: phone, type: 'video', video: { id: mediaIds.videoId } });
      }

      // Send Document
      if (doc && mediaIds?.docId) {
        await postMessage({ messaging_product: 'whatsapp', to: phone, type: 'document', document: { id: mediaIds.docId, filename: doc.originalname } });
      }

    } catch (err) {
      // Final failure after retries
      const info = err?.response?.data || err.message || err;
      console.error(`❌ Final failure for ${phone}:`, info);
    }
  };

  try {
    // Upload media once (if provided) and reuse ids
    const mediaIds = {};
    if (image) {
      try { mediaIds.imageId = await mediaUpload(image); } catch (e) { console.error('Image upload failed', e?.response?.data || e.message); }
    }
    if (video) {
      try { mediaIds.videoId = await mediaUpload(video); } catch (e) { console.error('Video upload failed', e?.response?.data || e.message); }
    }
    if (doc) {
      try { mediaIds.docId = await mediaUpload(doc); } catch (e) { console.error('Doc upload failed', e?.response?.data || e.message); }
    }

    // Concurrency config: 10 workers (threads) each handling up to 5 concurrent sends
    const NUM_WORKERS = 10;
    const CONCURRENCY_PER_WORKER = 5;

    // Distribute recipients round-robin to workers for balanced load
    const queues = Array.from({ length: NUM_WORKERS }, () => []);
    recipients.forEach((r, idx) => queues[idx % NUM_WORKERS].push(r));

    // Worker function: processes its queue with limited concurrency
    const worker = async (queue) => {
      while (queue.length > 0) {
        const batch = queue.splice(0, CONCURRENCY_PER_WORKER);
        await Promise.all(batch.map(phone => sendToRecipient(phone, mediaIds)));
      }
    };

    // Start all workers in parallel
    await Promise.all(queues.map(q => worker(q)));

    res.json({ message: '✅ Messages processed successfully.' });
  } catch (err) {
    console.error('Bulk send error:', err?.response?.data || err?.message || err);
    res.status(500).json({ message: 'Failed to process messages' });
  }
};
