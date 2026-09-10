# 🛡️ HealthGuard AI — Medical Scan Analysis Engine

> AI-powered medical scan analysis with DenseNet-121 deep learning, Hi-Res CAM heatmap visualization, and comprehensive PDF report generation.

![Python](https://img.shields.io/badge/Python-3.9+-blue)
![PyTorch](https://img.shields.io/badge/PyTorch-2.5-red)
![Flask](https://img.shields.io/badge/Flask-3.1-green)
![License](https://img.shields.io/badge/License-MIT-yellow)
## ✨ Features

- **🔍 Scan Type Detection** — Automatically identifies X-Ray, CT, MRI, Ultrasound, PET, Mammogram, DEXA, and Fluoroscopy scans
- **🧠 DenseNet-121 Analysis** — Deep learning model detecting 15+ medical findings
- **🔥 Hi-Res CAM Heatmaps** — Visual explanations showing AI focus regions
- **📐 Region Marking** — Automatic contour detection with bounding boxes and severity indicators
- **📄 PDF Reports** — Professional downloadable reports with all findings and images
- **⚡ Severity Scoring** — Color-coded Low/Medium/High severity classification

## 🚀 Quick Start

### Prerequisites

- Python 3.9 or higher
- pip package manager

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd DoomSphere-HealthGuardAI

# Install dependencies
pip install -r requirements.txt

# Start the server
python server.py
```

### Usage

1. Open your browser at **http://localhost:5000**
2. Upload any medical scan image (X-Ray, MRI, CT, etc.)
3. Click **"Analyze Scan"**
4. View results with heatmaps and annotated regions
5. Download the comprehensive PDF report

## 🏗️ Architecture

```
DoomSphere-HealthGuardAI/
├── server.py                   # Flask API server
├── requirements.txt            # Python dependencies
├── backend/
│   ├── __init__.py
│   ├── scan_classifier.py      # Scan type classification
│   ├── analyzer.py             # DenseNet-121 + Hi-Res CAM analysis
│   └── report_generator.py     # PDF report generation
├── frontend/
│   ├── index.html              # Main UI
│   ├── styles.css              # Premium dark theme CSS
│   └── app.js                  # Frontend logic
├── uploads/                    # Uploaded scan storage
├── results/                    # Analysis output images
└── reports/                    # Generated PDF reports
```

## 🔬 How It Works

1. **Upload** — User uploads a medical scan image
2. **Classify** — Image features are extracted to identify scan type
3. **Analyze** — DenseNet-121 processes the image for medical findings
4. **Visualize** — Hi-Res CAM generates heatmaps; contours mark regions of interest
5. **Report** — Comprehensive PDF report is generated

## ⚠️ Disclaimer

This is an **AI-assisted analysis tool** and is **NOT** a substitute for professional medical diagnosis. Always consult qualified healthcare professionals for medical decisions.

## ☁️ Deploying to Vercel

The Flask + PyTorch backend (torch alone is ~450MB) cannot run on Vercel's serverless functions (250MB limit, short timeouts), and it also does on-disk model fine-tuning (`/api/train`, `/api/feedback`) that needs a persistent filesystem — incompatible with ephemeral serverless storage.

The split that works:
- **`astro-app/`** — the frontend, ported to Astro, deployed on Vercel. Set the `PUBLIC_API_BASE_URL` env var in the Vercel project to your backend's URL.
- **Flask backend** (`server.py`) — deploy to a normal always-on host (Render, Railway, Fly.io, a VPS) that keeps a persistent disk and long-running processes.

```bash
cd astro-app
npm install
npm run build     # outputs .vercel/output — deploy with `vercel deploy` or via Git integration
```

Locally, both can run side by side: `python server.py` (port 5000) and `cd astro-app && npm run dev` (port 4321), with `PUBLIC_API_BASE_URL=http://localhost:5000` in `astro-app/.env`.

## 📝 License

MIT License — © 2026 DoomSphere

---


