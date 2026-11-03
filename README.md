# HealthGuard AI — Medical Scan Analysis

Upload a medical scan (X-ray, CT, MRI and others) and get an AI-assisted analysis: scan-type detection, Grad-CAM heatmaps, marked regions, and a downloadable PDF report. A companion Flutter app in `chatbot_app/` covers patient and doctor workflows.

> **Research prototype.** This is not a medical device and not a substitute for clinical diagnosis. The output has not been clinically validated.

![Python](https://img.shields.io/badge/Python-3.9+-blue)
![PyTorch](https://img.shields.io/badge/PyTorch-2.6+-red)
![Flask](https://img.shields.io/badge/Flask-3.1-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

- **Scan upload and analysis**: single scans (`POST /api/analyze`) or batches (`POST /api/analyze-batch`)
- **Scan-type detection**: `backend/scan_classifier.py` identifies the modality
- **Heatmaps**: Grad-CAM visualisations of the regions the model used
- **Region marking**: contours and bounding boxes drawn on the image (OpenCV)
- **PDF reports**: generated with fpdf2. Noto fonts for Tamil and Oriya are bundled.
- **Feedback loop**: `POST /api/feedback` records corrections, and `POST /api/train` updates the classifier head. The weights are saved to `models/healthguard_brain.pth`.

## How it works

1. **Upload**: the user uploads a scan through the web UI or the API.
2. **Classify**: the scan type is detected.
3. **Analyse**: a DenseNet-121 backbone (ImageNet weights) with a trainable classifier head produces features. Findings and summaries are generated through the Groq API.
4. **Visualise**: Grad-CAM heatmaps and contour-based region marking are drawn on the image.
5. **Report**: a PDF is generated for download.

## Quick start

**Prerequisites:** Python 3.9+ and pip. A Groq API key is needed for the AI summaries.

```bash
git clone https://github.com/andrewsavio/DoomSphere-HealthGuardAI.git
cd DoomSphere-HealthGuardAI

python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

export GROQ_API_KEY=your_key     # Windows PowerShell: $env:GROQ_API_KEY="your_key"
python server.py
```

Open http://localhost:5000, upload a scan, and click **Analyze**.

## Configuration

The server reads these environment variables. The names are the ones `server.py` uses.

| Variable | Purpose | Required |
|----------|---------|----------|
| `GROQ_API_KEY` | AI summaries and findings | Yes, for AI text |
| `groq_insurance` | Groq key for the insurance module | Only for insurance features |
| `project_url` | Supabase project URL, for storing scan results | Optional |
| `anon_key` | Supabase anon key | Optional |

Keep keys in environment variables or a local `.env` file. Don't commit them.

The AI proxy (`POST /api/groq/chat`) allows `GROQ_RATE_LIMIT` requests (default 20) per client IP every `GROQ_RATE_WINDOW` seconds (default 60). The limit is per process. Use Redis if you run several workers.

## Project layout

```
server.py                 # Flask app and API routes
backend/
├── analyzer.py           # DenseNet-121, Grad-CAM, findings and summaries
├── scan_classifier.py    # scan-type detection
└── report_generator.py   # PDF reports
frontend/                 # HTML and JavaScript pages served by Flask
chatbot_app/              # Flutter app (patient and doctor)
models/                   # saved classifier weights
requirements.txt
```

## Model and limitations

- The DenseNet-121 backbone starts from ImageNet weights. This repository contains no medical training dataset.
- Findings and summaries come from LLM API calls. They have not been checked against clinical ground truth.
- No accuracy or sensitivity figures are reported here. Evaluate the system on labelled data before relying on it.

## Disclaimer

This is an **AI-assisted analysis tool** and is **NOT** a substitute for professional medical diagnosis. Always consult qualified healthcare professionals for medical decisions.

## License

MIT License — see [LICENSE](LICENSE). © 2026 Andrew Savio M.
