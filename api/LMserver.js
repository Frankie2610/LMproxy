import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// 🛠 Shopify Credentials
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const shopifyAdminApiUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2023-10/graphql.json`;

// ✅ Route API Proxy
app.post("/api/LMserver.js", async (req, res) => {
    console.log("📡 Nhận request:", JSON.stringify(req.body, null, 2));

    const { action, productGid, totalViews } = req.body;
    if (!action) return res.status(400).json({ error: "Thiếu action" });
    if (!productGid?.startsWith("gid://shopify/Product/")) return res.status(400).json({ error: "productGid không hợp lệ" });

    try {
        if (action === "get_metafield") {
            console.log("🔍 Lấy total_views từ Shopify...");

            const response = await fetch(shopifyAdminApiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN },
                body: JSON.stringify({
                    query: `{
                        product(id: "${productGid}") { 
                            metafield(namespace: "custom", key: "total_views") { id value } 
                        } 
                    }`,
                }),
            });

            const data = await response.json();
            console.log("📡 Shopify API Response:", JSON.stringify(data, null, 2));

            let totalViews = parseInt(data.data?.product?.metafield?.value || "0", 10);
            return res.json({ success: true, totalViews });
        }

        if (action === "update_metafield") {
            let newTotalViews = parseInt(totalViews) + 1;
            console.log(`🔼 Cập nhật total_views: ${newTotalViews}`);

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
                        ownerId: productGid,
                        namespace: "custom",
                        key: "total_views",
                        type: "integer",
                        value: newTotalViews.toString(),
                    },
                ],
            };

            const updateResponse = await fetch(shopifyAdminApiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN },
                body: JSON.stringify({ query: updateQuery, variables }),
            });

            const updateData = await updateResponse.json();
            console.log("📡 Update Response:", JSON.stringify(updateData, null, 2));

            if (updateData.errors || updateData.data.metafieldsSet.userErrors.length > 0) {
                return res.status(500).json({ error: "Lỗi khi cập nhật metafield", details: updateData.errors || updateData.data.metafieldsSet.userErrors });
            }

            return res.json({ success: true, totalViews: newTotalViews });
        }

        return res.status(400).json({ error: "Action không hợp lệ" });
    } catch (error) {
        console.error("❌ Shopify API Lỗi:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
});

// 🚀 Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server chạy tại http://localhost:${PORT}`));

export default app;
