import cors from 'cors';
import express from 'express';

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

// 🔹 Fake database lưu số lượt xem sản phẩm (chỉ dùng tạm, cần thay bằng database thật)
const productViews = {};

// 🛠 API xử lý lượt xem sản phẩm
app.post('/api/LMserver.js', async (req, res) => {
    try {
        const { action, productGid } = req.body;

        if (!productGid) {
            return res.status(400).json({ success: false, error: "Thiếu productGid" });
        }

        if (action === "get_metafield") {
            // 🛠 Lấy số lượt xem hiện tại
            const totalViews = productViews[productGid] || 0;
            return res.json({ success: true, totalViews });
        }

        if (action === "update_metafield") {
            // 🔼 Tăng số lượt xem
            productViews[productGid] = (productViews[productGid] || 0) + 1;
            return res.json({ success: true, totalViews: productViews[productGid] });
        }

        res.status(400).json({ success: false, error: "Invalid action" });
    } catch (error) {
        console.error("❌ Server Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

// ✅ Xử lý OPTIONS request để tránh lỗi Preflight CORS
app.options('/api/LMserver.js', (req, res) => {
    res.sendStatus(200);
});

// 🚀 Khởi chạy server
export default app;
