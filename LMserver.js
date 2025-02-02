import dotenv from "dotenv";
import express from "express";
import crypto from "crypto";
import cors from "cors";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: "*" }));

const SHOPIFY_SHARED_SECRET = process.env.SHOPIFY_SHARED_SECRET;
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// Middleware xác thực request từ Shopify
function verifyShopifyRequest(req, res, next) {
    const hmac = req.headers["x-shopify-hmac-sha256"];
    if (!hmac) return res.status(400).json({ error: "Thiếu HMAC header" });

    const body = JSON.stringify(req.body);
    const digest = crypto.createHmac("sha256", SHOPIFY_SHARED_SECRET).update(body).digest("base64");

    if (digest !== hmac) {
        console.error("❌ HMAC không hợp lệ");
        return res.status(401).json({ error: "Unauthorized request" });
    }

    next();
}

// Route chính của App Proxy
app.post("/apps/app-proxy", async (req, res) => {
    console.log("📡 Nhận request:", JSON.stringify(req.body, null, 2));

    const { action, productGid, totalViews } = req.body;
    if (!action || !productGid) {
        return res.status(400).json({ error: "Lỗi: action hoặc productGid không hợp lệ" });
    }

    const shopifyAdminApiUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2023-10/graphql.json`;

    try {
        if (action === "get_metafield") {
            console.log("🔍 Đang lấy metafield...");
            const response = await fetch(shopifyAdminApiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                },
                body: JSON.stringify({
                    query: `{
                        product(id: "${productGid}") { 
                            metafields(namespace: "custom", key: "total_views") { value } 
                        }
                    }`
                }),
            });

            const data = await response.json();
            const metafield = data.data?.product?.metafields[0]?.value || "0";
            return res.json({ success: true, totalViews: parseInt(metafield) });
        }

        if (action === "update_metafield" && totalViews !== undefined) {
            console.log("📡 Đang cập nhật total_views...");
            const updateResponse = await fetch(shopifyAdminApiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                },
                body: JSON.stringify({
                    query: `mutation {
                        metafieldsSet(metafields: [{
                            ownerId: "${productGid}",
                            namespace: "custom",
                            key: "total_views",
                            type: "integer",
                            value: "${totalViews}"
                        }]) {
                            metafields { id value }
                        }
                    }`
                }),
            });

            const updateData = await updateResponse.json();
            return res.json({ success: true, totalViews });
        }

        return res.status(400).json({ error: "Lỗi: Action không hợp lệ" });
    } catch (error) {
        console.error("❌ Shopify API Lỗi:", error);
        return res.status(500).json({ error: "Lỗi khi gọi Shopify API" });
    }
});

// 🚀 Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server chạy tại http://localhost:${PORT}`));

// Cấu hình để Vercel không yêu cầu `listen()`
module.exports = app;
