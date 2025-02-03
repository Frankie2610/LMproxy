import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const shopifyAdminApiUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2023-10/graphql.json`;

app.post('/api/LMserver.js', async (req, res) => {
    const { productGid } = req.body;

    if (!productGid) {
        return res.status(400).json({ error: 'Thiếu productGid' });
    }

    try {
        // Lấy metafield 'total_views' của sản phẩm
        const query = `
        {
            product(id: "${productGid}") {
                metafield(namespace: "custom", key: "total_views") {
                    id
                    value
                }
            }
        }
        `;

        const response = await fetch(shopifyAdminApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
            },
            body: JSON.stringify({ query }),
        });

        const data = await response.json();

        // Kiểm tra xem metafield có tồn tại không
        let totalViews = 0;
        if (data.data?.product?.metafield?.value) {
            // Phân tích chuỗi JSON để lấy mảng số nguyên
            const totalViewsArray = JSON.parse(data.data.product.metafield.value);
            // Lấy giá trị số nguyên đầu tiên trong mảng
            totalViews = totalViewsArray[0] || 0;
            console.log(totalViews);

        }

        // Tăng số lượt xem lên 1
        totalViews = totalViews + 1;

        // Chuyển đổi giá trị thành mảng JSON
        const totalViewsArray = JSON.stringify([totalViews]);

        // Cập nhật metafield 'total_views' của sản phẩm
        const mutation = `
        mutation {
            metafieldsSet(metafields: [
                {
                    ownerId: "${productGid}",
                    namespace: "custom",
                    key: "total_views",
                    type: "list.number_integer",
                    value: "${totalViewsArray}"
                }
            ]) {
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

        const updateResponse = await fetch(shopifyAdminApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
            },
            body: JSON.stringify({ query: mutation }),
        });

        const updateData = await updateResponse.json();

        if (updateData.errors || updateData.data.metafieldsSet.userErrors.length > 0) {
            return res.status(500).json({
                error: 'Lỗi khi cập nhật metafield',
                details: updateData.errors || updateData.data.metafieldsSet.userErrors,
            });
        }

        res.json({ success: true, totalViews });
    } catch (error) {
        console.error('Lỗi:', error);
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy tại http://localhost:${PORT}`));
