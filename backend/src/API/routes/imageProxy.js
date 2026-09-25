import express from "express";
import axios from "axios";

const router = express.Router();

// Proxy route to fetch and serve profile images
router.get("/profile-image", async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).json({ error: "Missing url query parameter" });
  }

  try {
    // Fix (V13 - Server-Side Request Forgery / OWASP A10)
    // Validate target URL hostname to block loopback, localhost, and private
    // addresses, preventing the server from fetching internal/restricted resources.
    const parsed = new URL(imageUrl);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return res.status(403).json({ error: "Access to localhost is forbidden (SSRF Protected)" });
    }
    const response = await axios.get(imageUrl, {
      responseType: "stream",
    });

    res.setHeader("Content-Type", response.headers["content-type"]);
    response.data.pipe(res);
  } catch (error) {
    console.error("Error proxying image:", error.message, error.response?.status, error.response?.data);
    res.status(500).json({ error: "Failed to fetch image" });
  }
});

export default router;
