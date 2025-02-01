import express from "express";
import crypto from "crypto";
import cors from "cors";
import fetch from "node-fetch";  // Thay 'require' thành 'import'

import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json()); // Hỗ trợ JSON request

// Cấu hình CORS để cho phép tất cả các domain (hoặc thay '*' bằng domain của bạn)
const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions)); // Cấu hình CORS cho tất cả các route

// Xử lý các OPTIONS request (preflight request)
app.options('*', cors(corsOptions)); // Cho phép OPTIONS requests

const SHOPIFY_SHARED_SECRET = process.env.SHOPIFY_SHARED_SECRET;
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

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

// Route API Proxy
app.post("https://lmproxy.vercel.app/apps/app-proxy", verifyShopifyRequest, async (req, res) => {
    console.log("✅ Request từ Shopify:", req.body);

    // Truy vấn API Shopify để lấy thông tin sản phẩm và metafield
    const shopifyAdminApiUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2023-10/graphql.json`;

    try {
        const response = await fetch(shopifyAdminApiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
            },
            body: JSON.stringify({
                query: `{ 
                    products(first: 5) { 
                        edges { 
                            node { 
                                id 
                                title 
                                metafield(namespace: "custom", key: "total_views") { 
                                    id 
                                    value 
                                } 
                            } 
                        } 
                    } 
                }`,
            }),
        });

        if (!response.ok) {
            throw new Error(`API Shopify trả về lỗi: ${response.statusText}`);
        }

        const data = await response.json();
        const product = data.data.products.edges[0]?.node;

        if (!product) {
            return res.status(404).json({ error: "Không tìm thấy sản phẩm" });
        }

        // Lấy metafield total_views
        let totalViews = 0;
        if (product.metafield) {
            const metafieldValue = JSON.parse(product.metafield.value);
            totalViews = Array.isArray(metafieldValue) ? metafieldValue[0] : 0;
        }

        console.log("✅ Current Total Views:", totalViews);

        // Tăng lượt xem lên 1
        totalViews++;

        // Cập nhật metafield trong Shopify
        const updateQuery = `
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
              namespace
              key
              value
              type
            }
            userErrors {
              field
              message
            }
          }
        }
        `;

        const variables = {
            metafields: [
                {
                    ownerId: product.id,
                    namespace: "custom",
                    key: "total_views",
                    type: "list.number_integer",
                    value: JSON.stringify([totalViews]),
                },
            ],
        };

        const updateResponse = await fetch(shopifyAdminApiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
            },
            body: JSON.stringify({
                query: updateQuery,
                variables: variables,
            }),
        });

        const updateData = await updateResponse.json();

        if (updateData.errors) {
            console.error("❌ Error updating metafield:", updateData.errors);
            return res.status(500).json({ error: "Lỗi khi cập nhật metafield" });
        }

        console.log("✅ Updated Total Views:", totalViews);
        res.json({ success: true, totalViews });
    } catch (error) {
        console.error("❌ Lỗi khi gọi API Shopify:", error);
        res.status(500).json({ error: `Lỗi khi gọi API Shopify: ${error.message}` });
    }
});

// Chạy server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Backend chạy tại http://localhost:${PORT}`);
});
