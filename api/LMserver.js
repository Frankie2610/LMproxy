import dotenv from "dotenv";
import express from "express";
import crypto from "crypto";
import cors from "cors";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const SHOPIFY_SHARED_SECRET = process.env.SHOPIFY_SHARED_SECRET;
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// ✅ Middleware kiểm tra request từ Shopify
function verifyShopifyRequest(req, res, next) {
    console.log("📡 Headers:", req.headers);

    const hmac = req.headers["x-shopify-hmac-sha256"];
    if (!hmac) {
        return res.status(400).json({ error: "Thiếu HMAC header" });
    }

    const body = JSON.stringify(req.body);
    const digest = crypto.createHmac("sha256", SHOPIFY_SHARED_SECRET).update(body).digest("base64");

    if (digest !== hmac) {
        console.log("❌ HMAC không hợp lệ. Expected:", digest, "Received:", hmac);
        return res.status(401).json({ error: "Unauthorized request" });
    }

    next();
}

// ✅ Route chính của App Proxy
app.post("/api/LMserver.js", async (req, res) => {
    console.log("📡 Nhận request:", JSON.stringify(req.body, null, 2));

    const { action, productGid, totalViews } = req.body;

    if (!action) {
        return res.status(400).json({ error: "Lỗi: action is not defined" });
    }

    if (!productGid || !productGid.startsWith("gid://shopify/Product/")) {
        return res.status(400).json({ error: "Lỗi: productGid không hợp lệ" });
    }

    const shopifyAdminApiUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2023-10/graphql.json`;

    try {
        if (action === "get_metafield") {
            console.log("🔍 Đang lấy metafield từ Shopify cho productGid:", productGid);

            const response = await fetch(shopifyAdminApiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                },
                body: JSON.stringify({
                    query: `{
                        product(id: "${productGid}") { 
                            id 
                            metafield(namespace: "custom", key: "total_views") { id value } 
                        } 
                    }`,
                }),
            });

            const data = await response.json();
            console.log("🔍 Shopify API Response:", JSON.stringify(data, null, 2));

            if (!data.data?.product?.metafield) {
                return res.status(404).json({ error: "Không tìm thấy metafield total_views" });
            }

            let totalViews = Array.isArray(data.data.product.metafield.value) ? parseInt(data.data.product.metafield.value[0]) : parseInt(data.data.product.metafield.value);
            console.log(totalViews)
            return res.json({ success: true, totalViews });
        }

        if (action === "update_metafield") {
            if (!totalViews) {
                return res.status(400).json({ error: "Lỗi: Thiếu totalViews để cập nhật" });
            }

            console.log("📡 Đang cập nhật total_views:", totalViews);

            const updateQuery = `
            mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
                metafieldsSet(metafields: $metafields) {
                    metafields {
                        id
                        value
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }`;

            const variables = {
                metafields: [
                    {
                        ownerId: productGid, // 🔥 Sửa lại đúng field
                        namespace: "custom",
                        key: "total_views",
                        type: "list.number_integer", // Đã sửa type thành list.number_integer
                        value: [parseInt(totalViews)], // Đảm bảo value là mảng số nguyên
                    },
                ],
            };

            const updateResponse = await fetch(shopifyAdminApiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                },
                body: JSON.stringify({ query: updateQuery, variables }),
            });

            const updateData = await updateResponse.json();
            console.log("📡 Update Response:", JSON.stringify(updateData, null, 2));

            if (updateData.errors || updateData.data.metafieldsSet.userErrors.length > 0) {
                console.error("❌ Error updating metafield:", updateData.errors || updateData.data.metafieldsSet.userErrors);
                return res.status(500).json({ error: "Lỗi khi cập nhật metafield" });
            }

            console.log("✅ Đã cập nhật total_views:", totalViews);
            return res.json({ success: true, totalViews });
        }

        return res.status(400).json({ error: "Lỗi: Action không hợp lệ" });
    } catch (error) {
        console.error("❌ Shopify API Lỗi:", error);
        res.status(500).json({ error: "Lỗi khi gọi Shopify API" });
    }
});

// 🚀 Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});


app.options('/api/LMserver.js', (req, res) => res.sendStatus(200));

export default app;