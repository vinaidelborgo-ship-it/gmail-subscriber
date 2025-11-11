// index.js (gmail-subscriber)
// ------------------------------------------------------------
// WHAT THIS DOES
// - GET  /                 -> 200 "ok" (health check)
// - POST /                 -> Pub/Sub push endpoint (ACK 204)
//      • Decodes the base64 Pub/Sub message and logs a preview
//      • Sends an FCM notification via Firebase Admin
//      • If env FCM_TEST_TOKEN is NOT set, it broadcasts to all
//        device tokens stored in Firestore collection "fcmTokens"
// - POST /register-token   -> Accepts {token, uid?} and stores it in Firestore
//
// REQUIREMENTS
// - npm i express body-parser firebase-admin
// - Service account on this Cloud Run service must have:
//       roles/firebasecloudmessaging.admin  (to send FCM messages)
// - Firestore Database should exist (Native mode). If empty, / will still ACK,
//   and you'll see a warning: "No tokens in Firestore; skipping send".
//
// HOW TO USE
// - Deploy this service
// - Point your Pub/Sub push subscription endpoint to this service root "/"
// - From your web app, POST device tokens to /register-token (see curl below)
// ------------------------------------------------------------
import express from "express";
import bodyParser from "body-parser";
import admin from "firebase-admin";

const app = express();
app.use(bodyParser.json());

// --- Firebase Admin init (ADC used on Cloud Run) ---
try {
  admin.initializeApp();
  console.log("Firebase Admin initialized");
} catch (e) {
  console.error("Firebase Admin init error:", e);
}

// --- Health check ---
app.get("/", (_req, res) => res.status(200).send("ok"));

// --- Optional: client registers device tokens here ---
app.post("/register-token", async (req, res) => {
  try {
    const { token, uid } = req.body || {};
    if (!token) return res.status(400).json({ error: "missing token" });

    const db = admin.firestore();
    await db.collection("fcmTokens").doc(token).set({
      uid: uid || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("Stored FCM token:", token.slice(0, 12) + "…");
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("register-token error:", err);
    return res.status(500).json({ error: "internal" });
  }
});

// --- Pub/Sub push endpoint (ROOT "/") ---
app.post("/", async (req, res) => {
  try {
    const envelope = req.body;
    const msg = envelope?.message;

    if (!msg) {
      console.error("Missing Pub/Sub message envelope:", envelope);
      return res.sendStatus(204); // ack anyway to avoid redelivery storms
    }

    // Decode data for debug
    let decoded = null;
    if (msg.data) {
      decoded = Buffer.from(msg.data, "base64").toString("utf8");
    }
    console.log("Pub/Sub push received:", {
      messageId: msg.messageId,
      publishTime: msg.publishTime,
      attributes: msg.attributes || {},
      dataPreview: decoded ? decoded.slice(0, 300) : null,
    });

    // ---- Build an FCM message payload ----
    const payload = {
      notification: {
        title: "Tender Extractor",
        body: "New Gmail activity received",
      },
      data: {
        source: "gmail-subscriber",
        historyId: (() => {
          try { return JSON.parse(decoded || "{}").historyId?.toString() || ""; }
          catch { return ""; }
        })(),
      },
    };

    const fcm = admin.messaging();
    const testToken = process.env.FCM_TEST_TOKEN;

    if (testToken) {
      // If someone sets FCM_TEST_TOKEN later, send to that single device
      const resp = await fcm.send({ token: testToken, ...payload });
      console.log("FCM send success (env token):", resp);
    } else {
      // Otherwise broadcast to all stored tokens
      const db = admin.firestore();
      const snap = await db.collection("fcmTokens").get();
      if (snap.empty) {
        console.warn("No FCM_TEST_TOKEN and no tokens in Firestore; skipping send");
      } else {
        const tokens = snap.docs.map(d => d.id);
        // Use multicast; FCM caps 500 tokens per call (we send all; small projects are fine)
        const result = await fcm.sendEachForMulticast({ tokens, ...payload });
        console.log("FCM multicast result:", {
          successCount: result.successCount,
          failureCount: result.failureCount,
        });
      }
    }

    return res.sendStatus(204); // ACK
  } catch (err) {
    console.error("Handler error:", err);
    return res.sendStatus(204); // ACK while wiring; change to 500 if you want retries
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`gmail-subscriber listening on ${PORT}`));
