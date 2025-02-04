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
        // Get metafield 'product_views'
        const query = `
        {
            product(id: "${productGid}") {
                metafield(namespace: "custom", key: "product_views") {
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

        let productViews = 0;
        if (data.data?.product?.metafield?.value) {
            const productViewsArray = JSON.parse(data.data.product.metafield.value);
            productViews = +productViewsArray[0] || 0;
        }

        // Update metafield 'product_views'
        productViews += 1;
        const mutation = `
        mutation {
            metafieldsSet(metafields: [
                {
                    ownerId: "${productGid}",
                    namespace: "custom",
                    key: "product_views",
                    type: "list.number_integer",
                    value: "[${productViews}]"
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

        res.json({ success: true, productViews: productViews });
        productViews = productViews - 1;
        return productViews;
    } catch (error) {
        console.error('Lỗi:', error);
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
        return
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy tại http://localhost:${PORT}`));
