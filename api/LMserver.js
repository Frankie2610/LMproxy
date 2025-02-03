import cors from 'cors';
import express from 'express';

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

const SHOPIFY_SHARED_SECRET = process.env.SHOPIFY_SHARED_SECRET;
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

/** 
 * 🔐 Middleware xác thực HMAC từ Shopify
 * 👉 Nếu test bằng Postman, đặt `SKIP_HMAC_CHECK = true` trong `.env`
 */
function verifyShopifyRequest(req, res, next) {
    if (process.env.SKIP_HMAC_CHECK === "true") {
        console.log("⚠️ Bỏ qua kiểm tra HMAC (chỉ dùng khi test Postman)");
        return next();
    }

    const hmac = req.headers["x-shopify-hmac-sha256"];
    if (!hmac) return res.status(401).json({ error: "Thiếu HMAC header" });

    const body = JSON.stringify(req.body);
    const digest = crypto.createHmac("sha256", SHOPIFY_SHARED_SECRET).update(body).digest("base64");

    if (digest !== hmac) {
        console.log("❌ HMAC không hợp lệ");
        return res.status(401).json({ error: "Unauthorized request" });
    }

    next();
}

/**
 * 📡 API Proxy - Nhận request từ Shopify
 */
app.post("/api/LMserver.js", async (req, res) => {
    console.log("✅ Nhận request từ Shopify:", req.body);

    const { action, productGid } = req.body;
    if (!productGid) return res.status(400).json({ error: "Thiếu productGid" });

    const shopifyAdminApiUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2023-10/graphql.json`;

    try {
        if (action === "get_metafield") {
            // 📤 Lấy total_views từ metafield
            const query = `
            {
                product(id: "${productGid}") {
                    id
                    title
                    metafield(namespace: "custom", key: "total_views") {
                        id
                        value
                    }
                }
            }`;

            const response = await fetch(shopifyAdminApiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                },
                body: JSON.stringify({ query }),
            });

            const data = await response.json();
            const product = data.data.product;

            if (!product) return res.status(404).json({ error: "Không tìm thấy sản phẩm" });

            let totalViews = product.metafield ? parseInt(product.metafield.value) : 0;
            console.log(`📊 Sản phẩm: ${product.title}, Lượt xem: ${totalViews}`);

            return res.json({ success: true, totalViews });
        }

        if (action === "update_metafield") {
            // 📤 Cập nhật total_views lên Shopify
            let totalViews = req.body.totalViews || 0;

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
                        value: `${totalViews}`,
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

            if (updateData.errors || updateData.data.metafieldsSet.userErrors.length > 0) {
                console.error("❌ Lỗi khi cập nhật metafield:", updateData);
                return res.status(500).json({ error: "Lỗi khi cập nhật metafield" });
            }

            console.log(`✅ Đã cập nhật total_views: ${totalViews}`);
            return res.json({ success: true, totalViews });
        }

        return res.status(400).json({ error: "Action không hợp lệ" });
    } catch (error) {
        console.error("❌ Lỗi khi gọi API Shopify:", error);
        res.status(500).json({ error: `Lỗi: ${error.message}` });
    }
});

app.options('/api/LMserver.js', (req, res) => res.sendStatus(200));

export default app;