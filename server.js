const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const app = express();

const PORT = process.env.PORT || 3000;

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'temp');
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /mp4|avi|mov|mkv|webm|mp3|wav|m4a|ogg/;
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.test(ext.slice(1))) {
            cb(null, true);
        } else {
            cb(new Error('Format not supported'));
        }
    }
});

app.use(express.static('public'));
app.use('/output', express.static('output'));

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.post('/api/process', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const inputPath = req.file.path;
    const outputFilename = `${path.parse(req.file.filename).name}_processed.mp4`;
    const outputPath = path.join(__dirname, 'output', outputFilename);

    try {
        await fs.mkdir(path.join(__dirname, 'output'), { recursive: true });

        const command = `ffmpeg -i "${inputPath}" -af "pan=stereo|c0=c0|c1=-1*c1" -c:v copy -c:a aac -b:a 192k "${outputPath}" -y`;

        exec(command, async (error) => {
            try {
                await fs.unlink(inputPath);
            } catch (err) {}

            if (error) {
                return res.status(500).json({ error: 'Processing failed' });
            }

            setTimeout(async () => {
                try {
                    await fs.unlink(outputPath);
                } catch (err) {}
            }, 60 * 60 * 1000);

            res.json({
                success: true,
                filename: outputFilename,
                downloadUrl: `/output/${outputFilename}`
            });
        });

    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Video Processor running on port ${PORT}`);
});
