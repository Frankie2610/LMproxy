import cors from 'cors';
import express from 'express';

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

// 🛠 Bộ nhớ tạm để lưu total_views (Giả lập database)
let viewsData = {};

// ✅ API xử lý lấy & cập nhật total_views
app.post('/api/LMserver.js', async (req, res) => {
    try {
        const { action, productGid } = req.body;

        if (!productGid) {
            return res.status(400).json({ success: false, error: "Thiếu productGid" });
        }

        if (action === "get_metafield") {
            let totalViews = viewsData[productGid] || 0;
            return res.json({ success: true, totalViews });
        }

        if (action === "update_metafield") {
            viewsData[productGid] = (viewsData[productGid] || 0) + 1;
            return res.json({ success: true, totalViews: viewsData[productGid] });
        }

        res.status(400).json({ success: false, error: "Invalid action" });
    } catch (error) {
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

// ✅ Xử lý OPTIONS request để tránh lỗi CORS preflight
app.options('/api/LMserver.js', (req, res) => res.sendStatus(200));

// 🚀 Khởi chạy server
export default app;
