# HealthFirst - Multilingual Sexual Health Education Platform

A comprehensive sexual health education web application that leverages AI to analyze text, images, and videos to provide factual information in multiple African languages.

## Features

- **Multimodal Analysis**
  - Text query processing
  - Image analysis with OCR
  - Video content analysis
  - Powered by Google's Gemini AI models

- **Multilingual Support**
  - English (primary)
  - Swahili
  - Hausa
  - Yoruba
  - Igbo

- **Knowledge Base Integration**
  - Vector database storage
  - Verified medical information
  - Source citations
  - Centralized English knowledge base

- **Privacy-Focused Design**
  - No PII storage
  - Session-based interactions
  - Content moderation

## Tech Stack

### Backend
- Python Flask API server
- Google Generative AI (Gemini Pro and Gemini Pro Vision)
- ChromaDB for vector database
- PyTesseract for OCR
- MoviePy for video processing
- Deep Translator for language translation

### Frontend
- Next.js framework
- Tailwind CSS
- Axios
- Formidable

### Deployment
- Backend: Google Cloud Run/Heroku
- Frontend: Vercel

## Project Structure

```
healthfirst/
├── backend/              # Flask API server
│   ├── app/             # Application code
│   ├── tests/           # Test files
│   └── requirements.txt # Python dependencies
├── frontend/            # Next.js frontend
│   ├── src/            # Source code
│   ├── public/         # Static files
│   └── package.json    # Node dependencies
└── notebooks/          # Google Colab notebooks
```

## Setup Instructions

### Backend Setup
1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

### Frontend Setup
1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

## Development

1. Start the backend server:
   ```bash
   cd backend
   flask run
   ```

2. Start the frontend development server:
   ```bash
   cd frontend
   npm run dev
   ```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details. #   H e a l t h w i s e - A f y a - s i r i  
 