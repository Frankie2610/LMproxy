import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();

app.use(cors({ origin: "*", methods: ["POST"], allowedHeaders: ["Content-Type"] }));
app.use(express.json());

// Shopify API Config
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const ADMIN_API_ACCESS_TOKEN = process.env.ADMIN_API_ACCESS_TOKEN;

const SHOPIFY_API_URL = `https://${SHOPIFY_STORE}.myshopify.com/admin/api/2023-10/graphql.json`;

// 🛠 Hàm gửi request đến Shopify GraphQL API
const shopifyRequest = async (query, variables = {}) => {
    const response = await fetch(SHOPIFY_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": ADMIN_API_ACCESS_TOKEN,
        },
        body: JSON.stringify({ query, variables }),
    });

    return response.json();
};

// 🚀 API Proxy xử lý request từ frontend
app.post("/api/LMserver.js", async (req, res) => {
    try {
        const { productGid } = req.body;

        if (!productGid) {
            return res.status(400).json({ success: false, error: "Thiếu productGid" });
        }

        // 🛠 Lấy total_views hiện tại từ Shopify Metafield
        const GET_METAFIELD_QUERY = `
      query getProductViews($productGid: ID!) {
        product(id: $productGid) {
          metafield(namespace: "custom", key: "total_views") {
            value
          }
        }
      }
    `;

        let response = await shopifyRequest(GET_METAFIELD_QUERY, { productGid });

        let totalViews = response.data?.product?.metafield?.value || "0";
        totalViews = parseInt(totalViews) + 1; // Tăng số lượt xem lên 1

        console.log(`📊 Product ${productGid} - Views: ${totalViews}`);

        // 🛠 Cập nhật total_views mới lên Shopify
        const UPDATE_METAFIELD_QUERY = `
      mutation updateProductViews($input: MetafieldsSetInput!) {
        metafieldsSet(input: [$input]) {
          metafields {
            id
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

        const updateResponse = await shopifyRequest(UPDATE_METAFIELD_QUERY, {
            input: {
                ownerId: productGid,
                namespace: "custom",
                key: "total_views",
                type: "integer",
                value: totalViews.toString(),
            },
        });

        if (updateResponse.data?.metafieldsSet?.userErrors.length > 0) {
            return res.status(500).json({
                success: false,
                error: updateResponse.data.metafieldsSet.userErrors,
            });
        }

        res.json({ success: true, totalViews });
    } catch (error) {
        console.error("❌ Lỗi proxy:", error);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

// Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Proxy server chạy trên cổng ${PORT}`));
