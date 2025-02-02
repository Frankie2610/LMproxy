import cors from 'cors'; // Import middleware CORS
import express from 'express';

const app = express();

// 🚀 Cấu hình CORS
app.use(cors({
    origin: '*', // 👈 Cho phép mọi domain truy cập API
    methods: ['GET', 'POST', 'OPTIONS'], // 👈 Cho phép các phương thức cần thiết
    allowedHeaders: ['Content-Type', 'Authorization'], // 👈 Chỉ định các headers hợp lệ
}));

app.use(express.json());

// Route API chính
app.post('/api/LMserver', async (req, res) => {
    try {
        const { action, productGid, totalViews } = req.body;

        if (action === "get_metafield") {
            // 🛠 Lấy total_views
            return res.json({ success: true, totalViews: 100 }); // Fake data
        }

        if (action === "update_metafield") {
            // 🛠 Cập nhật total_views
            return res.json({ success: true, message: "Updated total_views successfully" });
        }

        res.status(400).json({ error: "Invalid action" });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ✅ Xử lý OPTIONS request để tránh lỗi Preflight CORS
app.options('/api/LMserver', (req, res) => {
    res.sendStatus(200);
});

// Khởi chạy server
export default app;
