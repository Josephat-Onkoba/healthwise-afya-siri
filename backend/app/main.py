from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv

from .services.gemini_service import GeminiService
from .services.knowledge_base import KnowledgeBase

# Load environment variables
load_dotenv()

app = FastAPI(title="Afya Siri API")

# Configure CORS
origins = [
    "http://localhost:3000",
    "https://healthwise-afya-siri.vercel.app",
]

if os.getenv("ALLOWED_ORIGINS"):
    additional_origins = os.getenv("ALLOWED_ORIGINS").split(",")
    origins.extend(additional_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
gemini_service = GeminiService()
knowledge_base = KnowledgeBase()

# The initialize_sample_data method is not needed as the KnowledgeBase constructor already loads default topics

class ChatRequest(BaseModel):
    """Model for chat request."""
    message: str
    language: Optional[str] = "en"
    context: Optional[List[str]] = None

class ChatResponse(BaseModel):
    """Model for chat response."""
    response: str
    sources: Optional[List[str]] = None

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Handle chat requests and generate responses.
    
    Args:
        request: Chat request containing message and optional context
        
    Returns:
        Chat response with generated text and sources
    """
    try:
        # Search knowledge base for relevant information
        relevant_docs = knowledge_base.search(request.message)
        
        # Generate response using Gemini
        response = gemini_service.generate_text_response(
            request.message,
            context=relevant_docs
        )
        
        return ChatResponse(
            response=response,
            sources=relevant_docs
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-image")
async def analyze_image(
    file: UploadFile = File(...),
    query: Optional[str] = "What do you see in this image?"
):
    """
    Analyze an uploaded image.
    
    Args:
        file: Uploaded image file
        query: Optional query about the image
        
    Returns:
        Analysis results
    """
    try:
        # Read image data
        contents = await file.read()
        
        # Analyze image
        result = gemini_service.analyze_image(contents, query)
        
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-video")
async def analyze_video(
    file: UploadFile = File(...),
    query: Optional[str] = "What is happening in this video?"
):
    """
    Analyze an uploaded video.
    
    Args:
        file: Uploaded video file
        query: Optional query about the video
        
    Returns:
        Analysis results
    """
    try:
        # Save video to temporary file
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as buffer:
            contents = await file.read()
            buffer.write(contents)
        
        # Analyze video
        result = gemini_service.analyze_video(temp_path, query)
        
        # Clean up
        os.remove(temp_path)
        
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/extract-text")
async def extract_text(file: UploadFile = File(...)):
    """
    Extract text from an uploaded image.
    
    Args:
        file: Uploaded image file
        
    Returns:
        Extracted text
    """
    try:
        # Read image data
        contents = await file.read()
        
        # Extract text
        text = gemini_service.extract_text_from_image(contents)
        
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/knowledge")
async def get_knowledge():
    """Get all documents in the knowledge base."""
    try:
        documents = knowledge_base.get_all_documents()
        return {"documents": documents}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/knowledge")
async def add_knowledge(text: str, metadata: Optional[dict] = None):
    """
    Add a document to the knowledge base.
    
    Args:
        text: Document text
        metadata: Optional metadata
        
    Returns:
        ID of added document
    """
    try:
        doc_id = knowledge_base.add_document(text, metadata)
        return {"id": doc_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000) 