import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Import backend routes
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Import and use backend routes
import authRoutes from './routes/auth.js';
import serverRoutes from './routes/servers.js';
import notificationRoutes from './routes/notifications.js';
import billingRoutes from './routes/billing.js';

app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/billing', billingRoutes);

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
