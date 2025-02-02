import cors from 'cors';
import express from 'express';

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

// 🛠 Giả lập database lưu total_views
let viewsData = {};

app.post('/api/LMserver.js', async (req, res) => {
    try {
        const { action, productGid } = req.body;

        if (!productGid) {
            return res.status(400).json({ success: false, error: "Thiếu productGid" });
        }

        if (action === "get_metafield") {
            let totalViews = viewsData[productGid] || 0;
            console.log(`📊 GET: ${productGid} => ${totalViews}`);
            return res.json({ success: true, totalViews });
        }

        if (action === "update_metafield") {
            viewsData[productGid] = (viewsData[productGid] || 0) + 1;
            console.log(`🔼 UPDATE: ${productGid} => ${viewsData[productGid]}`);
            return res.json({ success: true, totalViews: viewsData[productGid] });
        }

        res.status(400).json({ success: false, error: "Invalid action" });
    } catch (error) {
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

app.options('/api/LMserver', (req, res) => res.sendStatus(200));

export default app;
