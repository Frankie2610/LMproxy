require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const fetch = require("node-fetch"); // Đảm bảo đã cài node-fetch nếu chưa có

const app = express();
app.use(express.json()); // Hỗ trợ JSON request

// Cấu hình CORS cho phép mọi origin (có thể thay '*' bằng domain của bạn nếu cần)
const corsOptions = {
    origin: '*', // Hoặc thay bằng domain của bạn (ví dụ: 'https://yourdomain.com')
    methods: ['GET', 'POST', 'OPTIONS'], // Các phương thức được phép
    allowedHeaders: ['Content-Type', 'Authorization'], // Các header được phép
};

app.use(cors(corsOptions)); // Áp dụng CORS cho tất cả các route

// Middleware xác thực request từ Shopify
const SHOPIFY_SHARED_SECRET = process.env.SHOPIFY_SHARED_SECRET;
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;

function verifyShopifyRequest(req, res, next) {
    const hmac = req.headers["x-shopify-hmac-sha256"];
    const body = JSON.stringify(req.body);

    const digest = crypto
        .createHmac("sha256", SHOPIFY_SHARED_SECRET)
        .update(body)
        .digest("base64");

    if (digest !== hmac) {
        console.log("❌ HMAC không hợp lệ");
        return res.status(401).json({ error: "Unauthorized request" });
    }

    next();
}

// Xử lý các OPTIONS request (preflight request)
app.options('*', cors(corsOptions)); // Cho phép OPTIONS requests

// Route API Proxy
app.post("/apps/app-proxy", verifyShopifyRequest, async (req, res) => {
    console.log("✅ Request từ Shopify:", req.body);

    const shopifyAdminApiUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2023-10/graphql.json`;
    const shopifyAccessToken = process.env.SHOPIFY_ACCESS_TOKEN;

    try {
        const response = await fetch(shopifyAdminApiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": shopifyAccessToken,
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
        res.status(500).json({ success: false, error: "Lỗi khi gọi API Shopify" });
    }
});

// Chạy server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Backend chạy tại http://localhost:${PORT}`);
});
