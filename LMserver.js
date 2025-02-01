require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

const corsOptions = {
    origin: "*",
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

const SHOPIFY_SHARED_SECRET = process.env.SHOPIFY_SHARED_SECRET;
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// Xác thực request từ Shopify App Proxy
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

// API Proxy
app.post("/apps/app-proxy", verifyShopifyRequest, async (req, res) => {
    const { action, productGid, totalViews } = req.body;

    try {
        if (action === "get_metafield") {
            // Lấy giá trị total_views từ metafield
            const query = `
                query {
                    product(id: "${productGid}") {
                        metafield(namespace: "custom", key: "total_views") {
                            value
                        }
                    }
                }
            `;

            let response = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2023-10/graphql.json`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                },
                body: JSON.stringify({ query }),
            });

            let data = await response.json();
            let currentViews = data?.data?.product?.metafield?.value ? JSON.parse(data.data.product.metafield.value)[0] : 0;

            return res.json({ success: true, total_views: currentViews });
        }

        if (action === "update_metafield") {
            // Cập nhật total_views
            const updateQuery = `
                mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
                    metafieldsSet(metafields: $metafields) {
                        metafields {
                            id
                            namespace
                            key
                            value
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
                        ownerId: productGid,
                        namespace: "custom",
                        key: "total_views",
                        type: "list.number_integer",
                        value: JSON.stringify([totalViews]),
                    }
                ]
            };

            let updateResponse = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2023-10/graphql.json`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                },
                body: JSON.stringify({ query: updateQuery, variables }),
            });

            let updateData = await updateResponse.json();
            return res.json({ success: true, updated_views: totalViews, response: updateData });
        }

        res.status(400).json({ success: false, error: "Hành động không hợp lệ" });

    } catch (error) {
        console.error("❌ Lỗi khi gọi API Shopify:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Chạy server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
