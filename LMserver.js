require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const cors = require("cors");

const app = express();
app.use(express.json()); // Hỗ trợ JSON request

// Cấu hình CORS để tránh lỗi preflight request
const corsOptions = {
    origin: "*", // Hoặc thay bằng domain cụ thể của bạn
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-shopify-hmac-sha256"],
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

const SHOPIFY_SHARED_SECRET = process.env.SHOPIFY_SHARED_SECRET;
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

if (!SHOPIFY_SHARED_SECRET || !SHOPIFY_STORE_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
    console.error("❌ Lỗi: Chưa cấu hình đầy đủ biến môi trường!");
}

// Middleware xác thực request từ Shopify
function verifyShopifyRequest(req, res, next) {
    const hmac = req.headers["x-shopify-hmac-sha256"];
    if (!hmac) {
        return res.status(400).json({ error: "Thiếu header HMAC" });
    }

    const body = JSON.stringify(req.body);
    const digest = crypto.createHmac("sha256", SHOPIFY_SHARED_SECRET).update(body).digest("base64");

    if (digest !== hmac) {
        console.log("❌ HMAC không hợp lệ");
        return res.status(401).json({ error: "Unauthorized request" });
    }

    next();
}

// Route API Proxy
app.post("/api/shopify", verifyShopifyRequest, async (req, res) => {
    console.log("✅ Request từ Shopify:", req.body);

    const shopifyAdminApiUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2023-10/graphql.json`;

    try {
        const response = await fetch(shopifyAdminApiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
            },
            body: JSON.stringify({
                query: `{ products(first: 5) { edges { node { id title } } } }`,
            }),
        });

        if (!response.ok) {
            throw new Error(`API Shopify trả về lỗi: ${response.statusText}`);
        }

        const data = await response.json();
        res.json({ success: true, products: data.data.products });
    } catch (error) {
        console.error("❌ Lỗi khi gọi API Shopify:", error);
        res.status(500).json({ success: false, error: `Lỗi khi gọi API Shopify: ${error.message}` });
    }
});

// Export app để Vercel có thể xử lý
module.exports = app;
